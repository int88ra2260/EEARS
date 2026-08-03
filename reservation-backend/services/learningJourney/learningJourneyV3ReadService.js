'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  EtEnrollmentSnapshot,
  EtSemesterStudentBestSkill,
  Student,
  EtExamAttempt,
  EtExamAttemptSkillScore,
  ActivityParticipation,
  Course,
  ExamRegistration,
  BestepAttendance,
  BestepExamScore
} = require('../../models');
const { getStudentBestSkillsWithSource, getStudentsBestSkillsMap, SKILLS } = require('./bestSkillService');
const { getCefrFromRank } = require('./utils/cefr');
const {
  fetchReservationActivityRows,
  syncStudentActivitiesFromReservations
} = require('./syncService');
const { loadStudentCourseRecords } = require('./courseRecordService');
const { isEventDateInSemester } = require('./utils/semesterEventFilter');

const B2_RANK = 4;
const EMPTY_SKILLS = { listening: null, reading: null, speaking: null, writing: null };
const VALID_SORT_BY = new Set(['studentId', 'studentName', 'department', 'grade', 'listening', 'reading', 'speaking', 'writing']);
const VALID_SORT_ORDER = new Set(['asc', 'desc']);
const SKILL_SORT_KEYS = new Set(['listening', 'reading', 'speaking', 'writing']);
const ACTIVITY_LABELS = {
  ET: 'English Table',
  EC: 'English Club',
  IF: 'International Forum',
  JT: 'Job Talk',
  EWL: 'English Writing Lab'
};
const ACTIVITY_SKILL_MAP = {
  ET: ['listening', 'speaking'],
  EC: ['speaking'],
  IF: ['listening', 'reading'],
  JT: ['listening', 'speaking'],
  EWL: ['writing']
};
const EMPTY_REASONS = {
  NO_RECORDS: 'NO_RECORDS',
  NO_SEMESTER_SELECTED: 'NO_SEMESTER_SELECTED',
  NO_ENROLLMENT_SNAPSHOT: 'NO_ENROLLMENT_SNAPSHOT',
  NO_ACTIVITY_PARTICIPATION: 'NO_ACTIVITY_PARTICIPATION',
  NO_COURSE_RECORDS: 'NO_COURSE_RECORDS',
  NO_EXAM_ATTEMPTS: 'NO_EXAM_ATTEMPTS',
  NO_BESTEP_RECORDS: 'NO_BESTEP_RECORDS',
  PROJECTION_NOT_BUILT: 'PROJECTION_NOT_BUILT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  API_ERROR: 'API_ERROR',
  UNKNOWN: 'UNKNOWN'
};

function normSid(v) {
  return String(v || '').trim().toUpperCase();
}

function text(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function examDateOfAttempt(att) {
  return text(att.testDate || att.examDate);
}

function examTypeOfAttempt(att) {
  return text(att.testType || att.examType || att.sourceType || att.source);
}

function buildAttemptSkills(skillRows) {
  const skills = { ...EMPTY_SKILLS };
  for (const row of skillRows || []) {
    const j = typeof row.toJSON === 'function' ? row.toJSON() : row;
    if (!SKILLS.includes(j.skill)) continue;
    skills[j.skill] = {
      score: j.rawScore == null ? null : String(j.rawScore),
      cefr: j.cefr || null
    };
  }
  return skills;
}

function buildWarning(section, code, message) {
  return { section, code, message };
}

function hasAnyBestSkill(bestSkills) {
  return SKILLS.some((skill) => {
    const cell = bestSkills?.[skill];
    return !!(cell && (cell.cefr || Number(cell.rank || 0) > 0));
  });
}

function makeDataSource({ source, fallbackSource = null, fallbackUsed = false, reason = null, emptyReason = null }) {
  return {
    source,
    fallbackSource,
    fallbackUsed: !!fallbackUsed,
    reason,
    emptyReason
  };
}

function normalizeActivityType(type) {
  const t = String(type || '').trim();
  if (!t) return 'UNKNOWN';
  if (['ET', 'EC', 'IF', 'JT', 'EWL'].includes(t)) return t;
  const lower = t.toLowerCase();
  if (lower === 'english table') return 'ET';
  if (lower === 'english club') return 'EC';
  if (lower === 'international forum') return 'IF';
  if (lower === 'job talk') return 'JT';
  if (lower === 'english writing lab' || lower === 'ewl' || lower.includes('writing lab') || lower.includes('寫作工坊')) {
    return 'EWL';
  }
  return t;
}

function activityTypeLabel(type) {
  const normalized = normalizeActivityType(type);
  return ACTIVITY_LABELS[normalized] || type || normalized;
}

function abilitiesForActivity(type) {
  return ACTIVITY_SKILL_MAP[normalizeActivityType(type)] || [];
}

function mapReservationCheckinStatus(status, checkinTime) {
  const s = String(status || '').trim();
  if (s === '已簽到') return 'attended';
  if (s === '已登記違規') return 'absent';
  if (checkinTime) return 'attended';
  return 'registered';
}

function makeEmptyActivityStats() {
  return {
    checkedInCount: 0,
    absentCount: 0,
    cancelledCount: 0,
    registeredCount: 0,
    reservedCount: 0,
    totalParticipated: 0,
    totalRecords: 0
  };
}

function incrementActivityStats(stats, status) {
  stats.totalRecords += 1;
  if (status === 'attended') {
    stats.checkedInCount += 1;
    stats.reservedCount += 1;
    stats.totalParticipated += 1;
  } else if (status === 'absent') {
    stats.absentCount += 1;
    stats.reservedCount += 1;
  } else if (status === 'cancelled') {
    stats.cancelledCount += 1;
  } else {
    stats.registeredCount += 1;
    stats.reservedCount += 1;
  }
}

function mapParticipationRowsToActivityRecords(activityRows) {
  return activityRows.map((row) => ({
    eventId: row.eventId,
    eventName: row.metaJson?.eventName || null,
    eventDate: row.metaJson?.eventDate || null,
    activityType: normalizeActivityType(row.activityType),
    activityTypeLabel: activityTypeLabel(row.activityType),
    status: row.attendanceStatus,
    participatedAt: row.participatedAt || null,
    source: 'activity_participations'
  }));
}

async function enrichActivityRecordsWithEvents(activityRecords) {
  if (!activityRecords.length) return activityRecords;
  const eventIds = [...new Set(activityRecords
    .map((row) => String(row.eventId || '').trim())
    .filter((id) => id && /^\d+$/.test(id)))];
  if (!eventIds.length) return activityRecords;
  const eventRows = await sequelize.query(
    `
    SELECT CAST(id AS CHAR) AS eventId, name AS eventName, date AS eventDate, eventType
    FROM events
    WHERE id IN (:eventIds)
    `,
    { replacements: { eventIds }, type: sequelize.QueryTypes.SELECT }
  );
  const eventMap = new Map(eventRows.map((row) => [String(row.eventId), row]));
  return activityRecords.map((row) => {
    const ev = eventMap.get(String(row.eventId));
    const type = ev?.eventType ? normalizeActivityType(ev.eventType) : row.activityType;
    return {
      ...row,
      eventName: row.eventName || ev?.eventName || null,
      eventDate: row.eventDate || ev?.eventDate || null,
      activityType: type,
      activityTypeLabel: activityTypeLabel(type)
    };
  });
}

function mapReservationRowsToActivityRecords(reservationRows) {
  return reservationRows.map((row) => {
    const type = normalizeActivityType(row.eventType);
    return {
      eventId: row.eventId,
      eventName: row.eventName || null,
      eventDate: row.eventDate || null,
      activityType: type,
      activityTypeLabel: activityTypeLabel(type),
      reservationId: row.reservationId,
      reservationStatus: 'reserved',
      attendanceStatus: mapReservationCheckinStatus(row.checkinStatus, row.checkinTime),
      status: mapReservationCheckinStatus(row.checkinStatus, row.checkinTime),
      rawCheckinStatus: row.checkinStatus || null,
      checkInTime: row.checkinTime || null,
      participatedAt: row.checkinTime || null,
      source: 'reservations'
    };
  });
}

function buildActivityAggregates(activityRecords) {
  const activityMap = new Map();
  const activityStats = makeEmptyActivityStats();
  for (const row of activityRecords) {
    const type = normalizeActivityType(row.activityType);
    if (!activityMap.has(type)) {
      activityMap.set(type, {
        activityType: type,
        activityTypeLabel: activityTypeLabel(type),
        signedIn: 0,
        checkedInCount: 0,
        absent: 0,
        absentCount: 0,
        cancelled: 0,
        cancelledCount: 0
      });
    }
    const stat = activityMap.get(type);
    const status = text(row.status) || '';
    if (status === 'attended') {
      stat.signedIn += 1;
      stat.checkedInCount += 1;
    } else if (status === 'absent') {
      stat.absent += 1;
      stat.absentCount += 1;
    } else if (status === 'cancelled') {
      stat.cancelled += 1;
      stat.cancelledCount += 1;
    }
    incrementActivityStats(activityStats, status);
  }
  const activityAbilityMapping = activityRecords.map((row) => ({
    reservationId: row.reservationId || null,
    eventId: row.eventId,
    eventName: row.eventName,
    eventDate: row.eventDate,
    activityType: row.activityTypeLabel || row.activityType,
    activityTypeCode: row.activityType,
    abilities: abilitiesForActivity(row.activityType),
    reservationStatus: row.reservationStatus || null,
    attendanceStatus: row.attendanceStatus || row.status || null,
    status: row.status,
    checkInTime: row.checkInTime || null,
    source: row.source
  }));
  return {
    activityStats,
    activitySummary: { byType: [...activityMap.values()], records: activityAbilityMapping },
    activityAbilityMapping
  };
}

function filterParticipationRowsForSemester(rows, semesterId) {
  const sem = text(semesterId);
  if (!sem) return rows;
  return rows.filter((row) => {
    if (text(row.semesterId) === sem) return true;
    const eventDate = row.metaJson?.eventDate || null;
    if (eventDate && isEventDateInSemester(eventDate, sem)) return true;
    return false;
  });
}

async function queryParticipationRows(studentId, semesterId) {
  const sid = normSid(studentId);
  const sem = text(semesterId);
  const baseQuery = {
    where: { studentId: sid },
    order: [['participatedAt', 'DESC'], ['id', 'DESC']],
    limit: 300
  };
  if (!sem) {
    return ActivityParticipation.findAll(baseQuery);
  }
  const exactRows = await ActivityParticipation.findAll({
    ...baseQuery,
    where: { studentId: sid, semesterId: sem }
  });
  if (exactRows.length) return exactRows;
  const allRows = await ActivityParticipation.findAll(baseQuery);
  return filterParticipationRowsForSemester(allRows, sem);
}

async function loadStudentActivityData(studentId, semesterId, warnings, opts = {}) {
  const sid = normSid(studentId);
  const sem = text(semesterId);
  const studentName = text(opts.studentName);
  let activitySourceUnavailable = false;
  let activityFallbackUsed = false;
  let activityFallbackReason = null;
  let activityRecords = [];

  let activityRows = [];
  try {
    activityRows = await queryParticipationRows(sid, sem);
  } catch (_) {
    activitySourceUnavailable = true;
    warnings.push(buildWarning('activitySummary', 'ACTIVITY_PARTICIPATION_SOURCE_UNAVAILABLE', 'activity_participations 查詢失敗，已改查 reservations'));
  }

  const syncFromReservations = async (reservationRows = null) => {
    if (!sem || activitySourceUnavailable) return;
    const syncStats = await syncStudentActivitiesFromReservations({
      studentId: sid,
      semesterId: sem,
      dryRun: false,
      studentName,
      reservationRows
    });
    if (Array.isArray(syncStats.errors) && syncStats.errors.length) {
      warnings.push(buildWarning(
        'activitySummary',
        'ACTIVITY_SYNC_FROM_RESERVATIONS_PARTIAL',
        `活動參與同步部分失敗（${syncStats.errors.length} 筆）`
      ));
    }
    activityRows = await queryParticipationRows(sid, sem);
  };

  if (!activityRows.length) {
    try {
      await syncFromReservations();
    } catch (_) {
      warnings.push(buildWarning('activitySummary', 'ACTIVITY_SYNC_FROM_RESERVATIONS_FAILED', '活動參與同步失敗，已改查 reservations'));
    }
  }

  if (activityRows.length) {
    activityRecords = await enrichActivityRecordsWithEvents(mapParticipationRowsToActivityRecords(activityRows));
  } else {
    let reservationRows = [];
    try {
      reservationRows = await fetchReservationActivityRows({
        semesterId: sem,
        studentId: sid,
        limit: 300
      });
    } catch (_) {
      activitySourceUnavailable = true;
      warnings.push(buildWarning('activityAbilityMapping', 'ACTIVITY_MAPPING_SOURCE_UNAVAILABLE', 'Activity mapping source unavailable'));
    }

    if (reservationRows.length && sem && !activitySourceUnavailable) {
      try {
        await syncFromReservations(reservationRows);
      } catch (_) {
        warnings.push(buildWarning('activitySummary', 'ACTIVITY_SYNC_FROM_RESERVATIONS_FAILED', '活動參與同步失敗，已改查 reservations'));
      }
    }

    if (activityRows.length) {
      activityRecords = await enrichActivityRecordsWithEvents(mapParticipationRowsToActivityRecords(activityRows));
    } else if (reservationRows.length) {
      activityRecords = mapReservationRowsToActivityRecords(reservationRows);
      activityFallbackUsed = true;
      activityFallbackReason = activitySourceUnavailable
        ? 'ACTIVITY_PARTICIPATION_SOURCE_UNAVAILABLE'
        : 'NO_ACTIVITY_PARTICIPATIONS_FOUND';
    }
  }

  const aggregates = buildActivityAggregates(activityRecords);
  if (activityRecords.some((row) => row.source === 'activity_participations')) {
    activityFallbackUsed = false;
    activityFallbackReason = null;
  }

  return {
    ...aggregates,
    activityFallbackUsed,
    activityFallbackReason,
    activitySourceUnavailable
  };
}

function resolveRank(score) {
  const n = Number(score?.cefrRank);
  if (Number.isFinite(n) && n >= 1 && n <= 6) return n;
  return null;
}

function cacheCell(cefr, rank) {
  const r = Number(rank);
  if (!Number.isFinite(r) || r < 1) return null;
  return { cefr: cefr || getCefrFromRank(r), rank: r };
}

function emptyBestSkills() {
  return { ...EMPTY_SKILLS };
}

function bestSkillsFromCacheRow(row) {
  if (!row) return emptyBestSkills();
  const j = typeof row.toJSON === 'function' ? row.toJSON() : row;
  const best = emptyBestSkills();
  best.listening = cacheCell(j.bestListeningCefr, j.bestListeningCefrRank);
  best.reading = cacheCell(j.bestReadingCefr, j.bestReadingCefrRank);
  best.speaking = cacheCell(j.bestSpeakingCefr, j.bestSpeakingCefrRank);
  best.writing = cacheCell(j.bestWritingCefr, j.bestWritingCefrRank);
  if (SKILLS.includes(j.skill)) {
    best[j.skill] = cacheCell(j.cefr, j.cefrRank);
  }
  return best;
}

async function getBestSkillsCacheMap(semesterId, studentIds) {
  const ids = [...new Set((studentIds || []).map((s) => normSid(s)).filter(Boolean))];
  const map = new Map();
  for (const id of ids) map.set(id, emptyBestSkills());
  if (!ids.length) return map;

  if (!EtSemesterStudentBestSkill || typeof EtSemesterStudentBestSkill.findAll !== 'function') {
    return getStudentsBestSkillsMap(ids);
  }

  const rows = await EtSemesterStudentBestSkill.findAll({
    where: { semesterId, studentId: { [Op.in]: ids } },
    attributes: [
      'studentId',
      'skill',
      'cefr',
      'cefrRank',
      'bestListeningCefr',
      'bestListeningCefrRank',
      'bestReadingCefr',
      'bestReadingCefrRank',
      'bestSpeakingCefr',
      'bestSpeakingCefrRank',
      'bestWritingCefr',
      'bestWritingCefrRank'
    ]
  });

  for (const row of rows) {
    const j = typeof row.toJSON === 'function' ? row.toJSON() : row;
    const sid = normSid(j.studentId);
    if (!sid) continue;
    const existing = map.get(sid) || emptyBestSkills();
    const next = bestSkillsFromCacheRow(j);
    for (const skill of SKILLS) {
      if (next[skill]) existing[skill] = next[skill];
    }
    map.set(sid, existing);
  }
  return map;
}

function toRosterItem(snap) {
  return {
    studentId: String(snap.studentId || '').trim().toUpperCase(),
    studentName: snap.studentName,
    department: snap.department,
    college: snap.college,
    className: snap.className,
    grade: snap.grade == null ? null : String(snap.grade)
  };
}

function attachBestSkills(row, bestMap) {
  const best = bestMap.get(row.studentId) || emptyBestSkills();
  const attained = {};
  for (const sk of SKILLS) {
    const cell = best[sk];
    attained[sk] = !!(cell && Number(cell.rank) >= B2_RANK);
  }
  return { ...row, bestSkills: best, attained };
}

/**
 * @param {string} semesterId
 * @param {{
 *   limit?: number,
 *   offset?: number,
 *   keyword?: string,
 *   grade?: string,
 *   department?: string,
 *   b2Skill?: string,
 *   sortBy?: string,
 *   sortOrder?: string,
 *   allowedStudentIds?: string[]
 * }} opts
 */
async function getSemesterStudents(semesterId, opts = {}) {
  const sem = String(semesterId || '').trim();
  const lim = Math.min(Math.max(parseInt(opts.limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(opts.offset, 10) || 0, 0);
  const hasAllowedFilter = Array.isArray(opts.allowedStudentIds);
  const allowSet = new Set((opts.allowedStudentIds || []).map((s) => String(s || '').trim().toUpperCase()).filter(Boolean));
  const where = { semesterId: sem, isActive: true };
  if (hasAllowedFilter) {
    if (!allowSet.size) {
      return {
        semesterId: sem,
        items: [],
        pagination: { limit: lim, offset: off, total: 0, returned: 0 }
      };
    }
    where.studentId = { [Op.in]: [...allowSet] };
  }

  {
    const startedAt = Date.now();
    const keyword = String(opts.keyword || '').trim();
    if (keyword) {
      const like = `%${keyword}%`;
      where[Op.or] = [
        { studentId: { [Op.like]: like } },
        { studentName: { [Op.like]: like } }
      ];
    }

    const grade = String(opts.grade || '').trim();
    if (grade) {
      if (grade === '其他' || grade === 'å…¶ä»–') {
        where.grade = { [Op.notIn]: ['1', '2', '3', '4'] };
      } else {
        where.grade = grade;
      }
    }

    const department = String(opts.department || '').trim();
    if (department) where.department = department;

    const filterOptionStartedAt = Date.now();
    const filterOptionRows = await EtEnrollmentSnapshot.findAll({
      where: hasAllowedFilter
        ? { semesterId: sem, isActive: true, studentId: { [Op.in]: [...allowSet] } }
        : { semesterId: sem, isActive: true },
      attributes: ['grade', 'department'],
      raw: true
    });
    const gradeSet = new Set();
    const departmentSet = new Set();
    for (const row of filterOptionRows) {
      if (row.grade) gradeSet.add(String(row.grade));
      if (row.department) departmentSet.add(String(row.department));
    }
    const availableGrades = [...gradeSet].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    const availableDepartments = [...departmentSet].sort((a, b) => a.localeCompare(b, 'zh-Hant'));

    const b2Skill = String(opts.b2Skill || '').trim().toLowerCase();
    const sortBy = VALID_SORT_BY.has(String(opts.sortBy || '')) ? String(opts.sortBy) : 'studentId';
    const sortOrder = VALID_SORT_ORDER.has(String(opts.sortOrder || '').toLowerCase())
      ? String(opts.sortOrder).toLowerCase()
      : 'asc';
    const rosterAttributes = ['studentId', 'studentName', 'department', 'college', 'className', 'grade'];
    const needsCacheWidePass = SKILLS.includes(b2Skill) || SKILL_SORT_KEYS.has(sortBy);

    const compareNullable = (a, b) => {
      const aMissing = a == null || a === '';
      const bMissing = b == null || b === '';
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      return String(a).localeCompare(String(b), 'zh-Hant', { numeric: true, sensitivity: 'base' });
    };

    let total = 0;
    let pagedItems = [];

    if (needsCacheWidePass) {
      const rosterRows = await EtEnrollmentSnapshot.findAll({
        where,
        attributes: rosterAttributes,
        order: [['studentId', 'ASC']]
      });
      const keywordLower = keyword.toLowerCase();
      const rosterItems = rosterRows.map(toRosterItem).filter((x) => {
        if (!x.studentId) return false;
        if (keywordLower) {
          const sid = String(x.studentId || '').toLowerCase();
          const sname = String(x.studentName || '').toLowerCase();
          if (!sid.includes(keywordLower) && !sname.includes(keywordLower)) return false;
        }
        if (grade) {
          const rowGrade = String(x.grade || '').trim();
          if (grade === '其他' || grade === 'å…¶ä»–') {
            if (['1', '2', '3', '4'].includes(rowGrade)) return false;
          } else if (rowGrade !== grade) {
            return false;
          }
        }
        if (department && String(x.department || '').trim() !== department) return false;
        return true;
      });
      const bestMap = await getBestSkillsCacheMap(sem, rosterItems.map((r) => r.studentId));
      let items = rosterItems.map((row) => attachBestSkills(row, bestMap));

      if (SKILLS.includes(b2Skill)) {
        items = items.filter((row) => Number(row.bestSkills?.[b2Skill]?.rank || 0) >= B2_RANK);
      }

      items.sort((a, b) => {
        if (SKILL_SORT_KEYS.has(sortBy)) {
          const ra = Number(a.bestSkills?.[sortBy]?.rank || 0);
          const rb = Number(b.bestSkills?.[sortBy]?.rank || 0);
          const aMissing = ra <= 0;
          const bMissing = rb <= 0;
          if (aMissing !== bMissing) return aMissing ? 1 : -1;
          if (!aMissing && !bMissing && ra !== rb) return sortOrder === 'desc' ? (rb - ra) : (ra - rb);
        } else {
          const cmp = compareNullable(a[sortBy], b[sortBy]);
          if (cmp !== 0) return sortOrder === 'desc' ? -cmp : cmp;
        }
        return compareNullable(a.studentId, b.studentId);
      });

      total = items.length;
      pagedItems = items.slice(off, off + lim);
    } else {
      const orderColumn = VALID_SORT_BY.has(sortBy) && !SKILL_SORT_KEYS.has(sortBy) ? sortBy : 'studentId';
      let count;
      let rows;
      if (typeof EtEnrollmentSnapshot.findAndCountAll === 'function') {
        const result = await EtEnrollmentSnapshot.findAndCountAll({
          where,
          attributes: rosterAttributes,
          order: [[orderColumn, sortOrder.toUpperCase()], ['studentId', 'ASC']],
          limit: lim,
          offset: off
        });
        count = result.count;
        rows = result.rows;
      } else {
        const allRows = await EtEnrollmentSnapshot.findAll({
          where,
          attributes: rosterAttributes,
          order: [[orderColumn, sortOrder.toUpperCase()], ['studentId', 'ASC']]
        });
        count = allRows.length;
        rows = allRows.slice(off, off + lim);
      }
      total = count;
      const rosterItems = rows.map(toRosterItem).filter((x) => x.studentId);
      const bestMap = await getBestSkillsCacheMap(sem, rosterItems.map((r) => r.studentId));
      pagedItems = rosterItems.map((row) => attachBestSkills(row, bestMap));
    }

    if (process.env.NODE_ENV !== 'test') {
      console.info('[learningJourneyV3] getSemesterStudents ms', {
        semesterId: sem,
        limit: lim,
        offset: off,
        total,
        returned: pagedItems.length,
        cacheWidePass: needsCacheWidePass,
        filterOptionMs: Date.now() - filterOptionStartedAt,
        totalMs: Date.now() - startedAt
      });
    }

    return {
      semesterId: sem,
      items: pagedItems,
      pagination: { limit: lim, offset: off, total, returned: pagedItems.length },
      filters: {
        departments: availableDepartments,
        grades: availableGrades
      }
    };
  }
}

/**
 * @param {string} studentId
 * @param {{ semesterId?: string }} opts
 */
async function getStudentProfile(studentId, opts = {}) {
  const sid = normSid(studentId);
  const sem = text(opts.semesterId);
  if (!sid) {
    return { error: 'studentId 必填' };
  }

  const warnings = [];
  let latestSnapshot;
  let studentMaster;
  let bestSkills;
  let attempts;
  try {
    latestSnapshot = sem
      ? await EtEnrollmentSnapshot.findOne({
        where: { studentId: sid, semesterId: sem, isActive: true }
      })
      : await EtEnrollmentSnapshot.findOne({
        where: { studentId: sid, isActive: true },
        order: [['semesterId', 'DESC']]
      });
    [studentMaster, bestSkills, attempts] = await Promise.all([
      Student.findOne({ where: { studentId: sid } }),
      getStudentBestSkillsWithSource(sid),
      EtExamAttempt.findAll({
        where: { studentId: sid, status: 'valid' },
        include: [{ model: EtExamAttemptSkillScore, as: 'skillScores', required: false }],
        order: [
          ['testDate', 'DESC'],
          ['examDate', 'DESC'],
          ['id', 'DESC']
        ]
      })
    ]);
  } catch (e) {
    throw e;
  }

  const dedupe = new Set();
  const examAttempts = [];
  for (const a of attempts) {
    const examDate = examDateOfAttempt(a);
    const examType = examTypeOfAttempt(a);
    const key = `${sid}|${examDate || ''}|${examType || ''}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    examAttempts.push({
      id: a.id,
      examType,
      examDate,
      sourceType: a.sourceType || a.source || null,
      sourceBatchId: a.sourceBatchId || a.importBatchId || null,
      status: a.status || null,
      skills: buildAttemptSkills(a.skillScores || [])
    });
  }

  const trainingExamRecords = examAttempts.map((row) => ({ ...row }));

  let activitySummary = { byType: [], records: [] };
  let activityStats = makeEmptyActivityStats();
  let activityAbilityMapping = [];
  let activityFallbackUsed = false;
  let activityFallbackReason = null;
  const effectiveActivitySemester = sem || text(latestSnapshot?.semesterId);
  try {
    const activityData = await loadStudentActivityData(sid, effectiveActivitySemester, warnings, {
      studentName: latestSnapshot?.studentName || studentMaster?.nameZh || null
    });
    activitySummary = activityData.activitySummary;
    activityStats = activityData.activityStats;
    activityAbilityMapping = activityData.activityAbilityMapping;
    activityFallbackUsed = activityData.activityFallbackUsed;
    activityFallbackReason = activityData.activityFallbackReason;
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[LearningJourneyV3] student activity query', {
        studentId: sid,
        semesterId: effectiveActivitySemester,
        reservationCount: activityAbilityMapping.filter((row) => row.source === 'reservations').length,
        activityParticipationCount: activityAbilityMapping.filter((row) => row.source === 'activity_participations').length,
        activityStats
      });
    }
  } catch (_) {
    warnings.push(buildWarning('activityAbilityMapping', 'ACTIVITY_MAPPING_SOURCE_UNAVAILABLE', 'Activity mapping source unavailable'));
  }

  let courseRecords = [];
  try {
    courseRecords = await loadStudentCourseRecords(sid, { semesterId: sem || null });
    if (sem && courseRecords.length === 0) {
      const offeringsInSemester = await Course.count({ where: { semesterId: sem } });
      if (offeringsInSemester > 0) {
        warnings.push(buildWarning(
          'courseRecords',
          'COURSE_ENROLLMENT_NOT_IMPORTED',
          '本學期已有課程主檔，但此學生尚無修課選課紀錄；若教務系統已有選課，請執行修課紀錄匯入。'
        ));
      }
    }
  } catch (_) {
    warnings.push(buildWarning('courseRecords', 'COURSE_SOURCE_UNAVAILABLE', '修課資料來源暫時不可用'));
    courseRecords = [];
  }

  let bestepRecords = [];
  try {
    const [regRows, attendanceRows, scoreRows] = await Promise.all([
      ExamRegistration.findAll({
        where: sem ? { studentId: sid, semesterId: sem } : { studentId: sid },
        order: [['semesterId', 'DESC'], ['id', 'DESC']]
      }),
      BestepAttendance.findAll({
        where: sem ? { studentId: sid, semester: sem } : { studentId: sid },
        order: [['semester', 'DESC'], ['examDate', 'DESC']]
      }),
      BestepExamScore.findAll({
        where: sem ? { studentId: sid, semester: sem } : { studentId: sid },
        order: [['semester', 'DESC'], ['examDate', 'DESC']]
      })
    ]);
    const bestepMap = new Map();
    const bestepKey = (semesterId, scope) => `${semesterId || ''}::${scope || ''}`;
    for (const reg of regRows) {
      const key = bestepKey(reg.semesterId, reg.examScope);
      if (!bestepMap.has(key)) bestepMap.set(key, { semesterId: reg.semesterId, examScope: reg.examScope, registrationStatus: null, attendanceStatus: null, score: null });
      bestepMap.get(key).registrationStatus = reg.status || null;
    }
    for (const at of attendanceRows) {
      const key = bestepKey(at.semester, at.examType);
      if (!bestepMap.has(key)) bestepMap.set(key, { semesterId: at.semester, examScope: at.examType, registrationStatus: null, attendanceStatus: null, score: null });
      bestepMap.get(key).attendanceStatus = at.attended ? 'attended' : 'absent';
    }
    for (const sc of scoreRows) {
      const key = bestepKey(sc.semester, 'ALL');
      if (!bestepMap.has(key)) bestepMap.set(key, { semesterId: sc.semester, examScope: 'ALL', registrationStatus: null, attendanceStatus: null, score: null });
      bestepMap.get(key).score = {
        listening: sc.listeningScore == null ? null : String(sc.listeningScore),
        reading: sc.readingScore == null ? null : String(sc.readingScore),
        speaking: sc.speakingScore == null ? null : String(sc.speakingScore),
        writing: sc.writingScore == null ? null : String(sc.writingScore),
        overallLevel: sc.overallLevel || null
      };
    }
    bestepRecords = [...bestepMap.values()].sort((a, b) => String(b.semesterId || '').localeCompare(String(a.semesterId || '')));
  } catch (_) {
    warnings.push(buildWarning('bestepRecords', 'BESTEP_SOURCE_UNAVAILABLE', '培力英檢資料來源暫時不可用'));
    bestepRecords = [];
  }

  const studentPayload = {
    studentId: sid,
    studentName: latestSnapshot?.studentName || studentMaster?.nameZh || null,
    currentSemester: sem || latestSnapshot?.semesterId || null,
    department: latestSnapshot?.department || studentMaster?.departmentName || null,
    college: latestSnapshot?.college || null,
    className: latestSnapshot?.className || null,
    grade: latestSnapshot?.grade || (studentMaster?.grade == null ? null : String(studentMaster.grade))
  };
  const resolvedSemesterId = sem || latestSnapshot?.semesterId || null;
  const noStudentSource = !latestSnapshot && !studentMaster;
  const noBestSkills = !hasAnyBestSkill(bestSkills);
  const noActivityRecords = !Array.isArray(activityAbilityMapping) || activityAbilityMapping.length === 0;
  const noCourseRecords = !Array.isArray(courseRecords) || courseRecords.length === 0;
  const noBestepRecords = !Array.isArray(bestepRecords) || bestepRecords.length === 0;
  const noExamAttempts = !Array.isArray(examAttempts) || examAttempts.length === 0;
  const activityEmptyReason = noActivityRecords ? EMPTY_REASONS.NO_ACTIVITY_PARTICIPATION : null;
  const examEmptyReason = noExamAttempts ? EMPTY_REASONS.NO_EXAM_ATTEMPTS : null;
  const meta = {
    semesterId: resolvedSemesterId,
    requestedSemesterId: sem || null,
    generatedAt: new Date().toISOString(),
    dataSources: {
      student: makeDataSource({
        source: latestSnapshot ? 'et_enrollment_snapshots' : (studentMaster ? 'students' : 'none'),
        fallbackSource: 'students',
        fallbackUsed: !latestSnapshot && !!studentMaster,
        reason: !latestSnapshot && studentMaster ? 'NO_ENROLLMENT_SNAPSHOT_FOUND' : null,
        emptyReason: noStudentSource ? EMPTY_REASONS.NO_ENROLLMENT_SNAPSHOT : null
      }),
      bestSkills: makeDataSource({
        source: 'et_exam_attempt_skill_scores',
        fallbackUsed: false,
        emptyReason: noBestSkills ? EMPTY_REASONS.NO_EXAM_ATTEMPTS : null
      }),
      cefrTrend: makeDataSource({
        source: 'et_exam_attempts+et_exam_attempt_skill_scores',
        fallbackUsed: false,
        emptyReason: examEmptyReason
      }),
      examRecords: makeDataSource({
        source: 'et_exam_attempts+et_exam_attempt_skill_scores',
        fallbackUsed: false,
        emptyReason: examEmptyReason
      }),
      activitySummary: makeDataSource({
        source: 'activity_participations',
        fallbackSource: 'reservations',
        fallbackUsed: activityFallbackUsed,
        reason: activityFallbackReason,
        emptyReason: activityEmptyReason
      }),
      activityAbilityMapping: makeDataSource({
        source: 'activity_participations',
        fallbackSource: 'reservations',
        fallbackUsed: activityFallbackUsed,
        reason: activityFallbackReason,
        emptyReason: activityEmptyReason
      }),
      courseRecords: makeDataSource({
        source: 'course_enrollments+courses',
        fallbackUsed: false,
        emptyReason: noCourseRecords ? EMPTY_REASONS.NO_COURSE_RECORDS : null
      }),
      bestepRecords: makeDataSource({
        source: 'exam_registrations+bestep_attendance+bestep_exam_scores',
        fallbackUsed: false,
        emptyReason: noBestepRecords ? EMPTY_REASONS.NO_BESTEP_RECORDS : null
      })
    },
    emptyReasons: {
      student: noStudentSource ? EMPTY_REASONS.NO_ENROLLMENT_SNAPSHOT : null,
      bestSkills: noBestSkills ? EMPTY_REASONS.NO_EXAM_ATTEMPTS : null,
      cefrTrend: examEmptyReason,
      examRecords: examEmptyReason,
      activitySummary: activityEmptyReason,
      activityAbilityMapping: activityEmptyReason,
      courseRecords: noCourseRecords ? EMPTY_REASONS.NO_COURSE_RECORDS : null,
      bestepRecords: noBestepRecords ? EMPTY_REASONS.NO_BESTEP_RECORDS : null
    },
    warnings
  };

  return {
    student: studentPayload,
    bestSkills,
    examAttempts,
    examRecords: trainingExamRecords,
    trainingExamRecords,
    activitySummary,
    activityStats,
    activityAbilityMapping,
    activityRecords: activityAbilityMapping,
    courseRecords,
    bestepRecords,
    warnings,
    meta
  };
}

/**
 * 依 examDate 建立四技能趨勢：
 * - 依日期排序
 * - 同一天同技能取最高 CEFR(rank)
 * @param {string} studentId
 */
async function getStudentTrends(studentId) {
  const sid = normSid(studentId);
  if (!sid) return { error: 'studentId 必填' };

  const attempts = await EtExamAttempt.findAll({
    where: { studentId: sid, status: 'valid' },
    include: [{ model: EtExamAttemptSkillScore, as: 'skillScores', required: false }],
    order: [
      ['testDate', 'ASC'],
      ['examDate', 'ASC'],
      ['id', 'ASC']
    ]
  });

  const daySkillMax = new Map();
  for (const att of attempts) {
    const examDate = examDateOfAttempt(att);
    if (!examDate) continue;
    for (const row of att.skillScores || []) {
      const j = typeof row.toJSON === 'function' ? row.toJSON() : row;
      if (!SKILLS.includes(j.skill)) continue;
      const rank = resolveRank(j);
      if (!rank) continue;
      const key = `${examDate}|${j.skill}`;
      const prev = daySkillMax.get(key);
      if (!prev || rank > prev.rank) {
        daySkillMax.set(key, {
          examDate,
          skill: j.skill,
          rank,
          cefr: j.cefr || getCefrFromRank(rank)
        });
      }
    }
  }

  const series = { listening: [], reading: [], speaking: [], writing: [] };
  for (const item of daySkillMax.values()) {
    series[item.skill].push({
      examDate: item.examDate,
      rank: item.rank,
      cefr: item.cefr
    });
  }
  for (const sk of SKILLS) {
    series[sk].sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
  }

  return { studentId: sid, series, warnings: [] };
}

module.exports = {
  getSemesterStudents,
  getStudentProfile,
  getStudentTrends
};
