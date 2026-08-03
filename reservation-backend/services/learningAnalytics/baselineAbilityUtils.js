'use strict';

const { normalizeCefr } = require('../learningJourney/utils/cefr');

/** 學測英文總分（0–20）→ CEFR 分層（內部分析用，非認證對照） */
const GSAT_OVERALL_RULES = Object.freeze([
  { min: 18, cefr: 'C1' },
  { min: 15, cefr: 'B2' },
  { min: 12, cefr: 'B1' },
  { min: 9, cefr: 'A2' },
  { min: 6, cefr: 'A1' },
  { min: 1, cefr: 'BELOW_A1' },
]);

const BASELINE_CEFR_KEYS = new Set([
  'BELOW_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2',
]);

function normalizeBaselineCefrKey(raw) {
  const normalized = normalizeCefr(raw);
  if (normalized) return normalized;
  const value = String(raw || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (value === 'BELOW_A1' || value === 'PRE_A1' || value === '未達_A1') return 'BELOW_A1';
  return BASELINE_CEFR_KEYS.has(value) ? value : null;
}

function inferGsatOverallCefr(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n <= 0) return null;
  const sorted = [...GSAT_OVERALL_RULES].sort((a, b) => b.min - a.min);
  const matched = sorted.find((rule) => n >= rule.min);
  return matched?.cefr || null;
}

/**
 * 解析學生起始能力 CEFR 帶（供篩選／分組）。
 * 優先順序：已存 baselineCefr → 學測分數推導 → baselineLevel 若本身為 CEFR。
 */
function resolveBaselineCefrBand(student = {}) {
  const fromColumn = normalizeBaselineCefrKey(student.baselineCefr);
  if (fromColumn) return fromColumn;

  const fromGsat = inferGsatOverallCefr(student.baselineEnglishScore);
  if (fromGsat) return fromGsat;

  return normalizeBaselineCefrKey(student.baselineLevel);
}

function applyBaselineLevelFilter(students, query = {}) {
  const target = normalizeBaselineCefrKey(query.baseline_level);
  if (!target) return students;
  return students.filter((student) => resolveBaselineCefrBand(student) === target);
}

module.exports = {
  GSAT_OVERALL_RULES,
  normalizeBaselineCefrKey,
  inferGsatOverallCefr,
  resolveBaselineCefrBand,
  applyBaselineLevelFilter,
};
