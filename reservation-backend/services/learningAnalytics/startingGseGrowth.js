'use strict';

const { gseBandForScore } = require('./gseScoreMappingService');

const MIN_INTERPRETABLE_SAMPLE = 5;
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
    const { values } = group;
    const sampleSize = values.length;
    const interpretable = sampleSize >= MIN_INTERPRETABLE_SAMPLE;
    const improvedCount = values.filter((value) => value > 0).length;
    bySkill.get(group.skill).push({
      bandKey: group.bandKey,
      label: group.label,
      gseMin: group.gseMin,
      gseMax: group.gseMax,
      sampleSize,
      interpretable,
      actualGseGrowthAverage: interpretable ? round(mean(values), 2) : null,
      improvedCount,
      growthStudentRatio: interpretable ? round(improvedCount / sampleSize, 4) : null,
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
  summarizeStartingGseGrowth,
};
