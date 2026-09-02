'use strict';

/**
 * 將教務修課匯入的 course_type / course_code 對應到 LVA 資源鍵（GE / EAP / ESP）。
 */
function normalizeAcademicCourseResourceType(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper === 'GE' || upper === 'EAP' || upper === 'ESP') return upper;
  if (/^EAP\d/.test(upper)) return 'EAP';
  if (/^ESP\d/.test(upper)) return 'ESP';
  if (/^GE\d/.test(upper)) return 'GE';
  if (/通識|general\s*english/i.test(raw)) return 'GE';
  if (/\beap\b|學術英文|academic/i.test(raw)) return 'EAP';
  if (/\besp\b|專業英文|職場英文|professional/i.test(raw)) return 'ESP';
  return null;
}

module.exports = {
  normalizeAcademicCourseResourceType,
};
