// services/riskDetectionService.js
// Phase 2.5：風險預警模組（規則可配置 + 輸出一致）
//
// 母體說明（避免與 LJ 名冊混淆）：
// - getRisksForSemester / getHighRisksForSemester：預設為該學期 class_memberships 內 DISTINCT 學生。
// - computeRisksForStudentIds(studentIds, …)：僅針對傳入之 studentIds（例如行政總覽 LJ 名冊子集）。
// 風險因子：noShow、低參與、無有效 BESTEP 報名狀態、違規等（見 utils/riskConstants）。
// 詳見 docs/analytics-and-reports-metric-definitions.md。

const { ClassMembership, sequelize } = require('../models');
const kpiService = require('./kpiService');
const { getCache, setCache } = require('../utils/analyticsCache');
const {
  RISK_WEIGHTS,
  RISK_THRESHOLDS,
  RISK_REASON_KEYS,
  DEFAULT_PARTICIPATION_THRESHOLD
} = require('../utils/riskConstants');
const { SEMESTER_ORDER, compareSemester } = require('../utils/semesterConstants');

const DEFAULT_RISK_CACHE_TTL_MS = 5 * 60 * 1000;

function cleanStudentId(studentId) {
  if (!studentId) return null;
  return String(studentId).trim().toUpperCase().replace(/\s+/g, '');
}

function levelFromScore(score, thresholds) {
  if (score >= thresholds.high) return 'high';
  if (score >= thresholds.medium) return 'medium';
  return 'low';
}

function buildReason(key, value, weight, contribution) {
  const base = RISK_REASON_KEYS[key] || { key, label: key };
  return {
    key: base.key,
    label: base.label,
    value,
    weight,
    contribution
  };
}

function evaluateRiskForStudent({
  sid,
  semester,
  context,
  participationThreshold,
  weights,
  thresholds
}) {
  const attendanceCount = context.attendedCountByStudent[sid] || 0;
  const noShowCount = context.noShowCountByStudent[sid] || 0;
  const violationCount = context.violationCountByStudent[sid] || 0;

  const reg = context.latestRegistrationByStudent[sid];
  const noBestep = !reg || !reg.examType || reg.examType === 'NON' || !reg.status;
  const lowParticipation = attendanceCount < participationThreshold;

  const reasons = [];
  let riskScore = 0;

  if (noShowCount > 0) {
    const contribution = noShowCount * weights.noShow;
    reasons.push(buildReason('noShow', noShowCount, weights.noShow, contribution));
    riskScore += contribution;
  }
  if (lowParticipation) {
    const contribution = weights.lowParticipation;
    reasons.push(buildReason('lowParticipation', attendanceCount, weights.lowParticipation, contribution));
    riskScore += contribution;
  }
  if (noBestep) {
    const contribution = weights.noBestep;
    reasons.push(buildReason('noBestep', 1, weights.noBestep, contribution));
    riskScore += contribution;
  }
  if (violationCount > 0) {
    const contribution = weights.violation;
    reasons.push(buildReason('violation', violationCount, weights.violation, contribution));
    riskScore += contribution;
  }

  return {
    studentId: sid,
    semester,
    riskScore,
    riskLevel: levelFromScore(riskScore, thresholds),
    reasons
  };
}

async function fetchDistinctStudentIdsForSemester(semester) {
  const rows = await ClassMembership.findAll({
    where: { semester },
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('studentId')), 'studentId']],
    raw: true
  });
  return rows.map((r) => cleanStudentId(r.studentId)).filter(Boolean);
}

async function computeRisksForStudentIds(studentIds, semester, options = {}) {
  const sids = kpiService.normalizeStudentIds(studentIds);
  if (sids.length === 0) return [];

  const participationThreshold =
    options.participationThreshold != null ? options.participationThreshold : DEFAULT_PARTICIPATION_THRESHOLD;
  const weights = options.weights || RISK_WEIGHTS;
  const thresholds = options.thresholds || RISK_THRESHOLDS;

  const context = options.context || await kpiService.buildKpiContext(sids, semester);

  return sids.map((sid) =>
    evaluateRiskForStudent({
      sid,
      semester,
      context,
      participationThreshold,
      weights,
      thresholds
    })
  );
}

async function getRisksForSemester(semester, options = {}) {
  const participationThreshold =
    options.participationThreshold != null ? options.participationThreshold : DEFAULT_PARTICIPATION_THRESHOLD;
  const cacheKey = `risk:${semester}:p${participationThreshold}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const studentIds = await fetchDistinctStudentIdsForSemester(semester);
  const risks = await computeRisksForStudentIds(studentIds, semester, options);
  const risksByStudentId = {};
  risks.forEach((r) => {
    risksByStudentId[r.studentId] = r;
  });
  setCache(cacheKey, risksByStudentId, DEFAULT_RISK_CACHE_TTL_MS);
  return risksByStudentId;
}

async function getRisksForStudents(studentIds, semester, options = {}) {
  const sids = kpiService.normalizeStudentIds(studentIds);
  if (sids.length === 0) return [];
  let list;
  if (options.context) {
    list = await computeRisksForStudentIds(sids, semester, options);
  } else {
    const risksByStudentId = await getRisksForSemester(semester, options);
    list = sids.map((sid) => risksByStudentId[sid]).filter(Boolean);
  }
  if (options.onlyHigh) {
    list = list.filter((r) => r.riskLevel === 'high');
  }
  return list;
}

async function getHighRiskStudentIds(studentIds, semester, options = {}) {
  const risks = await getRisksForStudents(studentIds, semester, { ...options, onlyHigh: true });
  return risks.map((r) => r.studentId);
}

async function getHighRiskStudentCount(studentIds, semester, options = {}) {
  const ids = await getHighRiskStudentIds(studentIds, semester, options);
  return ids.length;
}

async function getHighRisksForSemester(semester, options = {}) {
  const risksByStudentId = await getRisksForSemester(semester, options);
  return Object.values(risksByStudentId).filter((r) => r.riskLevel === 'high');
}

async function getRiskSummary(studentIds, semester, options = {}) {
  const risks = await getRisksForStudents(studentIds, semester, options);
  const summary = {
    totalStudents: risks.length,
    highRiskStudentCount: 0,
    mediumRiskStudentCount: 0,
    lowRiskStudentCount: 0,
    avgRiskScore: 0
  };
  if (risks.length === 0) return summary;

  let totalScore = 0;
  risks.forEach((r) => {
    totalScore += r.riskScore;
    if (r.riskLevel === 'high') summary.highRiskStudentCount += 1;
    else if (r.riskLevel === 'medium') summary.mediumRiskStudentCount += 1;
    else summary.lowRiskStudentCount += 1;
  });
  summary.avgRiskScore = Number((totalScore / risks.length).toFixed(2));
  return summary;
}

async function predictStudentRisk(studentId, semester, options = {}) {
  const sid = cleanStudentId(studentId);
  if (!sid) throw new Error('studentId is required');
  if (!semester) throw new Error('semester is required');

  const sorted = [...SEMESTER_ORDER].sort(compareSemester);
  const available = sorted.filter((s) => compareSemester(s, semester) <= 0);
  const historySemesters = available.slice(-3);
  if (!historySemesters.length) {
    return {
      studentId: sid,
      semester,
      currentRisk: null,
      predictedRisk: 'low',
      confidence: 0.4,
      reasons: []
    };
  }

  const contexts = await kpiService.buildMultiSemesterKpiContexts([sid], historySemesters);
  const participationSeries = [];
  const noBestepSeries = [];
  const violationSeries = [];

  for (const sem of historySemesters) {
    const ctx = contexts[sem];
    const attended = ctx.attendedCountByStudent[sid] || 0;
    const reg = ctx.latestRegistrationByStudent[sid];
    const noBestep = !reg || !reg.examType || reg.examType === 'NON' || !reg.status;
    const violations = ctx.violationCountByStudent[sid] || 0;
    participationSeries.push(attended);
    noBestepSeries.push(noBestep ? 1 : 0);
    violationSeries.push(violations);
  }

  const currentRisk = (await getRisksForStudents([sid], semester))[0] || null;

  const reasons = [];
  let confidence = 0.5;
  let predictedRisk = currentRisk?.riskLevel || 'low';

  const pLen = participationSeries.length;
  const isParticipationDown =
    pLen >= 3 &&
    participationSeries[pLen - 3] > participationSeries[pLen - 2] &&
    participationSeries[pLen - 2] > participationSeries[pLen - 1];

  const noBestepNow = noBestepSeries[noBestepSeries.length - 1] === 1;
  const violationIncreasing =
    violationSeries.length >= 2 &&
    violationSeries[violationSeries.length - 1] > violationSeries[violationSeries.length - 2];

  if (isParticipationDown && noBestepNow) {
    predictedRisk = 'high';
    confidence = 0.72;
    reasons.push({
      key: 'participationDownAndNoBestep',
      label: '參與持續下降且未報名 BESTEP',
      value: participationSeries,
      weight: 1,
      contribution: 1
    });
  } else if (violationIncreasing && noBestepNow) {
    predictedRisk = 'high';
    confidence = 0.66;
    reasons.push({
      key: 'violationIncreasingAndNoBestep',
      label: '違規增加且未報名 BESTEP',
      value: violationSeries,
      weight: 1,
      contribution: 1
    });
  } else if (isParticipationDown || violationIncreasing) {
    predictedRisk = currentRisk?.riskLevel === 'high' ? 'high' : 'medium';
    confidence = 0.61;
    reasons.push({
      key: 'negativeTrend',
      label: '近期趨勢不佳',
      value: { participationSeries, violationSeries },
      weight: 1,
      contribution: 1
    });
  }

  return {
    studentId: sid,
    semester,
    currentRisk,
    predictedRisk,
    confidence,
    reasons
  };
}

module.exports = {
  computeRisksForStudentIds,
  getRisksForStudents,
  getRisksForSemester,
  getHighRisksForSemester,
  getHighRiskStudentIds,
  getHighRiskStudentCount,
  getRiskSummary,
  predictStudentRisk
};

