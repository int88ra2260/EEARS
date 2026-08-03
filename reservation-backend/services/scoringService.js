// services/scoringService.js
// Phase 3：教學成效評分模型（Explainable）
//
// 產出為「班級層級教學綜合分」（多 KPI 加權），供趨勢分析 decisionKpis.teacherImpact 等使用。
// 此為行政觀察用 proxy，不得解讀為個別教師對學生學習成果之因果影響。詳見 docs/analytics-and-reports-metric-definitions.md。

const { ClassMembership } = require('../models');
const kpiService = require('./kpiService');
const { TEACHING_SCORE_WEIGHTS, scoreToLevel } = require('../utils/scoringConstants');

function calculateTeachingScore(metrics) {
  const weighted =
    metrics.participationRate * TEACHING_SCORE_WEIGHTS.participationRate +
    metrics.bestepPassRate * TEACHING_SCORE_WEIGHTS.bestepPassRate +
    metrics.exemptionApprovedRate * TEACHING_SCORE_WEIGHTS.exemptionApprovedRate +
    metrics.surveyCompletionRate * TEACHING_SCORE_WEIGHTS.surveyCompletionRate +
    metrics.violationRate * TEACHING_SCORE_WEIGHTS.violationRate;
  const score = Number(weighted.toFixed(2));
  return {
    score,
    level: scoreToLevel(score)
  };
}

async function collectClassMetrics(classId, semester) {
  const memberships = await ClassMembership.findAll({
    where: { classId, semester },
    attributes: ['studentId'],
    raw: true
  });
  const studentIds = kpiService.normalizeStudentIds(memberships.map((m) => m.studentId));
  const context = await kpiService.buildKpiContext(studentIds, semester);

  const participation = await kpiService.getParticipationMetrics(studentIds, semester, { context });
  const registration = await kpiService.getBestepRegistrationMetrics(studentIds, semester, { context });
  const attendance = await kpiService.getBestepAttendanceMetrics(studentIds, semester, { context, registrationMetrics: registration });
  const pass = await kpiService.getBestepPassMetrics(studentIds, semester, { context, attendanceMetrics: attendance });
  const exemption = await kpiService.getExemptionMetrics(studentIds, semester, { context });
  const survey = await kpiService.getSurveyMetrics(studentIds, semester, { context });
  const violation = await kpiService.getViolationMetrics(studentIds, semester, { context });

  return {
    studentIds,
    metrics: {
      participationRate: participation.participationRate,
      bestepPassRate: pass.bestepPassRate,
      exemptionApprovedRate: exemption.exemptionApprovedRate,
      surveyCompletionRate: survey.surveyCompletionRate,
      violationRate: violation.violationRate
    },
    breakdown: {
      participation,
      registration,
      attendance,
      pass,
      exemption,
      survey,
      violation
    }
  };
}

async function getClassTeachingScore(classId, semester) {
  const { metrics, breakdown } = await collectClassMetrics(classId, semester);
  const result = calculateTeachingScore(metrics);
  return {
    classId,
    semester,
    score: result.score,
    level: result.level,
    breakdown: {
      participation: metrics.participationRate,
      passRate: metrics.bestepPassRate,
      exemption: metrics.exemptionApprovedRate,
      survey: metrics.surveyCompletionRate,
      violation: metrics.violationRate,
      details: breakdown
    }
  };
}

async function getSemesterAverageTeachingScore(semester) {
  const rows = await ClassMembership.findAll({
    where: { semester },
    attributes: ['classId', 'studentId'],
    raw: true
  });
  const classIds = [...new Set(rows.map((r) => Number(r.classId)).filter(Boolean))];
  if (!classIds.length) {
    return { semester, classCount: 0, avgScore: 0 };
  }

  const studentsByClass = {};
  rows.forEach((r) => {
    const classId = Number(r.classId);
    if (!studentsByClass[classId]) studentsByClass[classId] = [];
    studentsByClass[classId].push(r.studentId);
  });
  Object.keys(studentsByClass).forEach((cid) => {
    studentsByClass[cid] = kpiService.normalizeStudentIds(studentsByClass[cid]);
  });

  const allStudentIds = kpiService.normalizeStudentIds(Object.values(studentsByClass).flat());
  const context = await kpiService.buildKpiContext(allStudentIds, semester);

  let totalScore = 0;
  let classCount = 0;
  for (const classId of classIds) {
    const studentIds = studentsByClass[classId] || [];
    const participation = await kpiService.getParticipationMetrics(studentIds, semester, { context });
    const registration = await kpiService.getBestepRegistrationMetrics(studentIds, semester, { context });
    const attendance = await kpiService.getBestepAttendanceMetrics(studentIds, semester, { context, registrationMetrics: registration });
    const pass = await kpiService.getBestepPassMetrics(studentIds, semester, { context, attendanceMetrics: attendance });
    const exemption = await kpiService.getExemptionMetrics(studentIds, semester, { context });
    const survey = await kpiService.getSurveyMetrics(studentIds, semester, { context });
    const violation = await kpiService.getViolationMetrics(studentIds, semester, { context });

    const s = calculateTeachingScore({
      participationRate: participation.participationRate,
      bestepPassRate: pass.bestepPassRate,
      exemptionApprovedRate: exemption.exemptionApprovedRate,
      surveyCompletionRate: survey.surveyCompletionRate,
      violationRate: violation.violationRate
    }).score;
    totalScore += s;
    classCount += 1;
  }

  return {
    semester,
    classCount,
    avgScore: classCount > 0 ? Number((totalScore / classCount).toFixed(2)) : 0
  };
}

module.exports = {
  getClassTeachingScore,
  getSemesterAverageTeachingScore,
  calculateTeachingScore
};

