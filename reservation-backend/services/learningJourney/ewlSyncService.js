'use strict';

const { Op } = require('sequelize');
const { sequelize, Student, ActivityParticipation } = require('../../models');
const { semesterIdFromDate, SEMESTER_RANGES } = require('../../utils/semesterConstants');
const {
  fetchReservationInfo,
  fetchAttendanceInfo
} = require('./ewlApiClient');
const { hoursFromStartEndTime } = require('./utils/activityHours');
const { mapEwlEventNameToResourceType } = require('../learningAnalytics/ewlResourceTypes');

const SOURCE_REF_PREFIX = 'ewl_api';
const ACTIVITY_TYPE = 'EWL';

function emptyStats() {
  return {
    inserted: 0,
    updated: 0,
    skipped: 0,
    reconciled: 0,
    reconcileSkipped: null,
    errors: [],
    affectedStudentIds: []
  };
}

/** 寫作工坊取消後，課堂時數不可再計。 */
function isCancelledReservationStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return false;
  return s.includes('取消') || s.includes('cancel');
}

function pushErr(errors, code, message, extra = {}) {
  errors.push({ code, message: String(message || ''), ...extra });
}

function normStudentId(s) {
  return String(s || '').trim().toUpperCase();
}

function text(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function toDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseCheckinTime(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s || s === 'null' || s === '0000-00-00 00:00:00') return null;
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function mapAttendanceFromCheckin(checkInTimeRaw) {
  const checkin = parseCheckinTime(checkInTimeRaw);
  if (checkin) return { attendanceStatus: 'attended', participatedAt: checkin };
  return { attendanceStatus: 'registered', participatedAt: null };
}

function buildEventId(consultationTimeId) {
  return `ewl-${consultationTimeId}`;
}

function buildSourceRef(consultationTimeId) {
  return `${SOURCE_REF_PREFIX}:${consultationTimeId}`;
}

function attendanceMatchKey(studentId, eventName, eventDate, timePeriodName) {
  return [
    normStudentId(studentId),
    text(eventName) || '',
    toDateOnly(eventDate) || '',
    text(timePeriodName) || ''
  ].join('|');
}

/**
 * 活動日優先序（嚴禁把報名日當活動日）：
 * 1) EventDate（活動舉辦日）
 * 2) TargetDate（部分 API 別名）
 * 3) ReservationDate（僅在完全沒有活動日時 fallback；多半是報名日）
 */
function resolveEventDate(raw) {
  return (
    toDateOnly(raw.EventDate)
    || toDateOnly(raw.TargetDate)
    || toDateOnly(raw.ReservationDate)
    || null
  );
}

/**
 * 預設同步窗：至少回溯 lookbackDays，並延伸到本學期開始日，
 * 讓課堂加分所計的寫作工坊時數整學期都跟得上來源端。
 * 向前看到 lookaheadDays。篩選語意是活動日。
 */
function defaultDateWindow(now = new Date(), lookbackDays = 14, lookaheadDays = 60) {
  const start = new Date(now);
  start.setDate(start.getDate() - lookbackDays);
  const end = new Date(now);
  end.setDate(end.getDate() + lookaheadDays);
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  let startDate = fmt(start);
  const semesterId = semesterIdFromDate(now);
  const semesterStart = semesterId && SEMESTER_RANGES[semesterId]
    ? SEMESTER_RANGES[semesterId].start
    : null;
  if (semesterStart && semesterStart < startDate) startDate = semesterStart;
  return { startDate, endDate: fmt(end) };
}

async function loadOrPrepareStudent(studentId, nameZh, dryRun, transaction) {
  const sid = normStudentId(studentId);
  if (!sid) return { student: null, wouldCreateStudent: false };
  let row = await Student.findOne({ where: { studentId: sid }, transaction });
  if (row) return { student: row, wouldCreateStudent: false };
  if (dryRun) return { student: null, wouldCreateStudent: true };
  const display = (nameZh && String(nameZh).trim()) || sid;
  row = await Student.create(
    {
      studentId: sid,
      nameZh: display.slice(0, 120),
      nameEn: null,
      status: 'active'
    },
    { transaction }
  );
  return { student: row, wouldCreateStudent: true };
}

function buildAttendanceIndex(attendanceRows = []) {
  const byFull = new Map();
  const byStudentEventDate = new Map();
  const fullCounts = new Map();
  const softCounts = new Map();
  for (const row of attendanceRows) {
    const studentId = normStudentId(row.StudentNo);
    const eventName = text(row.EventName) || text(row.TargetName) || '';
    const eventDate = toDateOnly(row.EventDate) || toDateOnly(row.TargetDate);
    const timePeriodName = text(row.TimePeriodName) || '';
    const payload = {
      checkInTime: text(row.CheckInTime),
      isCheckedIn: row.IsCheckedIn === true || row.IsCheckedIn === 'true' || !!text(row.CheckInTime),
      eventDate,
      eventName,
      timePeriodName
    };
    if (!studentId) continue;
    const fullKey = attendanceMatchKey(studentId, eventName, eventDate, timePeriodName);
    fullCounts.set(fullKey, (fullCounts.get(fullKey) || 0) + 1);
    byFull.set(fullKey, payload);
    const softKey = attendanceMatchKey(studentId, eventName, eventDate, '');
    softCounts.set(softKey, (softCounts.get(softKey) || 0) + 1);
    if (!byStudentEventDate.has(softKey)) byStudentEventDate.set(softKey, payload);
  }
  return { byFull, byStudentEventDate, fullCounts, softCounts };
}

function findAttendanceMatch(index, reservationRow, eventDate) {
  if (!index) return null;
  const studentId = reservationRow.StudentNo;
  const eventName = text(reservationRow.EventName) || text(reservationRow.Name) || '';
  const timePeriodName = text(reservationRow.TimePeriodName) || '';
  const fullKey = attendanceMatchKey(studentId, eventName, eventDate, timePeriodName);
  const fullCount = index.fullCounts
    ? (index.fullCounts.get(fullKey) || 0)
    : (index.byFull.has(fullKey) ? 1 : 0);
  // 同一鍵超過一筆時不猜，避免把別人的簽到時數算進來。
  if (fullCount === 1 && index.byFull.has(fullKey)) return index.byFull.get(fullKey);
  if (fullCount > 1) return null;
  const softKey = attendanceMatchKey(studentId, eventName, eventDate, '');
  const softCount = index.softCounts ? (index.softCounts.get(softKey) || 0) : 0;
  // 僅在該生該日該活動只有一筆簽到時，才忽略時段名稱差異。
  if (softCount === 1 && index.byStudentEventDate.has(softKey)) {
    return index.byStudentEventDate.get(softKey);
  }
  return null;
}

function normalizeReservationRow(raw, attendanceIndex = null) {
  const consultationTimeId = raw.ConsultationTimeID != null ? Number(raw.ConsultationTimeID) : NaN;
  if (!Number.isFinite(consultationTimeId) || consultationTimeId <= 0) return null;
  const studentId = normStudentId(raw.StudentNo);
  if (!studentId) return null;

  const reservationDate = toDateOnly(raw.ReservationDate);
  const eventDate = resolveEventDate(raw);
  const attendance = findAttendanceMatch(attendanceIndex, raw, eventDate);
  const checkInTime = text(raw.CheckInTime) || attendance?.checkInTime || null;
  let { attendanceStatus, participatedAt } = mapAttendanceFromCheckin(checkInTime);
  if (isCancelledReservationStatus(text(raw.ReservationStatus))) {
    attendanceStatus = 'cancelled';
    participatedAt = null;
  }
  const startTime = text(raw.StartTime);
  const endTime = text(raw.EndTime);
  const hours = hoursFromStartEndTime(startTime, endTime);

  return {
    consultationTimeId,
    studentId,
    studentName: text(raw.StudentName),
    eventName: text(raw.EventName) || text(raw.Name) || 'EWL 活動',
    eventDate,
    reservationDate,
    startTime,
    endTime,
    hours,
    timePeriodName: text(raw.TimePeriodName),
    location: text(raw.Location),
    counselorName: text(raw.CounselorName),
    reservationStatus: text(raw.ReservationStatus),
    checkInTime,
    attendanceStatus,
    participatedAt,
    semesterId: eventDate ? semesterIdFromDate(eventDate) : null,
    eventId: buildEventId(consultationTimeId),
    sourceRef: buildSourceRef(consultationTimeId)
  };
}

function noteAffectedStudent(stats, studentId) {
  if (!stats._affectedSet) stats._affectedSet = new Set();
  if (studentId) stats._affectedSet.add(studentId);
}

/**
 * 新 payload 有開始與結束時間就重算時數；缺時段時保留既有時數，避免一次不完整回應把課堂分數洗成 0。
 */
function mergeDurationFields(existingMeta, normalized) {
  const prev = existingMeta && typeof existingMeta === 'object' ? existingMeta : {};
  const nextStart = normalized.startTime || null;
  const nextEnd = normalized.endTime || null;
  if (nextStart && nextEnd) {
    const computed = hoursFromStartEndTime(nextStart, nextEnd);
    return {
      startTime: nextStart,
      endTime: nextEnd,
      hours: computed != null ? computed : (prev.hours != null ? prev.hours : null)
    };
  }
  const startTime = nextStart || prev.startTime || null;
  const endTime = nextEnd || prev.endTime || null;
  const recomputed = hoursFromStartEndTime(startTime, endTime);
  if (recomputed != null) return { startTime, endTime, hours: recomputed };
  return {
    startTime,
    endTime,
    hours: prev.hours != null ? prev.hours : (normalized.hours != null ? normalized.hours : null)
  };
}

/**
 * 出席狀態以寫作工坊為準。簽到 API 這次不可靠時，不把已出席改回已登記。
 */
function resolveSyncedAttendance(normalized, existing, attendanceReliable) {
  if (normalized.attendanceStatus === 'cancelled') {
    return { attendanceStatus: 'cancelled', participatedAt: null };
  }
  if (normalized.attendanceStatus === 'attended') {
    return {
      attendanceStatus: 'attended',
      participatedAt: normalized.participatedAt || null
    };
  }
  if (!attendanceReliable && existing && existing.attendanceStatus === 'attended') {
    return {
      attendanceStatus: 'attended',
      participatedAt: existing.participatedAt || null
    };
  }
  return { attendanceStatus: 'registered', participatedAt: null };
}

function participationWindowDate(row) {
  const meta = row && row.metaJson ? row.metaJson : {};
  return toDateOnly(meta.eventDate) || toDateOnly(row && row.participatedAt);
}

/**
 * 這次同步窗裡、來源端已不再回傳的 EWL 列。手動鎖定與已取消列不動。
 */
function planMissingCancellations(existingRows, seenSourceRefs, startDate, endDate) {
  const planned = [];
  const seen = seenSourceRefs || new Set();
  for (const row of existingRows || []) {
    const meta = row.metaJson || {};
    if (meta.syncManualLock === true) continue;
    if (row.attendanceStatus === 'cancelled') continue;
    const sourceRef = row.sourceRef;
    if (!sourceRef || !String(sourceRef).startsWith(`${SOURCE_REF_PREFIX}:`)) continue;
    if (seen.has(sourceRef)) continue;
    const eventDate = participationWindowDate(row);
    if (!eventDate || eventDate < startDate || eventDate > endDate) continue;
    planned.push(row);
  }
  return planned;
}

function sourceRefsFromReservationRows(rows) {
  const set = new Set();
  for (const row of rows || []) {
    const id = row && row.ConsultationTimeID != null ? Number(row.ConsultationTimeID) : NaN;
    if (Number.isFinite(id) && id > 0) set.add(buildSourceRef(id));
  }
  return set;
}

async function upsertEwlRows(rows, dryRun, transaction, stats, attendanceIndex = null, options = {}) {
  const attendanceReliable = options.attendanceReliable !== false;
  for (const row of rows) {
    const normalized = normalizeReservationRow(row, attendanceIndex);
    if (!normalized) {
      stats.skipped += 1;
      continue;
    }
    if (!normalized.eventDate) {
      stats.skipped += 1;
      pushErr(stats.errors, 'EWL_MISSING_EVENT_DATE', '缺少活動日（EventDate/TargetDate/ReservationDate）', {
        consultationTimeID: normalized.consultationTimeId,
        studentId: normalized.studentId
      });
      continue;
    }
    try {
      const existing = await ActivityParticipation.findOne({
        where: {
          studentId: normalized.studentId,
          eventId: normalized.eventId,
          sourceRef: normalized.sourceRef
        },
        transaction
      });

      const eventDateSource = toDateOnly(row.EventDate)
        ? 'EventDate'
        : (toDateOnly(row.TargetDate) ? 'TargetDate' : 'ReservationDate');
      const duration = mergeDurationFields(existing && existing.metaJson, normalized);
      const attendance = resolveSyncedAttendance(normalized, existing, attendanceReliable);
      const previousMeta = existing && existing.metaJson ? existing.metaJson : {};

      const metaJson = {
        source: 'ewl_api',
        consultationTimeID: normalized.consultationTimeId,
        eventName: normalized.eventName,
        resourceType: mapEwlEventNameToResourceType(normalized.eventName),
        // 活動舉辦日：必須來自 EventDate（或 TargetDate）；ReservationDate 僅 fallback
        eventDate: normalized.eventDate,
        eventDateSource,
        reservationDate: normalized.reservationDate,
        startTime: duration.startTime,
        endTime: duration.endTime,
        hours: duration.hours,
        timePeriodName: normalized.timePeriodName,
        location: normalized.location,
        counselorName: normalized.counselorName,
        reservationStatus: normalized.reservationStatus || previousMeta.reservationStatus || null,
        checkInTime: normalized.checkInTime || (
          attendance.attendanceStatus === 'attended' ? (previousMeta.checkInTime || null) : null
        ),
        sync: true,
        reconciledMissing: false
      };

      if (existing) {
        if (existing.metaJson && existing.metaJson.syncManualLock === true) {
          stats.skipped += 1;
          continue;
        }
        noteAffectedStudent(stats, normalized.studentId);
        if (dryRun) {
          stats.updated += 1;
          continue;
        }
        await existing.update(
          {
            semesterId: normalized.semesterId || existing.semesterId,
            activityType: ACTIVITY_TYPE,
            attendanceStatus: attendance.attendanceStatus,
            participatedAt: attendance.participatedAt,
            metaJson: {
              ...(existing.metaJson || {}),
              ...metaJson
            }
          },
          { transaction }
        );
        stats.updated += 1;
        continue;
      }

      const { student, wouldCreateStudent } = await loadOrPrepareStudent(
        normalized.studentId,
        normalized.studentName,
        dryRun,
        transaction
      );
      noteAffectedStudent(stats, normalized.studentId);
      if (dryRun && wouldCreateStudent) {
        stats.inserted += 1;
        continue;
      }
      if (!student) {
        stats.skipped += 1;
        continue;
      }
      if (dryRun) {
        stats.inserted += 1;
        continue;
      }
      await ActivityParticipation.create(
        {
          studentPk: student.id,
          studentId: normalized.studentId,
          semesterId: normalized.semesterId,
          eventId: normalized.eventId,
          activityType: ACTIVITY_TYPE,
          attendanceStatus: attendance.attendanceStatus,
          participatedAt: attendance.participatedAt,
          sourceRef: normalized.sourceRef,
          metaJson
        },
        { transaction }
      );
      stats.inserted += 1;
    } catch (e) {
      pushErr(stats.errors, 'EWL_ROW', e.message, {
        consultationTimeID: row?.ConsultationTimeID || null,
        studentId: row?.StudentNo || null
      });
    }
  }
}

async function reconcileMissingEwlRows({
  seenSourceRefs,
  startDate,
  endDate,
  studentId,
  dryRun,
  transaction,
  stats,
  fetchComplete,
  fetchedCount
}) {
  if (!fetchComplete) {
    stats.reconcileSkipped = 'incomplete_fetch';
    return;
  }
  // 全校回傳 0 筆時不整批撤回，避免一次空回應清掉所有課堂時數。
  // 指定學號且完整回傳 0 筆，代表這位學生在窗內已沒有預約。
  if (fetchedCount <= 0 && !studentId) {
    stats.reconcileSkipped = 'empty_fetch';
    return;
  }
  const where = {
    activityType: ACTIVITY_TYPE,
    sourceRef: { [Op.like]: `${SOURCE_REF_PREFIX}:%` }
  };
  if (studentId) where.studentId = normStudentId(studentId);
  const existingRows = await ActivityParticipation.findAll({ where, transaction });
  const planned = planMissingCancellations(existingRows, seenSourceRefs, startDate, endDate);
  for (const row of planned) {
    noteAffectedStudent(stats, normStudentId(row.studentId));
    if (dryRun) {
      stats.reconciled += 1;
      continue;
    }
    const meta = row.metaJson || {};
    await row.update({
      attendanceStatus: 'cancelled',
      participatedAt: null,
      metaJson: {
        ...meta,
        reservationStatus: '同步未見',
        previousReservationStatus: meta.reservationStatus || null,
        reconciledMissing: true,
        sync: true
      }
    }, { transaction });
    stats.reconciled += 1;
  }
}

/**
 * 從 EWL ReservationInfo（+ AttendanceInfo 簽到補強）同步至 activity_participations。
 *
 * @param {{
 *   startDate?: string,
 *   endDate?: string,
 *   studentId?: string,
 *   dryRun?: boolean,
 *   lookbackDays?: number,
 *   lookaheadDays?: number,
 *   fetchImpl?: typeof fetch,
 *   rebuildAnalytics?: boolean
 * }} opts
 */
async function syncEwlReservations(opts = {}) {
  const dryRun = opts.dryRun === true;
  // 預設不同步等待 rebuild（避免 HTTP timeout）；CLI／controller 可顯式開啟或背景觸發
  const rebuildAnalytics = opts.rebuildAnalytics === true && !dryRun;
  const window = (opts.startDate && opts.endDate)
    ? { startDate: String(opts.startDate).slice(0, 10), endDate: String(opts.endDate).slice(0, 10) }
    : defaultDateWindow(new Date(), opts.lookbackDays ?? 14, opts.lookaheadDays ?? 60);

  const query = {
    startDate: window.startDate,
    endDate: window.endDate,
    studentId: opts.studentId ? normStudentId(opts.studentId) : undefined
  };
  const fetchOpts = { fetchImpl: opts.fetchImpl };

  let attendanceFetchFailed = false;
  const [fetchResult, attendanceResult] = await Promise.all([
    fetchReservationInfo(query, fetchOpts),
    fetchAttendanceInfo(query, fetchOpts).catch(() => {
      attendanceFetchFailed = true;
      return { rows: [], totalCount: 0, pagesFetched: 0, complete: false };
    })
  ]);
  const attendanceReliable = !attendanceFetchFailed && attendanceResult.complete === true;
  const attendanceIndex = buildAttendanceIndex(attendanceResult.rows || []);
  const seenSourceRefs = sourceRefsFromReservationRows(fetchResult.rows);

  const stats = emptyStats();
  const run = async (transaction) => {
    await upsertEwlRows(fetchResult.rows, dryRun, transaction, stats, attendanceIndex, {
      attendanceReliable
    });
    await reconcileMissingEwlRows({
      seenSourceRefs,
      startDate: window.startDate,
      endDate: window.endDate,
      studentId: opts.studentId,
      dryRun,
      transaction,
      stats,
      fetchComplete: fetchResult.complete === true,
      fetchedCount: fetchResult.rows.length
    });
  };

  if (dryRun) {
    await run(null);
  } else {
    const t = await sequelize.transaction();
    try {
      await run(t);
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }

  const affectedStudentIds = stats._affectedSet ? [...stats._affectedSet] : [];
  delete stats._affectedSet;
  stats.affectedStudentIds = affectedStudentIds;

  let analyticsRebuild = null;
  if (rebuildAnalytics && affectedStudentIds.length) {
    const { rebuildAnalyticsInBatches } = require('./analytics/analyticRebuildService');
    analyticsRebuild = await rebuildAnalyticsInBatches({
      scope: 'ewl-sync',
      studentIds: affectedStudentIds,
      batchSize: opts.rebuildBatchSize || 50
    });
  }

  return {
    dryRun,
    startDate: window.startDate,
    endDate: window.endDate,
    studentId: opts.studentId ? normStudentId(opts.studentId) : null,
    fetched: fetchResult.rows.length,
    reportedTotalCount: fetchResult.totalCount,
    pagesFetched: fetchResult.pagesFetched,
    attendanceFetched: attendanceResult.rows?.length || 0,
    ...stats,
    affectedStudentCount: affectedStudentIds.length,
    analyticsRebuild,
    errorCount: stats.errors.length
  };
}

module.exports = {
  SOURCE_REF_PREFIX,
  ACTIVITY_TYPE,
  defaultDateWindow,
  resolveEventDate,
  normalizeReservationRow,
  buildAttendanceIndex,
  isCancelledReservationStatus,
  mergeDurationFields,
  resolveSyncedAttendance,
  planMissingCancellations,
  syncEwlReservations
};
