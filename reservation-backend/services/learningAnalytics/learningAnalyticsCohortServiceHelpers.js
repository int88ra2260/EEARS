'use strict';

const { resolveBaselineCefrBand } = require('./baselineAbilityUtils');

function round(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return round(nums.reduce((sum, v) => sum + v, 0) / nums.length, 2);
}

function resolveGroupKey(student, groupBy) {
  if (groupBy === 'baselineCefr') {
    return resolveBaselineCefrBand(student) || '未分類';
  }
  return String(student[groupBy] || '未分類').trim() || '未分類';
}

function isParticipated(student) {
  const level = String(student.exposureLevel || '').toLowerCase();
  return level === 'medium' || level === 'high';
}

function aggregateGrowthByGroup(episodes, studentById, groupBy) {
  const buckets = new Map();
  for (const episode of episodes) {
    const student = studentById.get(episode.studentId);
    if (!student) continue;
    const key = resolveGroupKey(student, groupBy);
    if (!buckets.has(key)) {
      buckets.set(key, { actual: [], adjusted: [] });
    }
    const bucket = buckets.get(key);
    bucket.actual.push(episode.actualGseGrowth);
    bucket.adjusted.push(episode.adjustedGseGrowth);
  }
  const result = new Map();
  for (const [key, bucket] of buckets.entries()) {
    result.set(key, {
      growthEpisodeCount: bucket.actual.length,
      avgActualGseGrowth: mean(bucket.actual),
      avgAdjustedGseGrowth: mean(bucket.adjusted),
    });
  }
  return result;
}

function buildParticipationComparison(episodes, students) {
  const participatedIds = new Set(students.filter(isParticipated).map((s) => s.studentId));
  const notParticipatedIds = new Set(
    students.filter((s) => !participatedIds.has(s.studentId)).map((s) => s.studentId)
  );

  const buckets = {
    participated: { label: '中高參與（≥10 小時）', actual: [], adjusted: [], students: participatedIds.size },
    notParticipated: { label: '低／無參與', actual: [], adjusted: [], students: notParticipatedIds.size },
  };

  for (const episode of episodes) {
    if (participatedIds.has(episode.studentId)) {
      buckets.participated.actual.push(episode.actualGseGrowth);
      buckets.participated.adjusted.push(episode.adjustedGseGrowth);
    } else if (notParticipatedIds.has(episode.studentId)) {
      buckets.notParticipated.actual.push(episode.actualGseGrowth);
      buckets.notParticipated.adjusted.push(episode.adjustedGseGrowth);
    }
  }

  return Object.entries(buckets).map(([key, bucket]) => ({
    key,
    label: bucket.label,
    students: bucket.students,
    growthEpisodeCount: bucket.actual.length,
    avgActualGseGrowth: mean(bucket.actual),
    avgAdjustedGseGrowth: mean(bucket.adjusted),
    causalClaimAllowed: false,
  }));
}

module.exports = {
  round,
  mean,
  resolveGroupKey,
  isParticipated,
  aggregateGrowthByGroup,
  buildParticipationComparison,
};
