'use strict';

const { normalizeCefr } = require('../learningJourney/utils/cefr');

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

/**
 * 只讀已另行記載的 CEFR。學測級分與起始分級（初級／中級／中高級／高級）不換算成 CEFR。
 */
function resolveBaselineCefrBand(student = {}) {
  return normalizeBaselineCefrKey(student.baselineCefr);
}

function applyBaselineLevelFilter(students, query = {}) {
  const target = normalizeBaselineCefrKey(query.baseline_level);
  if (!target) return students;
  return students.filter((student) => resolveBaselineCefrBand(student) === target);
}

module.exports = {
  normalizeBaselineCefrKey,
  resolveBaselineCefrBand,
  applyBaselineLevelFilter,
};
