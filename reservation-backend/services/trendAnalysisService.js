// services/trendAnalysisService.js
// Phase 3：跨學期趨勢分析 + Decision KPIs

const { ClassMembership } = require('../models');
const { Op } = require('sequelize');
const { SEMESTER_ORDER, compareSemester } = require('../utils/semesterConstants');
const kpiService = require('./kpiService');
const riskDetectionService = require('./riskDetectionService');
const scoringService = require('./scoringService');
const { getCache, setCache } = require('../utils/analyticsCache');

const MAX_SEMESTERS = 8;
const TREND_CACHE_TTL_MS = 5 * 60 * 1000;

function pickSemesters(fromSemester, toSemester) {
  const sorted = [...SEMESTER_ORDER].sort(compareSemester);
  let arr = sorted;
  if (fromSemester) arr = arr.filter((s) => compareSemester(fromSemester, s) <= 0);
  if (toSemester) arr = arr.filter((s) => compareSemester(s, toSemester) <= 0);
  if (arr.length > MAX_SEMESTERS) {
    arr = arr.slice(arr.length - MAX_SEMESTERS);
  }
  return arr;
}

function buildTrendMetricsObject() {
  return {
    participationRate: [],
    avgParticipationCount: [],
    bestepPassRate: [],
    exemptionApprovedRate: [],
    riskHighCount: [],
    riskLevelDistribution: []
  };
}

function computeImprovementRate(prev, current) {
  if (prev == null || current == null || prev === 0) return null;
  return Number((((current - prev) / prev) * 100).toFixed(2));
}

async function buildMetricsForSemesterStudentSet(studentIdsBySemester, semesters) {
  const allStudentIds = kpiService.normalizeStudentIds(Object.values(studentIdsBySemester).flat());
  const contexts = await kpiService.buildMultiSemesterKpiContexts(allStudentIds, semesters);

  const metrics = buildTrendMetricsObject();
  for (const sem of semesters) {
    const sids = kpiService.normalizeStudentIds(studentIdsBySemester[sem] || []);
    const context = contexts[sem];

    const participation = await kpiService.getParticipationMetrics(sids, sem, { context });
    const registration = await kpiService.getBestepRegistrationMetrics(sids, sem, { context });
    const attendance = await kpiService.getBestepAttendanceMetrics(sids, sem, { context, registrationMetrics: registration });
    const pass = await kpiService.getBestepPassMetrics(sids, sem, { context, attendanceMetrics: attendance });
    const exemption = await kpiService.getExemptionMetrics(sids, sem, { context });
    const risks = await riskDetectionService.computeRisksForStudentIds(sids, sem, { context });
    const riskDist = { low: 0, medium: 0, high: 0 };
    risks.forEach((r) => { riskDist[r.riskLevel] = (riskDist[r.riskLevel] || 0) + 1; });

    metrics.participationRate.push(participation.participationRate);
    metrics.avgParticipationCount.push(participation.avgParticipationCount);
    metrics.bestepPassRate.push(pass.bestepPassRate);
    metrics.exemptionApprovedRate.push(exemption.exemptionApprovedRate);
    metrics.riskHighCount.push(riskDist.high || 0);
    metrics.riskLevelDistribution.push(riskDist);
  }

  return metrics;
}

async function getStudentTrends(studentId, fromSemester, toSemester) {
  const sid = kpiService.normalizeStudentIds([studentId])[0];
  if (!sid) throw new Error('studentId is required');
  const semesters = pickSemesters(fromSemester, toSemester);
  const studentIdsBySemester = {};
  semesters.forEach((sem) => { studentIdsBySemester[sem] = [sid]; });

  const metrics = await buildMetricsForSemesterStudentSet(studentIdsBySemester, semesters);
  return { studentId: sid, semesters, metrics };
}

async function getClassTrends(classId, fromSemester, toSemester) {
  const semesters = pickSemesters(fromSemester, toSemester);
  const rows = await ClassMembership.findAll({
    where: { classId, semester: { [Op.in]: semesters } },
    attributes: ['semester', 'studentId'],
    raw: true
  });

  const studentIdsBySemester = {};
  semesters.forEach((sem) => { studentIdsBySemester[sem] = []; });
  rows.forEach((r) => {
    if (!studentIdsBySemester[r.semester]) return;
    studentIdsBySemester[r.semester].push(r.studentId);
  });
  Object.keys(studentIdsBySemester).forEach((sem) => {
    studentIdsBySemester[sem] = kpiService.normalizeStudentIds(studentIdsBySemester[sem]);
  });

  const metrics = await buildMetricsForSemesterStudentSet(studentIdsBySemester, semesters);
  return { classId: Number(classId), semesters, metrics };
}

async function getOverviewTrends(fromSemester, toSemester) {
  const semesters = pickSemesters(fromSemester, toSemester);
  const cacheKey = `trends:overview:${semesters.join(',')}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const rows = await ClassMembership.findAll({
    where: { semester: { [Op.in]: semesters } },
    attributes: ['semester', 'studentId'],
    raw: true
  });
  const studentIdsBySemester = {};
  semesters.forEach((sem) => { studentIdsBySemester[sem] = []; });
  rows.forEach((r) => {
    if (!studentIdsBySemester[r.semester]) return;
    studentIdsBySemester[r.semester].push(r.studentId);
  });
  Object.keys(studentIdsBySemester).forEach((sem) => {
    studentIdsBySemester[sem] = kpiService.normalizeStudentIds(studentIdsBySemester[sem]);
  });

  const metrics = await buildMetricsForSemesterStudentSet(studentIdsBySemester, semesters);

  // Decision KPIs（由 trend 導出）
  const n = semesters.length;
  const prevIdx = n >= 2 ? n - 2 : -1;
  const lastIdx = n >= 1 ? n - 1 : -1;
  const participationImprovementRate =
    prevIdx >= 0 ? computeImprovementRate(metrics.participationRate[prevIdx], metrics.participationRate[lastIdx]) : null;
  const highRiskImprovementRate =
    prevIdx >= 0 ? computeImprovementRate(metrics.riskHighCount[prevIdx], metrics.riskHighCount[lastIdx]) : null;

  /**
   * API 鍵名保留 `teacherImpact`（向後相容）。語意為：全校班級「教學綜合分」跨期差分（scoringService proxy），
   * 不代表個別教師對學生成果之因果影響。前端應稱「教學綜合指標變化」。
   * 詳見 docs/analytics-and-reports-metric-definitions.md。
   */
  let teacherImpact = null;
  if (prevIdx >= 0) {
    const prevSem = semesters[prevIdx];
    const lastSem = semesters[lastIdx];
    const prevScore = await scoringService.getSemesterAverageTeachingScore(prevSem);
    const lastScore = await scoringService.getSemesterAverageTeachingScore(lastSem);
    teacherImpact = {
      previousSemester: prevSem,
      currentSemester: lastSem,
      previousAvgTeachingScore: prevScore.avgScore,
      currentAvgTeachingScore: lastScore.avgScore,
      growth: Number((lastScore.avgScore - prevScore.avgScore).toFixed(2))
    };
  }

  const result = {
    semesters,
    metrics,
    decisionKpis: {
      participationImprovementRate,
      highRiskImprovementRate,
      teacherImpact
    }
  };
  setCache(cacheKey, result, TREND_CACHE_TTL_MS);
  return result;
}

module.exports = {
  getStudentTrends,
  getClassTrends,
  getOverviewTrends
};

