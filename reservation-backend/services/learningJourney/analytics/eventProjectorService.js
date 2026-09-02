'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  LjStudentEvent,
  Student,
  EtExamAttempt,
  EtExamAttemptSkillScore,
  ActivityParticipation,
  CourseEnrollment,
  Course,
  EtEnrollmentSnapshot,
} = require('../../../models');
const {
  RULE_VERSION,
  EVENT_TYPES,
  EVENT_STATUS,
  REASON_CODES,
  TIMING,
  SKILLS,
  SKILL_UNSPECIFIED,
} = require('../../../constants/learningJourneyEventConstants');
const { deriveEnrollmentTerm, computeSemIndex, parseSemesterId } = require('../utils/semIndexCalculator');
const { hoursForActivityType, hoursForActivityParticipation, hoursForCourse } = require('../utils/activityHours');
const { SEMESTER_RANGES, semesterIdFromDate } = require('../../../utils/semesterConstants');
const { normalizeCefr } = require('../utils/cefr');
const { normalizeAcademicCourseResourceType } = require('./academicCourseResourceType');

function normSid(v) {
  return String(v || '').trim().toUpperCase();
}

function mapEventTypeToActivityEnum(eventType) {
  const t = String(eventType || '').trim();
  if (!t) return null;
  if (['ET', 'EC', 'IF', 'JT'].includes(t)) return t;
  const lower = t.toLowerCase();
  if (lower === 'english table') return 'ET';
  if (lower === 'english club') return 'EC';
  if (lower === 'international forum') return 'IF';
  if (lower === 'job talk') return 'JT';
  return null;
}

function mapCheckinToAttendance(status) {
  if (status === '已簽到') return 'attended';
  if (status === '已登記違規') return 'absent';
  return 'registered';
}

function activityParticipationKey(studentId, eventId) {
  if (!studentId || eventId == null || eventId === '') return null;
  return `${normSid(studentId)}|${String(eventId)}`;
}

function semesterStartDate(semesterId) {
  const range = SEMESTER_RANGES[String(semesterId || '').trim()];
  return range ? range.start : null;
}

function semesterFromDate(dateStr) {
  return semesterIdFromDate(dateStr);
}

function mapExamStatus(attemptStatus, hasScore) {
  const s = String(attemptStatus || '').toLowerCase();
  if (s === 'duplicate') {
    return { status: EVENT_STATUS.EXCLUDED, excludeFlag: true, reasonCode: REASON_CODES.DUPLICATE };
  }
  if (s === 'invalid' || s === 'pending_review') {
    return { status: EVENT_STATUS.EXCLUDED, excludeFlag: true, reasonCode: REASON_CODES.INVALID_SCORE };
  }
  if (!hasScore) {
    return {
      status: EVENT_STATUS.REGISTERED_NO_SCORE,
      excludeFlag: false,
      reasonCode: REASON_CODES.REGISTERED_NO_SCORE,
    };
  }
  return { status: EVENT_STATUS.VALID, excludeFlag: false, reasonCode: null };
}

function inferExamTiming(semIndex) {
  if (semIndex == null) return TIMING.VOLUNTARY;
  if (semIndex <= 0) return TIMING.ENTRY;
  if (semIndex <= 3) return TIMING.IN_COURSE;
  return TIMING.VOLUNTARY;
}

async function loadEnrollmentMeta(studentIds) {
  const map = new Map();
  if (!studentIds.length) return map;

  const students = await Student.findAll({
    where: { studentId: { [Op.in]: studentIds } },
    attributes: ['studentId', 'enrollmentYear', 'collegeCode', 'departmentName', 'departmentCode'],
  });
  for (const row of students) {
    const sid = normSid(row.studentId);
    map.set(sid, {
      enrollmentTerm: deriveEnrollmentTerm(row.enrollmentYear),
      cohort: row.enrollmentYear ? String(row.enrollmentYear) : null,
      college: row.collegeCode || null,
      department: row.departmentName || row.departmentCode || null,
    });
  }

  const snapshots = await EtEnrollmentSnapshot.findAll({
    where: { studentId: { [Op.in]: studentIds }, isActive: true },
    attributes: ['studentId', 'grade', 'semesterId'],
    order: [['semesterId', 'ASC']],
  });
  for (const snap of snapshots) {
    const sid = normSid(snap.studentId);
    const meta = map.get(sid) || {};
    if (!meta.enrollmentTerm && snap.semesterId) {
      const parsed = parseSemesterId(snap.semesterId);
      if (parsed && snap.grade) {
        const gradeNum = Number(String(snap.grade).match(/\d+/)?.[0]);
        if (Number.isFinite(gradeNum) && gradeNum >= 1) {
          meta.enrollmentTerm = `${parsed.year - (gradeNum - 1)}-1`;
        }
      }
    }
    map.set(sid, meta);
  }
  return map;
}

async function projectExamEvents(studentIds, enrollmentMap) {
  const where = studentIds.length ? { studentId: { [Op.in]: studentIds } } : {};
  const attempts = await EtExamAttempt.findAll({
    where,
    include: [{ model: EtExamAttemptSkillScore, as: 'skillScores', required: false }],
    order: [['id', 'ASC']],
  });

  const rows = [];
  for (const att of attempts) {
    const sid = normSid(att.studentId);
    const examDate = String(att.testDate || att.examDate || '').slice(0, 10) || null;
    const instrument = String(att.testType || att.examType || att.sourceType || 'UNKNOWN').trim().toUpperCase();
    const enrollmentTerm = enrollmentMap.get(sid)?.enrollmentTerm || null;
    const academicTerm = semesterFromDate(examDate);
    const semIndex = computeSemIndex(enrollmentTerm, academicTerm);
    const timing = inferExamTiming(semIndex);
    const skillRows = att.skillScores || [];

    if (!skillRows.length) {
      const statusMeta = mapExamStatus(att.status, false);
      rows.push({
        studentId: sid,
        eventType: EVENT_TYPES.EXAM,
        eventDate: examDate,
        academicYear: parseSemesterId(academicTerm)?.year || null,
        academicTerm,
        semIndex,
        sourceSystem: 'et_exam_attempts',
        sourceRecordId: String(att.id),
        status: statusMeta.status,
        excludeFlag: statusMeta.excludeFlag,
        reasonCode: statusMeta.reasonCode,
        timing,
        instrument,
        skill: SKILL_UNSPECIFIED,
        rawScore: null,
        cefrLevel: null,
        hours: null,
        title: `${instrument} 英檢`,
        subtitle: '未出分',
        ruleVersion: RULE_VERSION,
        rawPayload: { attemptId: att.id, status: att.status },
      });
      continue;
    }

    for (const scoreRow of skillRows) {
      const skill = scoreRow.skill;
      if (!SKILLS.includes(skill)) continue;
      const rawScore = scoreRow.rawScore != null ? Number(scoreRow.rawScore) : null;
      const hasScore = rawScore != null && !Number.isNaN(rawScore);
      const statusMeta = mapExamStatus(att.status, hasScore);
      const cefr = normalizeCefr(scoreRow.cefr) || null;
      rows.push({
        studentId: sid,
        eventType: EVENT_TYPES.EXAM,
        eventDate: examDate,
        academicYear: parseSemesterId(academicTerm)?.year || null,
        academicTerm,
        semIndex,
        sourceSystem: 'et_exam_attempts',
        sourceRecordId: `${att.id}:${skill}`,
        status: statusMeta.status,
        excludeFlag: statusMeta.excludeFlag,
        reasonCode: statusMeta.reasonCode,
        timing,
        instrument,
        skill,
        rawScore: hasScore ? rawScore : null,
        cefrLevel: cefr,
        hours: null,
        title: `${instrument} ${skill}`,
        subtitle: hasScore ? String(rawScore) : '未出分',
        ruleVersion: RULE_VERSION,
        rawPayload: { attemptId: att.id, skillScoreId: scoreRow.id },
      });
    }
  }
  return rows;
}

async function projectActivityEvents(studentIds, enrollmentMap) {
  const where = studentIds.length ? { studentId: { [Op.in]: studentIds } } : {};
  const activities = await ActivityParticipation.findAll({ where, order: [['id', 'ASC']] });
  const rows = [];
  for (const row of activities) {
    const sid = normSid(row.studentId);
    const meta = row.metaJson || {};
    const eventDate = String(
      meta.eventDate || row.participatedAt || row.createdAt || ''
    ).slice(0, 10) || null;
    const academicTerm = row.semesterId || null;
    const enrollmentTerm = enrollmentMap.get(sid)?.enrollmentTerm || null;
    const semIndex = computeSemIndex(enrollmentTerm, academicTerm);
    const attended = row.attendanceStatus === 'attended';
    const hours = attended ? hoursForActivityParticipation(row.activityType, meta) : 0;
    const withdrawn = row.attendanceStatus === 'cancelled';
    rows.push({
      studentId: sid,
      eventType: EVENT_TYPES.ACTIVITY,
      eventDate,
      academicYear: parseSemesterId(academicTerm)?.year || null,
      academicTerm,
      semIndex,
      sourceSystem: 'activity_participations',
      sourceRecordId: String(row.id),
      status: withdrawn ? EVENT_STATUS.VOID : EVENT_STATUS.VALID,
      excludeFlag: withdrawn,
      reasonCode: withdrawn ? REASON_CODES.WITHDRAWN : null,
      timing: null,
      instrument: null,
      skill: SKILL_UNSPECIFIED,
      rawScore: null,
      cefrLevel: null,
      hours,
      title: meta.eventName || row.activityType || '活動',
      subtitle: row.attendanceStatus,
      ruleVersion: RULE_VERSION,
      rawPayload: {
        eventId: row.eventId,
        activityType: row.activityType,
        eventName: meta.eventName || null,
        resourceType: meta.resourceType || null,
        startTime: meta.startTime || null,
        endTime: meta.endTime || null
      },
    });
  }
  return rows;
}

async function fetchReservationActivityRows(studentIds = []) {
  const replacements = {};
  let studentWhere = '';
  const scopedIds = studentIds.map(normSid).filter(Boolean);
  if (scopedIds.length) {
    replacements.studentIds = scopedIds;
    studentWhere = 'AND UPPER(TRIM(r.studentId)) IN (:studentIds)';
  }

  return sequelize.query(
    `
    SELECT r.id AS reservationId, UPPER(TRIM(r.studentId)) AS studentId, r.checkinStatus, r.checkinTime,
           e.id AS eventId, e.name AS eventName, e.eventType, e.date AS eventDate, e.semesterId AS eventSemesterId
    FROM reservations r
    INNER JOIN events e ON r.eventId = e.id
    WHERE 1=1
    ${studentWhere}
    ORDER BY e.date ASC, r.id ASC
    `,
    { replacements, type: sequelize.QueryTypes.SELECT }
  );
}

async function projectReservationActivityEvents(studentIds, enrollmentMap, skipKeys = new Set()) {
  const resRows = await fetchReservationActivityRows(studentIds);
  const rows = [];
  for (const row of resRows) {
    const sid = normSid(row.studentId);
    const activityType = mapEventTypeToActivityEnum(row.eventType);
    if (!sid || !activityType) continue;

    const dedupeKey = activityParticipationKey(sid, row.eventId);
    if (dedupeKey && skipKeys.has(dedupeKey)) continue;

    const eventDate = String(row.eventDate || '').slice(0, 10) || null;
    const academicTerm = semesterFromDate(eventDate);
    const enrollmentTerm = enrollmentMap.get(sid)?.enrollmentTerm || null;
    const semIndex = computeSemIndex(enrollmentTerm, academicTerm);
    const attendanceStatus = mapCheckinToAttendance(row.checkinStatus);
    const attended = attendanceStatus === 'attended';
    const hours = attended ? hoursForActivityType(activityType) : 0;
    const cancelled = String(row.checkinStatus || '').includes('取消');

    rows.push({
      studentId: sid,
      eventType: EVENT_TYPES.ACTIVITY,
      eventDate,
      academicYear: parseSemesterId(academicTerm)?.year || null,
      academicTerm,
      semIndex,
      sourceSystem: 'reservations',
      sourceRecordId: `reservation:${row.reservationId}`,
      status: cancelled ? EVENT_STATUS.VOID : EVENT_STATUS.VALID,
      excludeFlag: cancelled || attendanceStatus === 'absent',
      reasonCode: cancelled ? REASON_CODES.WITHDRAWN : (attendanceStatus === 'absent' ? REASON_CODES.OTHER : null),
      timing: null,
      instrument: null,
      skill: SKILL_UNSPECIFIED,
      rawScore: null,
      cefrLevel: null,
      hours,
      title: row.eventName || activityType,
      subtitle: row.checkinStatus || attendanceStatus,
      ruleVersion: RULE_VERSION,
      rawPayload: {
        reservationId: row.reservationId,
        eventId: row.eventId,
        activityType,
        resourceType: activityType,
        eventName: row.eventName || null,
      },
    });
  }
  return rows;
}

async function projectCourseEvents(studentIds, enrollmentMap) {
  const where = studentIds.length ? { studentId: { [Op.in]: studentIds } } : {};
  const enrollments = await CourseEnrollment.findAll({
    where,
    include: [{ model: Course, as: 'course', required: false }],
    order: [['id', 'ASC']],
  });
  const rows = [];
  for (const row of enrollments) {
    const sid = normSid(row.studentId);
    const academicTerm = row.semesterId;
    const enrollmentTerm = enrollmentMap.get(sid)?.enrollmentTerm || null;
    const semIndex = computeSemIndex(enrollmentTerm, academicTerm);
    const eventDate = semesterStartDate(academicTerm)
      || String(row.updatedAt || row.createdAt || '').slice(0, 10)
      || null;
    const withdrawn = row.enrollmentStatus === 'withdrawn';
    const inProgress = row.passStatus === 'in_progress'
      || (row.enrollmentStatus === 'enrolled' && row.passStatus !== 'passed' && row.passStatus !== 'failed');
    const hours = hoursForCourse(row.course?.credits);
    const excluded = withdrawn || inProgress;
    const courseType = row.course?.courseType || null;
    const courseCode = row.course?.courseCode || null;
    const resourceType = normalizeAcademicCourseResourceType(courseType)
      || normalizeAcademicCourseResourceType(courseCode);
    rows.push({
      studentId: sid,
      eventType: EVENT_TYPES.COURSE,
      eventDate,
      academicYear: parseSemesterId(academicTerm)?.year || null,
      academicTerm,
      semIndex,
      sourceSystem: 'course_enrollments',
      sourceRecordId: String(row.id),
      status: withdrawn ? EVENT_STATUS.VOID : EVENT_STATUS.VALID,
      excludeFlag: excluded,
      reasonCode: withdrawn ? REASON_CODES.WITHDRAWN : (inProgress ? REASON_CODES.IN_PROGRESS : null),
      timing: null,
      instrument: null,
      skill: SKILL_UNSPECIFIED,
      rawScore: null,
      cefrLevel: null,
      hours,
      title: row.course?.courseName || row.course?.courseCode || '修課',
      subtitle: row.enrollmentStatus,
      ruleVersion: RULE_VERSION,
      rawPayload: {
        courseId: row.courseId,
        credits: row.course?.credits,
        courseType,
        courseCode,
        resourceType,
      },
    });
  }
  return rows;
}

async function projectBaselineEvents(studentIds, enrollmentMap) {
  const importedBaselines = studentIds.length
    ? await LjStudentEvent.findAll({
      where: {
        studentId: { [Op.in]: studentIds },
        eventType: EVENT_TYPES.BASELINE,
        sourceSystem: 'baseline_import',
        excludeFlag: false,
      },
      attributes: ['studentId'],
    })
    : [];
  const hasImportedBaseline = new Set(importedBaselines.map((e) => normSid(e.studentId)));

  const rows = [];
  for (const sid of studentIds) {
    if (hasImportedBaseline.has(sid)) continue;
    const meta = enrollmentMap.get(sid) || {};
    if (!meta.enrollmentTerm) continue;
    const parsed = parseSemesterId(meta.enrollmentTerm);
    const eventDate = parsed ? semesterStartDate(meta.enrollmentTerm) : null;
    rows.push({
      studentId: sid,
      eventType: EVENT_TYPES.BASELINE,
      eventDate,
      academicYear: parsed?.year || null,
      academicTerm: meta.enrollmentTerm,
      semIndex: computeSemIndex(meta.enrollmentTerm, meta.enrollmentTerm, { timing: TIMING.ENTRY }),
      sourceSystem: 'students',
      sourceRecordId: `${sid}:baseline`,
      status: EVENT_STATUS.VALID,
      excludeFlag: false,
      reasonCode: null,
      timing: TIMING.ENTRY,
      instrument: 'GSAT',
      skill: SKILL_UNSPECIFIED,
      rawScore: null,
      cefrLevel: null,
      hours: null,
      title: '入學基準',
      subtitle: meta.cohort ? `cohort ${meta.cohort}` : null,
      ruleVersion: RULE_VERSION,
      rawPayload: { enrollmentTerm: meta.enrollmentTerm, note: 'baseline_score placeholder; GSAT score pending import' },
    });
  }
  return rows;
}

function eventRowKey(row) {
  return `${row.sourceSystem}|${row.sourceRecordId}|${row.eventType}|${row.skill || ''}`;
}

const UPSERT_UPDATE_FIELDS = [
  'studentId',
  'eventDate',
  'academicYear',
  'academicTerm',
  'semIndex',
  'status',
  'excludeFlag',
  'reasonCode',
  'timing',
  'instrument',
  'skill',
  'rawScore',
  'cefrLevel',
  'hours',
  'title',
  'subtitle',
  'ruleVersion',
  'rawPayload',
];

async function pruneOrphanedCourseEnrollmentEvents(studentIds = []) {
  const where = {
    sourceSystem: 'course_enrollments',
    eventType: EVENT_TYPES.COURSE,
    status: EVENT_STATUS.VALID,
  };
  if (studentIds.length) {
    where.studentId = { [Op.in]: studentIds.map(normSid) };
  }

  const courseEvents = await LjStudentEvent.findAll({
    where,
    attributes: ['id', 'sourceRecordId'],
    raw: true,
  });
  if (!courseEvents.length) return { voided: 0 };

  const sourceRecordIds = [...new Set(
    courseEvents.map((row) => String(row.sourceRecordId || '').trim()).filter(Boolean)
  )];
  if (!sourceRecordIds.length) return { voided: 0 };

  const existingEnrollments = await CourseEnrollment.findAll({
    where: { id: { [Op.in]: sourceRecordIds } },
    attributes: ['id'],
    raw: true,
  });
  const existingIds = new Set(existingEnrollments.map((row) => String(row.id)));
  const orphanEventIds = courseEvents
    .filter((row) => !existingIds.has(String(row.sourceRecordId)))
    .map((row) => row.id);

  if (!orphanEventIds.length) return { voided: 0 };

  const [voided] = await LjStudentEvent.update(
    {
      status: EVENT_STATUS.VOID,
      excludeFlag: true,
      reasonCode: REASON_CODES.OTHER,
    },
    { where: { id: { [Op.in]: orphanEventIds } } },
  );

  return { voided };
}

async function upsertEventRows(rows) {
  if (!rows.length) return { inserted: 0, updated: 0, total: 0 };

  const CHUNK = 200;
  let inserted = 0;
  let updated = 0;

  for (let offset = 0; offset < rows.length; offset += CHUNK) {
    const chunk = rows.slice(offset, offset + CHUNK);
    const sourceRecordIds = [...new Set(chunk.map((row) => row.sourceRecordId))];
    const existingRows = sourceRecordIds.length
      ? await LjStudentEvent.findAll({
        where: { sourceRecordId: { [Op.in]: sourceRecordIds } },
        attributes: ['sourceSystem', 'sourceRecordId', 'eventType', 'skill'],
      })
      : [];

    const existingKeys = new Set(existingRows.map((row) => eventRowKey(row)));
    for (const row of chunk) {
      if (existingKeys.has(eventRowKey(row))) updated += 1;
      else inserted += 1;
    }

    await LjStudentEvent.bulkCreate(chunk, {
      updateOnDuplicate: UPSERT_UPDATE_FIELDS,
    });
  }

  return { inserted, updated, total: rows.length };
}

/**
 * 從現有資料表投影至 lj_student_events（upsert，不物理刪除）。
 * @param {{ studentIds?: string[] }} [opts]
 */
async function projectAllEvents(opts = {}) {
  let studentIds = (opts.studentIds || []).map(normSid).filter(Boolean);
  if (!studentIds.length) {
    const fromExams = await EtExamAttempt.findAll({ attributes: ['studentId'], group: ['studentId'], raw: true });
    const fromActivities = await ActivityParticipation.findAll({ attributes: ['studentId'], group: ['studentId'], raw: true });
    const fromCourses = await CourseEnrollment.findAll({ attributes: ['studentId'], group: ['studentId'], raw: true });
    const fromReservations = await sequelize.query(
      'SELECT DISTINCT UPPER(TRIM(studentId)) AS studentId FROM reservations',
      { type: sequelize.QueryTypes.SELECT }
    );
    const set = new Set([
      ...fromExams.map((r) => normSid(r.studentId)),
      ...fromActivities.map((r) => normSid(r.studentId)),
      ...fromCourses.map((r) => normSid(r.studentId)),
      ...fromReservations.map((r) => normSid(r.studentId)),
    ]);
    studentIds = [...set].filter(Boolean);
  }

  const enrollmentMap = await loadEnrollmentMeta(studentIds);
  const activityRows = await projectActivityEvents(studentIds, enrollmentMap);
  const participationKeys = new Set(
    activityRows
      .map((row) => activityParticipationKey(row.studentId, row.rawPayload?.eventId))
      .filter(Boolean)
  );
  const reservationActivityRows = await projectReservationActivityEvents(
    studentIds,
    enrollmentMap,
    participationKeys
  );
  const allRows = [
    ...(await projectBaselineEvents(studentIds, enrollmentMap)),
    ...(await projectExamEvents(studentIds, enrollmentMap)),
    ...activityRows,
    ...reservationActivityRows,
    ...(await projectCourseEvents(studentIds, enrollmentMap)),
  ];
  const upsert = await upsertEventRows(allRows);
  const pruned = await pruneOrphanedCourseEnrollmentEvents(studentIds);
  return {
    studentCount: studentIds.length,
    activityFromParticipations: activityRows.length,
    activityFromReservations: reservationActivityRows.length,
    ...upsert,
    prunedOrphanCourseEvents: pruned.voided,
  };
}

module.exports = {
  projectAllEvents,
  pruneOrphanedCourseEnrollmentEvents,
  projectReservationActivityEvents,
  projectActivityEvents,
  fetchReservationActivityRows,
  loadEnrollmentMeta,
  normSid,
  mapEventTypeToActivityEnum,
  mapCheckinToAttendance,
  activityParticipationKey,
};
