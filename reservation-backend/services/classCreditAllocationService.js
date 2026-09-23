'use strict';

const { Op } = require('sequelize');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const {
  Class,
  ClassMembership,
  ClassCreditAllocation,
  ClassCreditAdjustment,
  Settings,
  sequelize,
} = require('../models');
const { SEMESTER_RANGES } = require('../utils/semesterConstants');
const {
  roundHours,
  roundSignedHours,
  hoursToPoints,
  signedHoursToPoints,
  combineClassCredit,
  hoursForEventType,
  ENGLISH_TABLE_45_MIN_FROM,
} = require('../utils/classCreditHours');

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Taipei';
const SETTINGS_KEY = 'class_credit_allocation_deadlines';
const NAV_ENABLED_KEY = 'class_credit_allocation_nav_enabled';

function parseSettingBool(setting, defaultValue) {
  if (!setting) return defaultValue;
  if (setting.valueBool !== null && setting.valueBool !== undefined) {
    return setting.valueBool === true;
  }
  return setting.value === 'true';
}

/** 學生導覽「課堂加分配置」是否顯示。未設定時預設開啟。 */
async function isNavEnabled() {
  const setting = await Settings.findOne({ where: { key: NAV_ENABLED_KEY } });
  return parseSettingBool(setting, true);
}

async function setNavEnabled(enabled) {
  const value = !!enabled;
  const [setting, created] = await Settings.findOrCreate({
    where: { key: NAV_ENABLED_KEY },
    defaults: { value: value.toString(), valueBool: value },
  });
  if (!created) {
    await setting.update({ value: value.toString(), valueBool: value });
  }
  return value;
}

function assertNavEnabled(enabled) {
  if (enabled) return;
  const err = new Error('課堂加分配置目前未開放');
  err.status = 403;
  err.code = 'CLASS_CREDIT_NAV_DISABLED';
  throw err;
}

function cleanStudentId(str) {
  if (!str) return null;
  return String(str).trim().toUpperCase().replace(/\s+/g, '');
}

function assertSemester(semester) {
  const range = SEMESTER_RANGES[semester];
  if (!range) {
    const err = new Error('不支援的學期');
    err.status = 400;
    err.code = 'UNSUPPORTED_SEMESTER';
    throw err;
  }
  return range;
}

async function readDeadlinesMap() {
  const row = await Settings.findOne({ where: { key: SETTINGS_KEY } });
  if (!row || !row.value) return {};
  try {
    const parsed = JSON.parse(row.value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

async function getDeadlineIso(semester) {
  const map = await readDeadlinesMap();
  const raw = map[semester];
  if (!raw) return null;
  const d = dayjs.tz(String(raw).slice(0, 10), TZ);
  if (!d.isValid()) return null;
  return d.format('YYYY-MM-DD');
}

/**
 * 截止日：該日 23:59:59 Asia/Taipei 前可配置
 */
function isPastDeadline(deadlineIso, now = new Date()) {
  if (!deadlineIso) return false;
  const end = dayjs.tz(`${deadlineIso} 23:59:59`, TZ);
  if (!end.isValid()) return false;
  return dayjs(now).tz(TZ).isAfter(end);
}

async function setDeadline(semester, deadlineDate) {
  assertSemester(semester);
  const map = await readDeadlinesMap();
  if (deadlineDate == null || deadlineDate === '') {
    delete map[semester];
  } else {
    const d = dayjs.tz(String(deadlineDate).slice(0, 10), TZ);
    if (!d.isValid()) {
      const err = new Error('截止日格式無效（需 YYYY-MM-DD）');
      err.status = 400;
      err.code = 'INVALID_DEADLINE';
      throw err;
    }
    map[semester] = d.format('YYYY-MM-DD');
  }

  const value = JSON.stringify(map);
  const [setting, created] = await Settings.findOrCreate({
    where: { key: SETTINGS_KEY },
    defaults: { value, valueBool: null },
  });
  if (!created) {
    await setting.update({ value, valueBool: null });
  }
  return {
    semester,
    deadline: map[semester] || null,
    deadlines: map,
  };
}

async function listDeadlines() {
  const map = await readDeadlinesMap();
  const semesters = Object.keys(SEMESTER_RANGES).sort();
  return {
    deadlines: map,
    rows: semesters.map((semester) => ({
      semester,
      deadline: map[semester] || null,
      locked: isPastDeadline(map[semester] || null),
      range: SEMESTER_RANGES[semester],
    })),
  };
}

/**
 * 全站累計（僅參考）：學期內所有已簽到，不含護照篩選
 */
async function computeSiteTotals(studentId, semesterRange, activityType = 'All') {
  const sid = cleanStudentId(studentId);
  const replacements = {
    studentId: sid,
    startDate: semesterRange.start,
    endDate: semesterRange.end,
  };
  let typeClause = '';
  if (activityType && activityType !== 'All') {
    typeClause = 'AND e.eventType = :activityType';
    replacements.activityType = activityType;
  }

  const rows = await sequelize.query(
    `SELECT e.eventType AS eventType,
            CASE WHEN e.date >= '${ENGLISH_TABLE_45_MIN_FROM}' THEN 1 ELSE 0 END AS et45,
            COUNT(r.id) AS count
     FROM Reservations r
     INNER JOIN Events e ON r.eventId = e.id
     WHERE r.studentId = :studentId
       AND r.checkinStatus = '已簽到'
       AND e.date BETWEEN :startDate AND :endDate
       ${typeClause}
     GROUP BY e.eventType, et45`,
    { replacements, type: sequelize.QueryTypes.SELECT },
  );

  let totalHours = 0;
  let attendedCountTotal = 0;
  for (const row of rows) {
    const count = Number(row.count) || 0;
    attendedCountTotal += count;
    totalHours += count * hoursForEventType(row.eventType, {
      use45MinEnglishTable: Number(row.et45) === 1,
    });
  }
  totalHours = roundHours(totalHours);
  return {
    siteTotalHours: totalHours,
    sitePointScore: hoursToPoints(totalHours),
    attendedCountTotal,
  };
}

/**
 * 可配置庫存：已簽到且未計入護照
 */
async function computeEarnedInventory(studentId, semesterRange) {
  const sid = cleanStudentId(studentId);
  const rows = await sequelize.query(
    `SELECT e.eventType AS eventType,
            CASE WHEN e.date >= '${ENGLISH_TABLE_45_MIN_FROM}' THEN 1 ELSE 0 END AS et45,
            COUNT(r.id) AS count
     FROM Reservations r
     INNER JOIN Events e ON r.eventId = e.id
     WHERE r.studentId = :studentId
       AND r.checkinStatus = '已簽到'
       AND (r.counts_toward_passport = 0 OR r.counts_toward_passport IS NULL)
       AND e.date BETWEEN :startDate AND :endDate
     GROUP BY e.eventType, et45`,
    {
      replacements: {
        studentId: sid,
        startDate: semesterRange.start,
        endDate: semesterRange.end,
      },
      type: sequelize.QueryTypes.SELECT,
    },
  );

  let earnedHours = 0;
  let earnedCheckinCount = 0;
  for (const row of rows) {
    const count = Number(row.count) || 0;
    earnedCheckinCount += count;
    earnedHours += count * hoursForEventType(row.eventType, {
      use45MinEnglishTable: Number(row.et45) === 1,
    });
  }
  earnedHours = roundHours(earnedHours);
  return {
    earnedHours,
    earnedPoints: hoursToPoints(earnedHours),
    earnedCheckinCount,
  };
}

async function listStudentClasses(studentId, semester) {
  const sid = cleanStudentId(studentId);
  const memberships = await ClassMembership.findAll({
    where: { semester, studentId: sid },
    include: [{ model: Class, required: true, attributes: ['id', 'name', 'teacherName', 'semester'] }],
    order: [['classId', 'ASC']],
  });

  return memberships.map((m) => {
    const plain = m.toJSON ? m.toJSON() : m;
    const cls = plain.Class || {};
    return {
      classId: plain.classId,
      className: cls.name || `班級 #${plain.classId}`,
      teacherName: cls.teacherName || null,
      studentName: plain.studentName,
      department: plain.department || null,
    };
  });
}

async function loadAllocationRows(studentId, semester, transaction) {
  const sid = cleanStudentId(studentId);
  return ClassCreditAllocation.findAll({
    where: { semester, studentId: sid },
    transaction,
  });
}

/**
 * 單課：自動把全部可配置時數歸該班（即使截止後仍隨庫存同步）
 */
async function ensureAutoAllocationForSingleClass(studentId, semester, classes, earnedHours, transaction) {
  if (classes.length !== 1) return false;
  const sid = cleanStudentId(studentId);
  const classId = classes[0].classId;
  const hours = roundHours(earnedHours);

  const [row] = await ClassCreditAllocation.findOrCreate({
    where: { semester, studentId: sid, classId },
    defaults: { allocatedHours: hours },
    transaction,
  });
  if (Number(row.allocatedHours) !== hours) {
    await row.update({ allocatedHours: hours }, { transaction });
  }

  // 清除誤寫的其他班（理論上不應存在）
  await ClassCreditAllocation.destroy({
    where: {
      semester,
      studentId: sid,
      classId: { [Op.ne]: classId },
    },
    transaction,
  });
  return true;
}

function sumAllocatedHours(rows) {
  return roundHours(rows.reduce((sum, r) => sum + Number(r.allocatedHours || 0), 0));
}

async function loadAdjustmentRows(studentId, semester) {
  const sid = cleanStudentId(studentId);
  return ClassCreditAdjustment.findAll({
    where: { semester, studentId: sid },
    order: [['id', 'DESC']],
  });
}

function sumAdjustmentHours(rows, classId) {
  const filtered = rows.filter((r) => r.classId != null && Number(r.classId) === Number(classId));
  return roundSignedHours(filtered.reduce((sum, r) => sum + Number(r.hours || 0), 0));
}

function sumPoolAdjustmentHours(rows) {
  return roundSignedHours(
    rows.filter((r) => r.classId == null).reduce((sum, r) => sum + Number(r.hours || 0), 0),
  );
}

/** 簽到庫存 + 後台總時數增減。顯示用總時數不低於 0。 */
async function computeAllocatableHours(studentId, semester, semesterRange) {
  const inventory = await computeEarnedInventory(studentId, semesterRange);
  const adjustments = await loadAdjustmentRows(studentId, semester);
  const poolAdjustmentHours = sumPoolAdjustmentHours(adjustments);
  const earnedHours = roundHours(Math.max(0, inventory.earnedHours + poolAdjustmentHours));
  return {
    checkinHours: inventory.earnedHours,
    poolAdjustmentHours,
    earnedHours,
    earnedPoints: hoursToPoints(earnedHours),
    earnedCheckinCount: inventory.earnedCheckinCount,
  };
}

function serializeAdjustment(row, classNameById) {
  const plain = row.toJSON ? row.toJSON() : row;
  const hours = roundSignedHours(plain.hours);
  return {
    id: plain.id,
    semester: plain.semester,
    studentId: plain.studentId,
    classId: plain.classId,
    className: classNameById?.get(Number(plain.classId)) || null,
    hours,
    points: signedHoursToPoints(hours),
    scope: plain.classId == null ? 'pool' : 'class',
    note: plain.note,
    createdBy: plain.createdBy ?? null,
    createdAt: plain.createdAt,
  };
}

function resolveAllocationStatus({
  classCount,
  allocatedToThisClass,
  totalAllocated,
  locked,
  earnedHours = 0,
}) {
  if (classCount <= 1) {
    return {
      allocationStatus: 'auto',
      allocationStatusLabel: null,
    };
  }
  if (totalAllocated > 0 && allocatedToThisClass > 0) {
    return {
      allocationStatus: 'allocated',
      allocationStatusLabel: null,
    };
  }
  if (totalAllocated > 0 && allocatedToThisClass <= 0) {
    return {
      allocationStatus: 'allocated_elsewhere',
      allocationStatusLabel: '已配他班',
    };
  }
  // 沒有可分配時數時，不標「待配置／未配置」
  if (roundHours(earnedHours) <= 0) {
    return {
      allocationStatus: 'none',
      allocationStatusLabel: null,
    };
  }
  if (locked) {
    return {
      allocationStatus: 'unallocated',
      allocationStatusLabel: '未配置',
    };
  }
  return {
    allocationStatus: 'pending',
    allocationStatusLabel: '待配置',
  };
}

/**
 * 學生配置總覽（含單課自動歸屬）
 */
async function getStudentAllocationDashboard(studentId, semester) {
  const range = assertSemester(semester);
  const sid = cleanStudentId(studentId);
  const classes = await listStudentClasses(sid, semester);
  const inventory = await computeAllocatableHours(sid, semester, range);
  const site = await computeSiteTotals(sid, range);
  const deadline = await getDeadlineIso(semester);
  const locked = isPastDeadline(deadline);

  await sequelize.transaction(async (transaction) => {
    await ensureAutoAllocationForSingleClass(
      sid,
      semester,
      classes,
      inventory.earnedHours,
      transaction,
    );
  });

  const rows = await loadAllocationRows(sid, semester);
  const adjustments = await loadAdjustmentRows(sid, semester);
  const byClassId = new Map(rows.map((r) => [r.classId, roundHours(r.allocatedHours)]));
  const totalAllocated = sumAllocatedHours(rows);
  const remainingHours = roundHours(Math.max(0, inventory.earnedHours - totalAllocated));
  const combinedByClass = classes.map((c) => combineClassCredit(
    byClassId.get(c.classId) || 0,
    sumAdjustmentHours(adjustments, c.classId),
  ));
  const displayTotal = roundHours(combinedByClass.reduce((sum, item) => sum + item.displayHours, 0));

  const classAllocations = classes.map((c, index) => {
    const combined = combinedByClass[index];
    const status = resolveAllocationStatus({
      classCount: classes.length,
      allocatedToThisClass: combined.displayHours,
      totalAllocated: displayTotal,
      locked,
      earnedHours: inventory.earnedHours,
    });
    return {
      ...c,
      allocatedHours: combined.allocatedHours,
      allocatedPoints: hoursToPoints(combined.allocatedHours),
      adjustmentHours: combined.adjustmentHours,
      effectiveHours: combined.effectiveHours,
      displayHours: combined.displayHours,
      displayPoints: combined.displayPoints,
      ...status,
    };
  });

  return {
    semester,
    studentId: sid,
    deadline,
    locked,
    canEdit: classes.length > 1 && !locked,
    classCount: classes.length,
    autoAllocated: classes.length === 1,
    checkinHours: inventory.checkinHours,
    poolAdjustmentHours: inventory.poolAdjustmentHours,
    earnedHours: inventory.earnedHours,
    earnedPoints: inventory.earnedPoints,
    earnedCheckinCount: inventory.earnedCheckinCount,
    allocatedHours: totalAllocated,
    allocatedPoints: hoursToPoints(totalAllocated),
    remainingHours,
    remainingPoints: hoursToPoints(remainingHours),
    siteTotalHours: site.siteTotalHours,
    sitePointScore: site.sitePointScore,
    classes: classAllocations,
  };
}

/**
 * 多課儲存配置；單課拒絕手動寫入（由自動歸屬處理）
 */
async function saveStudentAllocations(studentId, semester, allocations) {
  const range = assertSemester(semester);
  const sid = cleanStudentId(studentId);
  const deadline = await getDeadlineIso(semester);
  if (isPastDeadline(deadline)) {
    const err = new Error('已超過課堂加分配置截止日，無法再修改');
    err.status = 409;
    err.code = 'ALLOCATION_LOCKED';
    throw err;
  }

  const classes = await listStudentClasses(sid, semester);
  if (classes.length === 0) {
    const err = new Error('本學期名冊中找不到您的班級');
    err.status = 404;
    err.code = 'NO_CLASS_MEMBERSHIP';
    throw err;
  }
  if (classes.length === 1) {
    const err = new Error('本學期僅一門課，系統已自動歸屬，無需手動配置');
    err.status = 400;
    err.code = 'AUTO_ALLOCATION_ONLY';
    throw err;
  }

  const allowedIds = new Set(classes.map((c) => c.classId));
  if (!Array.isArray(allocations)) {
    const err = new Error('allocations 必須為陣列');
    err.status = 400;
    err.code = 'INVALID_ALLOCATIONS';
    throw err;
  }

  const normalized = [];
  const seen = new Set();
  for (const item of allocations) {
    const classId = Number(item.classId);
    const hours = roundHours(item.hours ?? item.allocatedHours ?? 0);
    if (!allowedIds.has(classId)) {
      const err = new Error(`班級 ${classId} 不在您的名冊中`);
      err.status = 400;
      err.code = 'CLASS_NOT_OWNED';
      throw err;
    }
    if (hours < 0) {
      const err = new Error('配置時數不可為負');
      err.status = 400;
      err.code = 'NEGATIVE_HOURS';
      throw err;
    }
    if (seen.has(classId)) {
      const err = new Error('同一班級不可重複配置');
      err.status = 400;
      err.code = 'DUPLICATE_CLASS';
      throw err;
    }
    seen.add(classId);
    normalized.push({ classId, hours });
  }

  for (const c of classes) {
    if (!seen.has(c.classId)) {
      normalized.push({ classId: c.classId, hours: 0 });
    }
  }

  const inventory = await computeAllocatableHours(sid, semester, range);
  const total = roundHours(normalized.reduce((s, x) => s + x.hours, 0));
  if (total > inventory.earnedHours + 0.05) {
    const err = new Error(
      `配置時數合計 ${total} 超過可配置庫存 ${inventory.earnedHours}（已排除計入護照的簽到）`,
    );
    err.status = 400;
    err.code = 'OVER_ALLOCATED';
    throw err;
  }

  await sequelize.transaction(async (transaction) => {
    for (const item of normalized) {
      if (item.hours <= 0) {
        await ClassCreditAllocation.destroy({
          where: { semester, studentId: sid, classId: item.classId },
          transaction,
        });
        continue;
      }
      const [row] = await ClassCreditAllocation.findOrCreate({
        where: { semester, studentId: sid, classId: item.classId },
        defaults: { allocatedHours: item.hours },
        transaction,
      });
      if (Number(row.allocatedHours) !== item.hours) {
        await row.update({ allocatedHours: item.hours }, { transaction });
      }
    }
  });

  return getStudentAllocationDashboard(sid, semester);
}

/**
 * 班級明細用：單一學生在該班的歸屬狀態
 */
async function getClassMemberCreditView(studentId, semester, classId, siteStats) {
  const range = assertSemester(semester);
  const sid = cleanStudentId(studentId);
  const classes = await listStudentClasses(sid, semester);
  const inventory = await computeAllocatableHours(sid, semester, range);
  const deadline = await getDeadlineIso(semester);
  const locked = isPastDeadline(deadline);

  if (classes.length === 1 && classes[0].classId === Number(classId)) {
    await sequelize.transaction(async (transaction) => {
      await ensureAutoAllocationForSingleClass(
        sid,
        semester,
        classes,
        inventory.earnedHours,
        transaction,
      );
    });
  }

  const rows = await loadAllocationRows(sid, semester);
  const adjustments = await loadAdjustmentRows(sid, semester);
  const thisRow = rows.find((r) => Number(r.classId) === Number(classId));
  const allocatedHours = thisRow ? roundHours(thisRow.allocatedHours) : 0;
  const combined = combineClassCredit(allocatedHours, sumAdjustmentHours(adjustments, classId));
  const displayTotal = roundHours(classes.reduce((sum, c) => {
    const row = rows.find((r) => Number(r.classId) === Number(c.classId));
    const item = combineClassCredit(
      row ? row.allocatedHours : 0,
      sumAdjustmentHours(adjustments, c.classId),
    );
    return sum + item.displayHours;
  }, 0));
  const status = resolveAllocationStatus({
    classCount: classes.length,
    allocatedToThisClass: combined.displayHours,
    totalAllocated: displayTotal,
    locked,
    earnedHours: inventory.earnedHours,
  });

  const siteTotalHours = siteStats?.totalHours != null
    ? roundHours(siteStats.totalHours)
    : (await computeSiteTotals(sid, range)).siteTotalHours;
  const sitePointScore = siteStats?.pointScore != null
    ? Number(siteStats.pointScore)
    : hoursToPoints(siteTotalHours);

  return {
    allocatedHours: combined.allocatedHours,
    allocatedPoints: hoursToPoints(combined.allocatedHours),
    adjustmentHours: combined.adjustmentHours,
    effectiveHours: combined.effectiveHours,
    siteTotalHours,
    sitePointScore,
    classCount: classes.length,
    deadline,
    locked,
    ...status,
    // 老師加分權威欄位：學生配置 + 後台調整，負值顯示為 0
    totalHours: combined.displayHours,
    pointScore: combined.displayPoints,
  };
}

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

async function getAdminStudentCredit(studentId, semester) {
  const dashboard = await getStudentAllocationDashboard(studentId, semester);
  const adjustments = await loadAdjustmentRows(dashboard.studentId, semester);
  const classNameById = new Map((dashboard.classes || []).map((c) => [Number(c.classId), c.className]));
  return {
    ...dashboard,
    studentName: dashboard.classes?.[0]?.studentName || null,
    adjustments: adjustments.map((row) => serializeAdjustment(row, classNameById)),
  };
}

function resolveAdjustmentHours(hours, direction) {
  const raw = Number(hours);
  if (!Number.isFinite(raw)) {
    throw httpError(400, 'INVALID_HOURS', '請填寫時數');
  }
  const dir = String(direction || '').trim().toLowerCase();
  let signed;
  if (dir === 'deduct' || dir === 'decrease') {
    signed = -roundHours(Math.abs(raw));
  } else if (dir === 'add' || dir === 'increase') {
    signed = roundHours(Math.abs(raw));
  } else {
    signed = roundSignedHours(raw);
  }
  if (signed === 0) {
    throw httpError(400, 'INVALID_HOURS', '時數須大於 0');
  }
  if (Math.abs(signed) > 200) {
    throw httpError(400, 'HOURS_OUT_OF_RANGE', '單筆調整時數不可超過 200');
  }
  return signed;
}

async function syncSingleClassPool(studentId, semester) {
  const range = assertSemester(semester);
  const classes = await listStudentClasses(studentId, semester);
  const inventory = await computeAllocatableHours(studentId, semester, range);
  await sequelize.transaction(async (transaction) => {
    await ensureAutoAllocationForSingleClass(
      studentId,
      semester,
      classes,
      inventory.earnedHours,
      transaction,
    );
  });
}

async function createAdjustment({
  studentId, semester, hours, direction, note, createdBy,
}) {
  assertSemester(semester);
  const sid = cleanStudentId(studentId);
  if (!sid) throw httpError(400, 'INVALID_STUDENT_ID', '請填寫學號');

  const classes = await listStudentClasses(sid, semester);
  if (classes.length === 0) {
    throw httpError(400, 'CLASS_NOT_ON_ROSTER', '該學生本學期不在班級名冊');
  }

  const signedHours = resolveAdjustmentHours(hours, direction);

  const trimmedNote = String(note || '').trim();
  if (!trimmedNote) throw httpError(400, 'INVALID_NOTE', '請填寫調整原因');
  if (trimmedNote.length > 200) throw httpError(400, 'INVALID_NOTE', '原因不可超過 200 字');

  const row = await ClassCreditAdjustment.create({
    semester,
    studentId: sid,
    classId: null,
    hours: signedHours,
    note: trimmedNote,
    createdBy: createdBy || null,
  });

  await syncSingleClassPool(sid, semester);
  return serializeAdjustment(row, null);
}

async function deleteAdjustment(id) {
  const row = await ClassCreditAdjustment.findByPk(id);
  if (!row) throw httpError(404, 'ADJUSTMENT_NOT_FOUND', '找不到這筆時數調整');
  const snapshot = serializeAdjustment(row, null);
  await row.destroy();
  if (snapshot.classId == null) {
    await syncSingleClassPool(snapshot.studentId, snapshot.semester);
  }
  return snapshot;
}

function allocationPageUrl() {
  const base = String(process.env.FRONTEND_URL || 'http://emieears-siwan.nsysu.edu.tw').replace(/\/$/, '');
  return `${base}/student/class-credit-allocation`;
}

function isEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

/**
 * send | single_class | no_hours | fully_allocated | no_email
 */
function classifyReminderCandidate({ classCount, earnedHours, allocatedHours, email }) {
  if (Number(classCount) <= 1) return 'single_class';
  const earned = roundHours(earnedHours);
  if (earned <= 0) return 'no_hours';
  const remaining = roundHours(Math.max(0, earned - roundHours(allocatedHours)));
  if (remaining <= 0) return 'fully_allocated';
  if (!isEmailAddress(email)) return 'no_email';
  return 'send';
}

async function assertReminderCanSend(semester) {
  assertSemester(semester);
  const navOn = await isNavEnabled();
  if (!navOn) {
    throw httpError(400, 'CLASS_CREDIT_NAV_DISABLED', '請先開啟學生端「課堂加分配置」入口，再寄送提醒');
  }
  const deadline = await getDeadlineIso(semester);
  if (!deadline) {
    throw httpError(400, 'DEADLINE_REQUIRED', '請先設定本學期配置截止日');
  }
  if (isPastDeadline(deadline)) {
    throw httpError(409, 'ALLOCATION_LOCKED', '已超過截止日，學生無法再分配');
  }
  return deadline;
}

async function listMultiClassRoster(semester) {
  const memberships = await ClassMembership.findAll({
    where: { semester },
    include: [{ model: Class, required: true, attributes: ['id', 'name'] }],
    order: [['studentId', 'ASC'], ['classId', 'ASC']],
  });
  const byStudent = new Map();
  for (const membership of memberships) {
    const plain = membership.toJSON ? membership.toJSON() : membership;
    const sid = cleanStudentId(plain.studentId);
    if (!sid) continue;
    if (!byStudent.has(sid)) {
      byStudent.set(sid, {
        studentId: sid,
        studentName: plain.studentName || sid,
        emails: [],
        classes: [],
      });
    }
    const entry = byStudent.get(sid);
    if (plain.studentName) entry.studentName = plain.studentName;
    if (plain.email) entry.emails.push(String(plain.email).trim());
    const cls = plain.Class || {};
    entry.classes.push(cls.name || `班級 #${plain.classId}`);
  }
  return [...byStudent.values()].filter((row) => row.classes.length > 1);
}

async function latestReservationEmails(studentIds) {
  if (!studentIds.length) return new Map();
  const rows = await sequelize.query(
    `SELECT r.studentId AS studentId, r.studentEmail AS studentEmail
     FROM Reservations r
     INNER JOIN (
       SELECT studentId, MAX(id) AS maxId
       FROM Reservations
       WHERE studentId IN (:studentIds)
         AND studentEmail IS NOT NULL
         AND studentEmail <> ''
       GROUP BY studentId
     ) latest ON r.id = latest.maxId`,
    {
      replacements: { studentIds },
      type: sequelize.QueryTypes.SELECT,
    },
  );
  const map = new Map();
  for (const row of rows) {
    map.set(cleanStudentId(row.studentId), String(row.studentEmail || '').trim());
  }
  return map;
}

function pickRosterEmail(emails, fallback) {
  const candidates = [...(emails || []), fallback].filter(Boolean);
  return candidates.find((value) => isEmailAddress(value)) || '';
}

async function buildAllocationReminderPreview(semester) {
  assertSemester(semester);
  const deadline = await getDeadlineIso(semester);
  const locked = isPastDeadline(deadline);
  const navOn = await isNavEnabled();
  const roster = await listMultiClassRoster(semester);
  const missingEmailIds = roster
    .filter((row) => !row.emails.some((value) => isEmailAddress(value)))
    .map((row) => row.studentId);
  const reservationEmails = await latestReservationEmails(missingEmailIds);

  const evaluated = [];
  for (let i = 0; i < roster.length; i += 8) {
    const chunk = roster.slice(i, i + 8);
    const part = await Promise.all(chunk.map(async (row) => {
      const inventory = await computeAllocatableHours(row.studentId, semester, SEMESTER_RANGES[semester]);
      const allocations = await loadAllocationRows(row.studentId, semester);
      const allocatedHours = sumAllocatedHours(allocations);
      const email = pickRosterEmail(row.emails, reservationEmails.get(row.studentId));
      const reason = classifyReminderCandidate({
        classCount: row.classes.length,
        earnedHours: inventory.earnedHours,
        allocatedHours,
        email,
      });
      const remainingHours = roundHours(Math.max(0, inventory.earnedHours - allocatedHours));
      return {
        studentId: row.studentId,
        studentName: row.studentName,
        email,
        classNames: row.classes.join('、'),
        remainingHours,
        remainingPoints: hoursToPoints(remainingHours),
        reason,
      };
    }));
    evaluated.push(...part);
  }

  const recipients = evaluated.filter((row) => row.reason === 'send');
  let blockCode = null;
  let blockMessage = null;
  if (!navOn) {
    blockCode = 'CLASS_CREDIT_NAV_DISABLED';
    blockMessage = '請先開啟學生端「課堂加分配置」入口，再寄送提醒';
  } else if (!deadline) {
    blockCode = 'DEADLINE_REQUIRED';
    blockMessage = '請先設定本學期配置截止日';
  } else if (locked) {
    blockCode = 'ALLOCATION_LOCKED';
    blockMessage = '已超過截止日，學生無法再分配';
  } else if (recipients.length === 0) {
    blockCode = 'NO_RECIPIENTS';
    blockMessage = '沒有需要提醒的學生';
  }

  return {
    semester,
    deadline,
    locked,
    navEnabled: navOn,
    canSend: !blockCode,
    blockCode,
    blockMessage,
    multiClassCount: roster.length,
    recipientCount: recipients.length,
    skippedNoHours: evaluated.filter((row) => row.reason === 'no_hours').length,
    skippedFullyAllocated: evaluated.filter((row) => row.reason === 'fully_allocated').length,
    skippedNoEmail: evaluated.filter((row) => row.reason === 'no_email').length,
    recipients,
  };
}

async function enqueueAllocationReminders(semester, { requestId } = {}) {
  const deadline = await assertReminderCanSend(semester);
  const preview = await buildAllocationReminderPreview(semester);
  if (preview.recipientCount === 0) {
    throw httpError(400, 'NO_RECIPIENTS', '沒有需要提醒的學生');
  }
  const emailQueue = require('../utils/emailQueue');
  const allocationUrl = allocationPageUrl();
  for (const row of preview.recipients) {
    await emailQueue.enqueue('classCreditAllocationReminder', {
      studentName: row.studentName,
      studentId: row.studentId,
      studentEmail: row.email,
      semester,
      deadline,
      remainingHours: row.remainingHours,
      remainingPoints: row.remainingPoints,
      classNames: row.classNames,
      allocationUrl,
    }, {
      requestId: requestId || undefined,
      relatedEntityType: 'class_credit_allocation',
      relatedEntityId: `${semester}:${row.studentId}`,
    });
  }
  return {
    semester,
    deadline,
    queued: preview.recipientCount,
    skippedNoHours: preview.skippedNoHours,
    skippedFullyAllocated: preview.skippedFullyAllocated,
    skippedNoEmail: preview.skippedNoEmail,
  };
}

module.exports = {
  SETTINGS_KEY,
  NAV_ENABLED_KEY,
  isNavEnabled,
  setNavEnabled,
  assertNavEnabled,
  cleanStudentId,
  getDeadlineIso,
  setDeadline,
  listDeadlines,
  isPastDeadline,
  computeSiteTotals,
  computeEarnedInventory,
  listStudentClasses,
  getStudentAllocationDashboard,
  saveStudentAllocations,
  getClassMemberCreditView,
  getAdminStudentCredit,
  createAdjustment,
  deleteAdjustment,
  hoursToPoints,
  roundHours,
  resolveAllocationStatus,
  resolveAdjustmentHours,
  classifyReminderCandidate,
  buildAllocationReminderPreview,
  enqueueAllocationReminders,
};
