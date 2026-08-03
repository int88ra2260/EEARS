'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  EtEnrollmentSnapshot,
  EtSemesterStudentBestSkill,
  EtExamAttempt,
  ActivityParticipation,
  CourseEnrollment,
  ExamRegistration,
  BestepAttendance,
  BestepExamScore
} = require('../../models');
const { buildSemesterEventFilter } = require('./utils/semesterEventFilter');

function normSemesterId(value) {
  return String(value || '').trim();
}

function statusRank(status) {
  if (status === 'critical') return 3;
  if (status === 'warning') return 2;
  if (status === 'ok') return 1;
  return 0;
}

function maxStatus(checks) {
  return (checks || []).reduce((current, check) => (
    statusRank(check.status) > statusRank(current) ? check.status : current
  ), 'ok');
}

function pct(part, total) {
  const p = Number(part || 0);
  const t = Number(total || 0);
  if (!t) return 0;
  return Math.round((p / t) * 1000) / 10;
}

function buildCheck(key, label, status, count, message, extra = {}) {
  return {
    key,
    label,
    status,
    count: Number(count || 0),
    message,
    ...extra
  };
}

async function soft(label, warnings, fn, fallback = 0) {
  try {
    return await fn();
  } catch (err) {
    warnings.push({
      section: label,
      code: 'HEALTH_CHECK_SOURCE_UNAVAILABLE',
      message: `${label} 資料來源暫時不可用`,
      detail: err?.message || String(err)
    });
    return fallback;
  }
}

async function countDistinct(model, col, where) {
  if (!model || typeof model.count !== 'function') {
    throw new Error('model unavailable');
  }
  return model.count({ where, distinct: true, col });
}

async function getRosterStudentIds(semesterId, warnings) {
  return soft('ENROLLMENT_SNAPSHOT_ROSTER', warnings, async () => {
    const rows = await EtEnrollmentSnapshot.findAll({
      where: { semesterId, isActive: true },
      attributes: ['studentId'],
      raw: true
    });
    return rows.map((row) => String(row.studentId || '').trim().toUpperCase()).filter(Boolean);
  }, []);
}

async function countRosterStudentsWithExamAttempts(studentIds, warnings) {
  if (!studentIds.length) return 0;
  return soft('EXAM_ATTEMPTS', warnings, async () => countDistinct(EtExamAttempt, 'studentId', {
    studentId: { [Op.in]: studentIds },
    status: 'valid'
  }), 0);
}

async function countReservationFallbackOnly(semesterId, warnings) {
  return soft('RESERVATION_FALLBACK', warnings, async () => {
    const semesterFilter = buildSemesterEventFilter(semesterId);
    const rows = await sequelize.query(
      `
      SELECT COUNT(DISTINCT UPPER(TRIM(r.studentId))) AS count
      FROM reservations r
      INNER JOIN events e ON r.eventId = e.id
      ${semesterFilter.join}
      LEFT JOIN activity_participations ap
        ON UPPER(TRIM(ap.student_id)) = UPPER(TRIM(r.studentId))
       AND ap.semester_id = :semesterId
      WHERE ap.id IS NULL
      ${semesterFilter.where}
      `,
      { replacements: semesterFilter.replacements, type: sequelize.QueryTypes.SELECT }
    );
    return Number(rows?.[0]?.count || 0);
  }, 0);
}

async function getLearningJourneyV3SemesterHealth(semesterIdRaw, opts = {}) {
  const semesterId = normSemesterId(semesterIdRaw);
  const warnings = [];
  if (!semesterId) {
    return {
      semesterId,
      generatedAt: new Date().toISOString(),
      summary: { status: 'critical' },
      checks: [
        buildCheck('SEMESTER_ID', '學期代碼', 'critical', 0, 'semesterId 必填')
      ],
      actions: [],
      warnings
    };
  }

  const rosterStudentIds = await getRosterStudentIds(semesterId, warnings);
  const activeRosterCount = rosterStudentIds.length;
  const [
    studentsWithBestSkillProjection,
    studentsWithExamAttempts,
    studentsWithActivityParticipations,
    studentsWithReservationFallbackOnly,
    studentsWithCourseRecords,
    examRegistrationStudents,
    bestepAttendanceStudents,
    bestepScoreStudents
  ] = await Promise.all([
    soft('BEST_SKILL_PROJECTION', warnings, () => countDistinct(EtSemesterStudentBestSkill, 'studentId', { semesterId }), 0),
    countRosterStudentsWithExamAttempts(rosterStudentIds, warnings),
    soft('ACTIVITY_PARTICIPATIONS', warnings, () => countDistinct(ActivityParticipation, 'studentId', { semesterId }), 0),
    countReservationFallbackOnly(semesterId, warnings),
    soft('COURSE_RECORDS', warnings, () => countDistinct(CourseEnrollment, 'studentId', { semesterId }), 0),
    soft('BESTEP_EXAM_REGISTRATIONS', warnings, () => countDistinct(ExamRegistration, 'studentId', { semesterId }), 0),
    soft('BESTEP_ATTENDANCE', warnings, () => countDistinct(BestepAttendance, 'studentId', { semester: semesterId }), 0),
    soft('BESTEP_EXAM_SCORES', warnings, () => countDistinct(BestepExamScore, 'studentId', { semester: semesterId }), 0)
  ]);

  const studentsWithBestepRecords = Math.max(
    Number(examRegistrationStudents || 0),
    Number(bestepAttendanceStudents || 0),
    Number(bestepScoreStudents || 0)
  );

  const rosterStatus = activeRosterCount > 0 ? 'ok' : 'critical';
  const projectionCoverage = pct(studentsWithBestSkillProjection, activeRosterCount);
  const projectionStatus = activeRosterCount === 0
    ? 'critical'
    : studentsWithBestSkillProjection === 0
      ? 'critical'
      : studentsWithBestSkillProjection < activeRosterCount
        ? 'warning'
        : 'ok';
  const examStatus = studentsWithExamAttempts > 0 ? 'ok' : 'warning';
  const activityStatus = studentsWithActivityParticipations > 0
    ? (studentsWithReservationFallbackOnly > 0 ? 'warning' : 'ok')
    : (studentsWithReservationFallbackOnly > 0 ? 'warning' : 'warning');
  const courseStatus = studentsWithCourseRecords > 0 ? 'ok' : 'warning';
  const bestepStatus = studentsWithBestepRecords > 0 ? 'ok' : 'warning';

  const checks = [
    buildCheck(
      'ENROLLMENT_SNAPSHOT',
      '學生名冊快照',
      rosterStatus,
      activeRosterCount,
      activeRosterCount > 0 ? `此學期有 ${activeRosterCount} 位 active roster 學生。` : '此學期尚未建立 active 學生名冊快照。'
    ),
    buildCheck(
      'BEST_SKILL_PROJECTION',
      '四技能最佳成績 projection',
      projectionStatus,
      studentsWithBestSkillProjection,
      projectionStatus === 'ok'
        ? 'projection 覆蓋 active roster。'
        : `projection 覆蓋率 ${projectionCoverage}%，建議重建學期統計。`,
      { coverageRate: projectionCoverage }
    ),
    buildCheck(
      'EXAM_ATTEMPTS',
      '英檢成績紀錄',
      examStatus,
      studentsWithExamAttempts,
      studentsWithExamAttempts > 0
        ? `active roster 中有 ${studentsWithExamAttempts} 位學生具 valid exam attempt。`
        : 'active roster 中目前查無 valid exam attempt；可能尚未匯入或學生尚無紀錄。'
    ),
    buildCheck(
      'ACTIVITY_PARTICIPATIONS',
      '活動參與 canonical 紀錄',
      activityStatus,
      studentsWithActivityParticipations,
      studentsWithReservationFallbackOnly > 0
        ? `有 ${studentsWithReservationFallbackOnly} 位學生僅在 reservations/events 找到活動紀錄，可能需要同步 activity_participations。`
        : studentsWithActivityParticipations > 0
          ? 'activity_participations 有資料。'
          : '此學期查無 activity_participations；若本學期尚無活動，這不是系統錯誤。',
      { fallbackCount: studentsWithReservationFallbackOnly }
    ),
    buildCheck(
      'COURSE_RECORDS',
      '修課紀錄',
      courseStatus,
      studentsWithCourseRecords,
      studentsWithCourseRecords > 0 ? 'course_enrollments 有資料。' : '此學期尚無修課紀錄；可能尚未匯入或本學期無資料。'
    ),
    buildCheck(
      'BESTEP_RECORDS',
      '培力英檢紀錄',
      bestepStatus,
      studentsWithBestepRecords,
      studentsWithBestepRecords > 0 ? 'BESTEP 相關表有資料。' : '此學期尚無培力英檢紀錄；可能尚未匯入或本學期無資料。'
    )
  ];

  const summary = {
    status: maxStatus(checks),
    activeRosterCount,
    studentsWithBestSkillProjection,
    studentsWithExamAttempts,
    studentsWithActivityParticipations,
    studentsWithReservationFallbackOnly,
    studentsWithCourseRecords,
    studentsWithBestepRecords
  };

  const actions = [];
  if (opts.includeActions && activeRosterCount > 0 && studentsWithBestSkillProjection < activeRosterCount) {
    actions.push({
      key: 'REBUILD_PROJECTION',
      label: '重建學期統計',
      recommended: true,
      reason: `projection 覆蓋 ${studentsWithBestSkillProjection}/${activeRosterCount}，建議重建。`
    });
  }

  return {
    semesterId,
    generatedAt: new Date().toISOString(),
    summary,
    checks,
    actions,
    warnings
  };
}

module.exports = {
  getLearningJourneyV3SemesterHealth
};
