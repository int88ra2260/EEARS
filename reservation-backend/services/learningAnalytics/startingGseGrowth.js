'use strict';

const { gseBandForScore } = require('./gseScoreMappingService');

const MIN_INTERPRETABLE_SAMPLE = 5;
/** 平均與正中間的人相差達到這個 GSE 值，就視為平均被少數人拉動。 */
const MEAN_MEDIAN_GAP = 1;
const SKILL_ORDER = ['listening', 'reading', 'speaking', 'writing'];

function round(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function bandKey(band) {
  return band.subLevel ? `${band.cefr}:${band.subLevel}` : band.cefr;
}

function sortedNumbers(values) {
  return values.filter((value) => Number.isFinite(value)).slice().sort((a, b) => a - b);
}

/** 0 到 1 的位置。奇數人數的正中間會落在實際的某一個人。 */
function valueAt(sorted, position) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * position;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function bandStats(values) {
  const sorted = sortedNumbers(values);
  const sampleSize = sorted.length;
  const interpretable = sampleSize >= MIN_INTERPRETABLE_SAMPLE;
  const average = mean(sorted);
  const median = interpretable ? valueAt(sorted, 0.5) : null;
  const q1 = interpretable ? valueAt(sorted, 0.25) : null;
  const q3 = interpretable ? valueAt(sorted, 0.75) : null;
  const meanMedianGap = interpretable && average != null && median != null
    ? average - median
    : null;
  return {
    sampleSize,
    interpretable,
    actualGseGrowthAverage: interpretable ? round(average, 2) : null,
    medianActualGseGrowth: interpretable ? round(median, 2) : null,
    q1ActualGseGrowth: interpretable ? round(q1, 2) : null,
    q3ActualGseGrowth: interpretable ? round(q3, 2) : null,
    meanMedianGap: interpretable ? round(meanMedianGap, 2) : null,
    meanPulledByExtremes: interpretable && Math.abs(meanMedianGap) >= MEAN_MEDIAN_GAP,
    improvedCount: sorted.filter((value) => value > 0).length,
    growthStudentRatio: interpretable ? round(sorted.filter((value) => value > 0).length / sampleSize, 4) : null,
  };
}

/**
 * 每人跟「同一技能、同一前測區間」的其他人比。
 * 人數少於 5 只標區間，不排名。
 */
function annotatePretestPeers(rows) {
  const groups = new Map();
  const placed = [];

  for (const row of rows || []) {
    const previousGse = Number(row.previousGse);
    const actual = Number(row.actualGseGrowth);
    if (!SKILL_ORDER.includes(row.skill) || !Number.isFinite(previousGse) || !Number.isFinite(actual)) {
      placed.push({ row, group: null });
      continue;
    }
    const band = gseBandForScore(previousGse);
    if (!band) {
      placed.push({ row, group: null });
      continue;
    }
    const key = `${row.skill}|${bandKey(band)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        bandKey: bandKey(band),
        label: band.label,
        gseMin: band.gseMin,
        gseMax: band.gseMax,
        values: [],
      });
    }
    groups.get(key).values.push(actual);
    placed.push({ row, group: groups.get(key), actual });
  }

  return placed.map(({ row, group, actual }) => {
    if (!group) return row;
    const stats = bandStats(group.values);
    const others = stats.sampleSize - 1;
    const beaten = others > 0
      ? group.values.filter((value) => value < actual).length
      : 0;
    const peerPercentile = stats.interpretable && others > 0
      ? Math.round((beaten / others) * 100)
      : null;
    return {
      ...row,
      pretestBandKey: group.bandKey,
      pretestBandLabel: group.label,
      pretestGseMin: group.gseMin,
      pretestGseMax: group.gseMax,
      peerSampleSize: stats.sampleSize,
      peerInterpretable: stats.interpretable,
      peerMedianGrowth: stats.medianActualGseGrowth,
      peerPercentile,
      peersBeaten: stats.interpretable ? beaten : null,
      peerGapFromMedian: stats.interpretable && stats.medianActualGseGrowth != null
        ? round(actual - stats.medianActualGseGrowth, 2)
        : null,
    };
  });
}

/**
 * 依該技能前測 GSE 所落的程度帶，彙總後續實際 GSE 成長。
 * 帶名（A2、B1+）只是 GSE 區間的稱呼，分組依據是 previousGse。
 */
function summarizeStartingGseGrowth(rows) {
  const groups = new Map();

  for (const row of rows || []) {
    if (!SKILL_ORDER.includes(row.skill)) continue;
    const previousGse = Number(row.previousGse);
    const actual = Number(row.actualGseGrowth);
    if (!Number.isFinite(previousGse) || !Number.isFinite(actual)) continue;
    const band = gseBandForScore(previousGse);
    if (!band) continue;
    const key = `${row.skill}|${bandKey(band)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        skill: row.skill,
        bandKey: bandKey(band),
        label: band.label,
        gseMin: band.gseMin,
        gseMax: band.gseMax,
        values: [],
      });
    }
    groups.get(key).values.push(actual);
  }

  const bySkill = new Map(SKILL_ORDER.map((skill) => [skill, []]));
  for (const group of groups.values()) {
    bySkill.get(group.skill).push({
      bandKey: group.bandKey,
      label: group.label,
      gseMin: group.gseMin,
      gseMax: group.gseMax,
      ...bandStats(group.values),
    });
  }

  return SKILL_ORDER
    .filter((skill) => bySkill.get(skill).length)
    .map((skill) => ({
      skill,
      bands: bySkill.get(skill).sort((a, b) => a.gseMin - b.gseMin),
    }));
}

module.exports = {
  MIN_INTERPRETABLE_SAMPLE,
  MEAN_MEDIAN_GAP,
  summarizeStartingGseGrowth,
  annotatePretestPeers,
};
