// services/learningRiskPredictionService.js
// 學習風險預測服務：整合微學習數據、參與行為、歷史趨勢進行風險預測

'use strict';

const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { LearningTraceEvent, Reservation, Event, EtEnrollmentSnapshot } = require('../models');
const kpiService = require('./kpiService');
const riskDetectionService = require('./riskDetectionService');
const { SEMESTER_ORDER, compareSemester, SEMESTER_RANGES } = require('../utils/semesterConstants');

const PREDICTION_FACTORS = {
  participationDecline: {
    weight: 2.5,
    label: '參與度下降趨勢',
    description: '近期活動參與次數明顯減少',
  },
  noRecentMicroLearning: {
    weight: 1.5,
    label: '微學習停滯',
    description: '超過 30 天未完成任何微學習活動',
  },
  lowMicroLearningAccuracy: {
    weight: 2.0,
    label: '微學習表現偏低',
    description: '最近微學習正確率低於 50%',
  },
  cefrLevelStagnant: {
    weight: 1.8,
    label: 'CEFR 等級停滯',
    description: '連續兩學期 CEFR 等級無提升',
  },
  highNoShowRate: {
    weight: 3.0,
    label: '高缺席率',
    description: '預約後未出席比例偏高',
  },
  violationHistory: {
    weight: 2.5,
    label: '違規紀錄',
    description: '有活動違規紀錄',
  },
  noBestepRegistration: {
    weight: 2.0,
    label: '未報名 BESTEP',
    description: '本學期尚未報名英檢',
  },
  inactivePeriod: {
    weight: 2.2,
    label: '長期不活躍',
    description: '超過 60 天無任何學習活動紀錄',
  },
};

const RISK_THRESHOLDS = {
  high: 7.5,
  medium: 4.0,
  low: 0,
};

const CONFIDENCE_LEVELS = {
  high: { min: 0.75, label: '高' },
  medium: { min: 0.55, label: '中' },
  low: { min: 0, label: '低' },
};

function cleanStudentId(studentId) {
  if (!studentId) return null;
  return String(studentId).trim().toUpperCase().replace(/\s+/g, '');
}

function calculateConfidenceLevel(confidence) {
  if (confidence >= CONFIDENCE_LEVELS.high.min) return 'high';
  if (confidence >= CONFIDENCE_LEVELS.medium.min) return 'medium';
  return 'low';
}

function calculateRiskLevel(score) {
  if (score >= RISK_THRESHOLDS.high) return 'high';
  if (score >= RISK_THRESHOLDS.medium) return 'medium';
  return 'low';
}

async function getMicroLearningStats(studentId, daysBack = 90) {
  const since = dayjs().subtract(daysBack, 'day').toDate();
  const sid = cleanStudentId(studentId);

  const traces = await LearningTraceEvent.findAll({
    where: {
      studentId: sid,
      eventType: 'session_complete',
      occurredAt: { [Op.gte]: since },
    },
    attributes: ['occurredAt', 'gameId', 'score', 'accuracy', 'cefrLevel', 'durationMs'],
    order: [['occurredAt', 'DESC']],
    limit: 100,
  });

  if (traces.length === 0) {
    return {
      totalSessions: 0,
      recentSessions: 0,
      avgAccuracy: null,
      avgScore: null,
      lastSessionDaysAgo: null,
      latestCefrLevel: null,
      gameBreakdown: {},
      trend: 'unknown',
    };
  }

  const recentThreshold = dayjs().subtract(30, 'day');
  const recentTraces = traces.filter(t => dayjs(t.occurredAt).isAfter(recentThreshold));
  
  const accuracies = traces
    .map(t => t.accuracy != null ? Number(t.accuracy) : null)
    .filter(a => a !== null && !isNaN(a));
  
  const scores = traces
    .map(t => t.score != null ? Number(t.score) : null)
    .filter(s => s !== null && !isNaN(s));

  const gameBreakdown = {};
  traces.forEach(t => {
    if (!gameBreakdown[t.gameId]) {
      gameBreakdown[t.gameId] = { count: 0, avgAccuracy: 0, accuracies: [] };
    }
    gameBreakdown[t.gameId].count += 1;
    if (t.accuracy != null) {
      gameBreakdown[t.gameId].accuracies.push(Number(t.accuracy));
    }
  });
  
  Object.keys(gameBreakdown).forEach(gameId => {
    const accs = gameBreakdown[gameId].accuracies;
    gameBreakdown[gameId].avgAccuracy = accs.length > 0 
      ? Number((accs.reduce((a, b) => a + b, 0) / accs.length).toFixed(3))
      : null;
    delete gameBreakdown[gameId].accuracies;
  });

  const lastSessionDate = dayjs(traces[0].occurredAt);
  const lastSessionDaysAgo = dayjs().diff(lastSessionDate, 'day');

  const midPoint = Math.floor(traces.length / 2);
  const recentHalf = traces.slice(0, midPoint);
  const olderHalf = traces.slice(midPoint);
  
  const recentAvg = recentHalf.length > 0
    ? recentHalf.filter(t => t.accuracy != null).reduce((acc, t) => acc + Number(t.accuracy), 0) / recentHalf.filter(t => t.accuracy != null).length
    : 0;
  const olderAvg = olderHalf.length > 0
    ? olderHalf.filter(t => t.accuracy != null).reduce((acc, t) => acc + Number(t.accuracy), 0) / olderHalf.filter(t => t.accuracy != null).length
    : 0;

  let trend = 'stable';
  if (recentAvg > olderAvg * 1.1) trend = 'improving';
  else if (recentAvg < olderAvg * 0.9) trend = 'declining';

  return {
    totalSessions: traces.length,
    recentSessions: recentTraces.length,
    avgAccuracy: accuracies.length > 0 
      ? Number((accuracies.reduce((a, b) => a + b, 0) / accuracies.length).toFixed(3))
      : null,
    avgScore: scores.length > 0
      ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
      : null,
    lastSessionDaysAgo,
    latestCefrLevel: traces[0].cefrLevel || null,
    gameBreakdown,
    trend,
  };
}

async function getParticipationStats(studentId, semester) {
  const sid = cleanStudentId(studentId);
  
  const reservations = await Reservation.findAll({
    where: { studentId: sid },
    attributes: ['checkinStatus', 'eventId', 'createdAt'],
    include: [{
      model: Event,
      attributes: ['eventType', 'date'],
      where: SEMESTER_RANGES[semester] ? {
        date: {
          [Op.between]: [SEMESTER_RANGES[semester].start, SEMESTER_RANGES[semester].end]
        }
      } : {},
      required: true,
    }],
    order: [['createdAt', 'DESC']],
    limit: 100,
  });

  const total = reservations.length;
  const attended = reservations.filter(r => r.checkinStatus === '已簽到').length;
  const noShow = reservations.filter(r => r.checkinStatus === '已登記違規' || r.checkinStatus === '未到').length;
  const violations = reservations.filter(r => r.checkinStatus === '已登記違規').length;

  const byEventType = {};
  reservations.forEach(r => {
    const type = r.Event?.eventType || 'unknown';
    if (!byEventType[type]) {
      byEventType[type] = { total: 0, attended: 0, noShow: 0 };
    }
    byEventType[type].total += 1;
    if (r.checkinStatus === '已簽到') byEventType[type].attended += 1;
    if (r.checkinStatus === '已登記違規' || r.checkinStatus === '未到') byEventType[type].noShow += 1;
  });

  return {
    totalReservations: total,
    attendedCount: attended,
    noShowCount: noShow,
    violationCount: violations,
    attendanceRate: total > 0 ? Number((attended / total * 100).toFixed(1)) : null,
    noShowRate: total > 0 ? Number((noShow / total * 100).toFixed(1)) : null,
    byEventType,
  };
}

async function predictLearningRisk(studentId, semester, options = {}) {
  const sid = cleanStudentId(studentId);
  if (!sid) throw new Error('studentId is required');
  if (!semester) throw new Error('semester is required');

  const [microLearning, participation, currentRiskResult] = await Promise.all([
    getMicroLearningStats(sid, 90),
    getParticipationStats(sid, semester),
    riskDetectionService.getRisksForStudents([sid], semester).then(r => r[0] || null),
  ]);

  const riskFactors = [];
  let totalScore = 0;
  let dataPoints = 0;

  if (microLearning.lastSessionDaysAgo !== null && microLearning.lastSessionDaysAgo > 30) {
    const factor = PREDICTION_FACTORS.noRecentMicroLearning;
    const contribution = factor.weight;
    riskFactors.push({
      key: 'noRecentMicroLearning',
      label: factor.label,
      description: factor.description,
      value: microLearning.lastSessionDaysAgo,
      weight: factor.weight,
      contribution,
    });
    totalScore += contribution;
    dataPoints += 1;
  }

  if (microLearning.avgAccuracy !== null && microLearning.avgAccuracy < 0.5) {
    const factor = PREDICTION_FACTORS.lowMicroLearningAccuracy;
    const contribution = factor.weight * (1 - microLearning.avgAccuracy);
    riskFactors.push({
      key: 'lowMicroLearningAccuracy',
      label: factor.label,
      description: factor.description,
      value: Number((microLearning.avgAccuracy * 100).toFixed(1)),
      weight: factor.weight,
      contribution: Number(contribution.toFixed(2)),
    });
    totalScore += contribution;
    dataPoints += 1;
  }

  if (microLearning.lastSessionDaysAgo !== null && microLearning.lastSessionDaysAgo > 60) {
    const factor = PREDICTION_FACTORS.inactivePeriod;
    const contribution = factor.weight;
    riskFactors.push({
      key: 'inactivePeriod',
      label: factor.label,
      description: factor.description,
      value: microLearning.lastSessionDaysAgo,
      weight: factor.weight,
      contribution,
    });
    totalScore += contribution;
    dataPoints += 1;
  }

  if (participation.noShowRate !== null && participation.noShowRate > 30) {
    const factor = PREDICTION_FACTORS.highNoShowRate;
    const contribution = factor.weight * (participation.noShowRate / 100);
    riskFactors.push({
      key: 'highNoShowRate',
      label: factor.label,
      description: factor.description,
      value: participation.noShowRate,
      weight: factor.weight,
      contribution: Number(contribution.toFixed(2)),
    });
    totalScore += contribution;
    dataPoints += 1;
  }

  if (participation.violationCount > 0) {
    const factor = PREDICTION_FACTORS.violationHistory;
    const contribution = factor.weight * Math.min(participation.violationCount, 3) / 3;
    riskFactors.push({
      key: 'violationHistory',
      label: factor.label,
      description: factor.description,
      value: participation.violationCount,
      weight: factor.weight,
      contribution: Number(contribution.toFixed(2)),
    });
    totalScore += contribution;
    dataPoints += 1;
  }

  if (currentRiskResult) {
    const noBestepReason = currentRiskResult.reasons?.find(r => r.key === 'noBestep');
    if (noBestepReason) {
      const factor = PREDICTION_FACTORS.noBestepRegistration;
      riskFactors.push({
        key: 'noBestepRegistration',
        label: factor.label,
        description: factor.description,
        value: 1,
        weight: factor.weight,
        contribution: factor.weight,
      });
      totalScore += factor.weight;
      dataPoints += 1;
    }
  }

  if (microLearning.trend === 'declining') {
    const factor = PREDICTION_FACTORS.participationDecline;
    const contribution = factor.weight * 0.7;
    riskFactors.push({
      key: 'participationDecline',
      label: factor.label,
      description: factor.description,
      value: microLearning.trend,
      weight: factor.weight,
      contribution: Number(contribution.toFixed(2)),
    });
    totalScore += contribution;
    dataPoints += 1;
  }

  const hasEnoughData = microLearning.totalSessions > 0 || participation.totalReservations > 0;
  const confidence = hasEnoughData
    ? Math.min(0.5 + (dataPoints * 0.08) + (microLearning.totalSessions * 0.01), 0.95)
    : 0.3;

  const predictedRiskLevel = calculateRiskLevel(totalScore);
  const confidenceLevel = calculateConfidenceLevel(confidence);

  const suggestions = [];
  if (riskFactors.some(f => f.key === 'noRecentMicroLearning' || f.key === 'inactivePeriod')) {
    suggestions.push({
      priority: 'high',
      action: '鼓勵學生重新參與微學習活動',
      detail: '建議透過 Word Bridge 或 Listening Ladder 等遊戲重新建立學習習慣',
    });
  }
  if (riskFactors.some(f => f.key === 'lowMicroLearningAccuracy')) {
    suggestions.push({
      priority: 'medium',
      action: '建議從較低難度的練習開始',
      detail: '可以從 A1-A2 等級的練習逐步提升',
    });
  }
  if (riskFactors.some(f => f.key === 'highNoShowRate')) {
    suggestions.push({
      priority: 'high',
      action: '追蹤學生出席狀況',
      detail: '了解未能出席的原因，並提供適當協助',
    });
  }
  if (riskFactors.some(f => f.key === 'noBestepRegistration')) {
    suggestions.push({
      priority: 'medium',
      action: '提醒學生報名 BESTEP',
      detail: '說明英檢對學習歷程的重要性',
    });
  }

  return {
    studentId: sid,
    semester,
    generatedAt: new Date().toISOString(),
    currentRisk: currentRiskResult ? {
      level: currentRiskResult.riskLevel,
      score: currentRiskResult.riskScore,
      reasons: currentRiskResult.reasons,
    } : null,
    prediction: {
      riskLevel: predictedRiskLevel,
      riskScore: Number(totalScore.toFixed(2)),
      confidence: Number(confidence.toFixed(3)),
      confidenceLevel,
      factors: riskFactors,
    },
    insights: {
      microLearning: {
        totalSessions: microLearning.totalSessions,
        recentSessions: microLearning.recentSessions,
        avgAccuracy: microLearning.avgAccuracy,
        trend: microLearning.trend,
        lastSessionDaysAgo: microLearning.lastSessionDaysAgo,
        latestCefrLevel: microLearning.latestCefrLevel,
        gameBreakdown: microLearning.gameBreakdown,
      },
      participation: {
        totalReservations: participation.totalReservations,
        attendanceRate: participation.attendanceRate,
        noShowRate: participation.noShowRate,
        violationCount: participation.violationCount,
      },
    },
    suggestions,
  };
}

async function batchPredictLearningRisks(studentIds, semester, options = {}) {
  const sids = (studentIds || []).map(cleanStudentId).filter(Boolean);
  if (sids.length === 0) return [];

  const results = await Promise.all(
    sids.map(sid => predictLearningRisk(sid, semester, options).catch(err => ({
      studentId: sid,
      semester,
      error: err.message,
    })))
  );

  return results;
}

async function getLearningRiskSummary(studentIds, semester) {
  const predictions = await batchPredictLearningRisks(studentIds, semester);
  
  const validPredictions = predictions.filter(p => !p.error);
  const summary = {
    totalStudents: studentIds.length,
    analyzedStudents: validPredictions.length,
    errorCount: predictions.length - validPredictions.length,
    riskDistribution: {
      high: 0,
      medium: 0,
      low: 0,
    },
    avgRiskScore: 0,
    avgConfidence: 0,
    topFactors: {},
  };

  if (validPredictions.length === 0) return summary;

  let totalScore = 0;
  let totalConfidence = 0;
  const factorCounts = {};

  validPredictions.forEach(p => {
    const level = p.prediction?.riskLevel || 'low';
    summary.riskDistribution[level] = (summary.riskDistribution[level] || 0) + 1;
    totalScore += p.prediction?.riskScore || 0;
    totalConfidence += p.prediction?.confidence || 0;

    (p.prediction?.factors || []).forEach(f => {
      if (!factorCounts[f.key]) {
        factorCounts[f.key] = { count: 0, label: f.label, avgContribution: 0, totalContribution: 0 };
      }
      factorCounts[f.key].count += 1;
      factorCounts[f.key].totalContribution += f.contribution;
    });
  });

  summary.avgRiskScore = Number((totalScore / validPredictions.length).toFixed(2));
  summary.avgConfidence = Number((totalConfidence / validPredictions.length).toFixed(3));

  summary.topFactors = Object.entries(factorCounts)
    .map(([key, data]) => ({
      key,
      label: data.label,
      count: data.count,
      percentage: Number((data.count / validPredictions.length * 100).toFixed(1)),
      avgContribution: Number((data.totalContribution / data.count).toFixed(2)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return summary;
}

module.exports = {
  predictLearningRisk,
  batchPredictLearningRisks,
  getLearningRiskSummary,
  getMicroLearningStats,
  getParticipationStats,
  PREDICTION_FACTORS,
  RISK_THRESHOLDS,
};
