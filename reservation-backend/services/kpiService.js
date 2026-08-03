// services/kpiService.js
// Phase 2.5：KPI 統一層
//
// 母體：呼叫端傳入之 studentIds（多為 class_memberships 當學期名冊），非 EtEnrollmentSnapshot LJ active roster。
// participationRate / bestepPassRate 等為班級行政管理口徑，不得與 learningJourneyCoreKpi 之 canonical 達標混用。
// 詳見 docs/analytics-and-reports-metric-definitions.md。

const {
  EnglishTestRegistration,
  EnglishTableSurveyResponse,
  BestepAttendance,
  BestepExamScore,
  sequelize
} = require('../models');
const { Op, QueryTypes } = require('sequelize');
const { SEMESTER_RANGES } = require('../utils/semesterConstants');
const { isValidSemester } = require('../utils/semester');
const { isCountedExemptionApproval } = require('../utils/exemptionUtils');

function cleanStudentId(studentId) {
  if (!studentId) return null;
  return String(studentId).trim().toUpperCase().replace(/\s+/g, '');
}

function normalizeStudentIds(studentIds = []) {
  return [...new Set((studentIds || []).map(cleanStudentId).filter(Boolean))];
}

function toRate(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

async function buildKpiContext(studentIds, semester) {
  const sids = normalizeStudentIds(studentIds);
  const range = SEMESTER_RANGES[semester];
  if (!range) throw new Error('不支援的學期');

  if (sids.length === 0) {
    return {
      semester,
      studentIds: [],
      attendedCountByStudent: {},
      noShowCountByStudent: {},
      latestRegistrationByStudent: {},
      bestepAttendanceSummaryByStudent: {},
      scoreByStudent: {},
      surveyCompletedSet: new Set(),
      violationCountByStudent: {}
    };
  }

  const start = `${range.start} 00:00:00`;
  const end = `${range.end} 23:59:59`;

  const [
    attendedRows,
    noShowRows,
    violationRows,
    registrations,
    attendances,
    scores,
    surveyRows
  ] = await Promise.all([
    sequelize.query(
      `
      SELECT r.studentId, COUNT(r.id) AS attendedCountTotal
      FROM reservations r
      INNER JOIN events e ON r.eventId = e.id
      WHERE r.studentId IN (:sids)
        AND r.checkinStatus = '已簽到'
        AND e.date BETWEEN :startDate AND :endDate
      GROUP BY r.studentId
      `,
      { replacements: { sids, startDate: range.start, endDate: range.end }, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `
      SELECT r.studentId, COUNT(r.id) AS noShowCount
      FROM reservations r
      INNER JOIN events e ON r.eventId = e.id
      WHERE r.studentId IN (:sids)
        AND r.checkinStatus = '已登記違規'
        AND e.date BETWEEN :startDate AND :endDate
      GROUP BY r.studentId
      `,
      { replacements: { sids, startDate: range.start, endDate: range.end }, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `
      SELECT u.studentId, COUNT(*) AS violationCount
      FROM event_violations ev
      INNER JOIN Users u ON ev.userId = u.id
      WHERE u.studentId IN (:sids)
        AND ev.recordedAt >= :start
        AND ev.recordedAt <= :end
      GROUP BY u.studentId
      `,
      { replacements: { sids, start, end }, type: QueryTypes.SELECT }
    ),
    EnglishTestRegistration.findAll({
      where: { studentId: { [Op.in]: sids }, semester },
      order: [['updatedAt', 'DESC'], ['id', 'DESC']],
      raw: true
    }),
    BestepAttendance.findAll({
      where: { studentId: { [Op.in]: sids }, semester },
      attributes: ['studentId', 'examType', 'attended'],
      raw: true
    }),
    BestepExamScore.findAll({
      where: { studentId: { [Op.in]: sids }, semester },
      attributes: ['studentId', 'totalScore', 'passed'],
      raw: true
    }),
    EnglishTableSurveyResponse.findAll({
      where: { studentId: { [Op.in]: sids }, semester },
      attributes: ['studentId'],
      raw: true
    })
  ]);

  const attendedCountByStudent = {};
  attendedRows.forEach((r) => {
    const sid = cleanStudentId(r.studentId);
    if (sid) attendedCountByStudent[sid] = parseInt(r.attendedCountTotal, 10) || 0;
  });

  const noShowCountByStudent = {};
  noShowRows.forEach((r) => {
    const sid = cleanStudentId(r.studentId);
    if (sid) noShowCountByStudent[sid] = parseInt(r.noShowCount, 10) || 0;
  });

  const violationCountByStudent = {};
  violationRows.forEach((r) => {
    const sid = cleanStudentId(r.studentId);
    if (sid) violationCountByStudent[sid] = parseInt(r.violationCount, 10) || 0;
  });

  const latestRegistrationByStudent = {};
  registrations.forEach((reg) => {
    const sid = cleanStudentId(reg.studentId);
    if (!sid) return;
    if (!latestRegistrationByStudent[sid]) latestRegistrationByStudent[sid] = reg;
  });

  const bestepAttendanceSummaryByStudent = {};
  attendances.forEach((a) => {
    const sid = cleanStudentId(a.studentId);
    if (!sid) return;
    if (!bestepAttendanceSummaryByStudent[sid]) {
      bestepAttendanceSummaryByStudent[sid] = {
        lrAttended: false,
        swAttended: false
      };
    }
    if (a.examType === 'LR' && a.attended) bestepAttendanceSummaryByStudent[sid].lrAttended = true;
    if (a.examType === 'SW' && a.attended) bestepAttendanceSummaryByStudent[sid].swAttended = true;
  });

  const scoreByStudent = {};
  scores.forEach((s) => {
    const sid = cleanStudentId(s.studentId);
    if (!sid) return;
    scoreByStudent[sid] = {
      totalScore: s.totalScore != null ? Number(s.totalScore) : null,
      passed: !!s.passed
    };
  });

  const surveyCompletedSet = new Set(
    surveyRows
      .map((r) => cleanStudentId(r.studentId))
      .filter(Boolean)
  );

  return {
    semester,
    studentIds: sids,
    attendedCountByStudent,
    noShowCountByStudent,
    latestRegistrationByStudent,
    bestepAttendanceSummaryByStudent,
    scoreByStudent,
    surveyCompletedSet,
    violationCountByStudent
  };
}

/**
 * 批次建立多學期 KPI context（避免逐學期重打完整 SQL）
 * @param {string[]} studentIds
 * @param {string[]} semesters
 * @returns {Promise<Object<string, object>>} key: semester
 */
async function buildMultiSemesterKpiContexts(studentIds, semesters) {
  const sids = normalizeStudentIds(studentIds);
  const sems = [...new Set((semesters || []).filter((s) => !!SEMESTER_RANGES[s]))];
  const contexts = {};
  sems.forEach((sem) => {
    contexts[sem] = {
      semester: sem,
      studentIds: sids,
      attendedCountByStudent: {},
      noShowCountByStudent: {},
      latestRegistrationByStudent: {},
      bestepAttendanceSummaryByStudent: {},
      scoreByStudent: {},
      surveyCompletedSet: new Set(),
      violationCountByStudent: {}
    };
  });

  if (!sids.length || !sems.length) return contexts;

  const minStart = sems
    .map((sem) => SEMESTER_RANGES[sem].start)
    .sort()[0];
  const maxEnd = sems
    .map((sem) => SEMESTER_RANGES[sem].end)
    .sort()
    .slice(-1)[0];

  const [
    attendedRows,
    noShowRows,
    violationRows,
    registrations,
    attendances,
    scores,
    surveyRows
  ] = await Promise.all([
    sequelize.query(
      `
      SELECT r.studentId, e.date, COUNT(r.id) AS attendedCount
      FROM reservations r
      INNER JOIN events e ON r.eventId = e.id
      WHERE r.studentId IN (:sids)
        AND r.checkinStatus = '已簽到'
        AND e.date BETWEEN :minStart AND :maxEnd
      GROUP BY r.studentId, e.date
      `,
      { replacements: { sids, minStart, maxEnd }, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `
      SELECT r.studentId, e.date, COUNT(r.id) AS noShowCount
      FROM reservations r
      INNER JOIN events e ON r.eventId = e.id
      WHERE r.studentId IN (:sids)
        AND r.checkinStatus = '已登記違規'
        AND e.date BETWEEN :minStart AND :maxEnd
      GROUP BY r.studentId, e.date
      `,
      { replacements: { sids, minStart, maxEnd }, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `
      SELECT u.studentId, DATE(ev.recordedAt) AS recordedDate, COUNT(*) AS violationCount
      FROM event_violations ev
      INNER JOIN Users u ON ev.userId = u.id
      WHERE u.studentId IN (:sids)
        AND ev.recordedAt >= :startTs
        AND ev.recordedAt <= :endTs
      GROUP BY u.studentId, DATE(ev.recordedAt)
      `,
      {
        replacements: {
          sids,
          startTs: `${minStart} 00:00:00`,
          endTs: `${maxEnd} 23:59:59`
        },
        type: QueryTypes.SELECT
      }
    ),
    EnglishTestRegistration.findAll({
      where: { studentId: { [Op.in]: sids }, semester: { [Op.in]: sems } },
      order: [['semester', 'ASC'], ['updatedAt', 'DESC'], ['id', 'DESC']],
      raw: true
    }),
    BestepAttendance.findAll({
      where: { studentId: { [Op.in]: sids }, semester: { [Op.in]: sems } },
      attributes: ['studentId', 'semester', 'examType', 'attended'],
      raw: true
    }),
    BestepExamScore.findAll({
      where: { studentId: { [Op.in]: sids }, semester: { [Op.in]: sems } },
      attributes: ['studentId', 'semester', 'totalScore', 'passed'],
      raw: true
    }),
    EnglishTableSurveyResponse.findAll({
      where: { studentId: { [Op.in]: sids }, semester: { [Op.in]: sems } },
      attributes: ['studentId', 'semester'],
      raw: true
    })
  ]);

  const semesterByDate = (dateText) => {
    for (const sem of sems) {
      const r = SEMESTER_RANGES[sem];
      if (dateText >= r.start && dateText <= r.end) return sem;
    }
    return null;
  };

  attendedRows.forEach((r) => {
    const sid = cleanStudentId(r.studentId);
    const date = String(r.date).slice(0, 10);
    const sem = semesterByDate(date);
    if (!sid || !sem || !contexts[sem]) return;
    contexts[sem].attendedCountByStudent[sid] =
      (contexts[sem].attendedCountByStudent[sid] || 0) + (parseInt(r.attendedCount, 10) || 0);
  });

  noShowRows.forEach((r) => {
    const sid = cleanStudentId(r.studentId);
    const date = String(r.date).slice(0, 10);
    const sem = semesterByDate(date);
    if (!sid || !sem || !contexts[sem]) return;
    contexts[sem].noShowCountByStudent[sid] =
      (contexts[sem].noShowCountByStudent[sid] || 0) + (parseInt(r.noShowCount, 10) || 0);
  });

  violationRows.forEach((r) => {
    const sid = cleanStudentId(r.studentId);
    const date = String(r.recordedDate).slice(0, 10);
    const sem = semesterByDate(date);
    if (!sid || !sem || !contexts[sem]) return;
    contexts[sem].violationCountByStudent[sid] =
      (contexts[sem].violationCountByStudent[sid] || 0) + (parseInt(r.violationCount, 10) || 0);
  });

  registrations.forEach((reg) => {
    const sid = cleanStudentId(reg.studentId);
    const sem = reg.semester;
    if (!sid || !sem || !contexts[sem]) return;
    if (!contexts[sem].latestRegistrationByStudent[sid]) {
      contexts[sem].latestRegistrationByStudent[sid] = reg;
    }
  });

  attendances.forEach((a) => {
    const sid = cleanStudentId(a.studentId);
    const sem = a.semester;
    if (!sid || !sem || !contexts[sem]) return;
    if (!contexts[sem].bestepAttendanceSummaryByStudent[sid]) {
      contexts[sem].bestepAttendanceSummaryByStudent[sid] = { lrAttended: false, swAttended: false };
    }
    if (a.examType === 'LR' && a.attended) contexts[sem].bestepAttendanceSummaryByStudent[sid].lrAttended = true;
    if (a.examType === 'SW' && a.attended) contexts[sem].bestepAttendanceSummaryByStudent[sid].swAttended = true;
  });

  scores.forEach((s) => {
    const sid = cleanStudentId(s.studentId);
    const sem = s.semester;
    if (!sid || !sem || !contexts[sem]) return;
    contexts[sem].scoreByStudent[sid] = {
      totalScore: s.totalScore != null ? Number(s.totalScore) : null,
      passed: !!s.passed
    };
  });

  sems.forEach((sem) => {
    contexts[sem].surveyCompletedSet = new Set();
  });
  surveyRows.forEach((r) => {
    const sid = cleanStudentId(r.studentId);
    const sem = r.semester;
    if (!sid || !sem || !isValidSemester(sem) || !contexts[sem]) return;
    contexts[sem].surveyCompletedSet.add(sid);
  });

  return contexts;
}

async function getParticipationMetrics(studentIds, semester, options = {}) {
  const sids = normalizeStudentIds(studentIds);
  const totalStudents = sids.length;
  const context = options.context || (await buildKpiContext(sids, semester));

  const participatedCount = sids.filter((sid) => (context.attendedCountByStudent[sid] || 0) > 0).length;
  const attendedCountTotal = sids.reduce((sum, sid) => sum + (context.attendedCountByStudent[sid] || 0), 0);

  return {
    participatedCount,
    attendedCountTotal,
    participationRate: toRate(participatedCount, totalStudents),
    avgParticipationCount: totalStudents > 0 ? Number((attendedCountTotal / totalStudents).toFixed(2)) : 0
  };
}

async function getBestepRegistrationMetrics(studentIds, semester, options = {}) {
  const sids = normalizeStudentIds(studentIds);
  const totalStudents = sids.length;
  const context = options.context || (await buildKpiContext(sids, semester));

  const registeredCount = sids.filter((sid) => {
    const reg = context.latestRegistrationByStudent[sid];
    return !!(reg && reg.status === 'success');
  }).length;

  return {
    registeredCount,
    bestepRegistrationRate: toRate(registeredCount, totalStudents)
  };
}

async function getBestepAttendanceMetrics(studentIds, semester, options = {}) {
  const sids = normalizeStudentIds(studentIds);
  const context = options.context || (await buildKpiContext(sids, semester));
  const regMetrics = options.registrationMetrics || await getBestepRegistrationMetrics(sids, semester, { context });

  let lrAttendedCount = 0;
  let swAttendedCount = 0;
  sids.forEach((sid) => {
    const a = context.bestepAttendanceSummaryByStudent[sid];
    if (!a) return;
    if (a.lrAttended) lrAttendedCount += 1;
    if (a.swAttended) swAttendedCount += 1;
  });

  const lrAttendanceRate = toRate(lrAttendedCount, regMetrics.registeredCount);
  const swAttendanceRate = toRate(swAttendedCount, regMetrics.registeredCount);

  return {
    lrAttendedCount,
    swAttendedCount,
    bestepAttendanceRate: Number(((lrAttendanceRate + swAttendanceRate) / 2).toFixed(2))
  };
}

async function getBestepPassMetrics(studentIds, semester, options = {}) {
  const sids = normalizeStudentIds(studentIds);
  const context = options.context || (await buildKpiContext(sids, semester));
  const attendanceMetrics = options.attendanceMetrics || await getBestepAttendanceMetrics(sids, semester, { context });

  const passedCount = sids.filter((sid) => context.scoreByStudent[sid]?.passed).length;
  const totalAttended = Math.max(attendanceMetrics.lrAttendedCount, attendanceMetrics.swAttendedCount);

  return {
    passedCount,
    totalAttended,
    bestepPassRate: toRate(passedCount, totalAttended)
  };
}

async function getExemptionMetrics(studentIds, semester, options = {}) {
  const sids = normalizeStudentIds(studentIds);
  const totalStudents = sids.length;
  const context = options.context || (await buildKpiContext(sids, semester));

  const exemptionApprovedCount = sids.filter((sid) => {
    const reg = context.latestRegistrationByStudent[sid];
    return reg ? isCountedExemptionApproval(reg) : false;
  }).length;

  return {
    exemptionApprovedCount,
    exemptionApprovedRate: toRate(exemptionApprovedCount, totalStudents)
  };
}

async function getSurveyMetrics(studentIds, semester, options = {}) {
  const sids = normalizeStudentIds(studentIds);
  const totalStudents = sids.length;
  const context = options.context || (await buildKpiContext(sids, semester));

  const surveyCompletedCount = sids.filter((sid) => context.surveyCompletedSet.has(sid)).length;

  return {
    surveyCompletedCount,
    surveyCompletionRate: toRate(surveyCompletedCount, totalStudents)
  };
}

async function getViolationMetrics(studentIds, semester, options = {}) {
  const sids = normalizeStudentIds(studentIds);
  const totalStudents = sids.length;
  const context = options.context || (await buildKpiContext(sids, semester));

  const violationCount = sids.reduce((sum, sid) => sum + (context.violationCountByStudent[sid] || 0), 0);

  return {
    violationCount,
    violationRate: totalStudents > 0 ? Number((violationCount / totalStudents).toFixed(2)) : 0
  };
}

module.exports = {
  buildKpiContext,
  buildMultiSemesterKpiContexts,
  normalizeStudentIds,
  getParticipationMetrics,
  getBestepRegistrationMetrics,
  getBestepAttendanceMetrics,
  getBestepPassMetrics,
  getExemptionMetrics,
  getSurveyMetrics,
  getViolationMetrics
};

