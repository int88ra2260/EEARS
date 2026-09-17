'use strict';

/**
 * 培力英檢報名 examType 正規化為代碼：LRSW | LR | SW | NON
 * 歷史資料／表單編輯器曾把中文 label 寫成 value，需可逆對應。
 */

const CANONICAL_EXAM_TYPES = Object.freeze(['LRSW', 'LR', 'SW', 'NON']);

const EXACT_ALIAS_TO_CODE = Object.freeze({
  LRSW: 'LRSW',
  LR: 'LR',
  SW: 'SW',
  NON: 'NON',
  '聽說讀寫（LRSW）': 'LRSW',
  '四項全考（LRSW）': 'LRSW',
  '聽讀說寫': 'LRSW',
  '聽讀（LR）': 'LR',
  '說寫（SW）': 'SW',
  '不報考（NON）': 'NON',
  '不報考': 'NON',
});

/**
 * @param {unknown} raw
 * @returns {'LRSW'|'LR'|'SW'|'NON'|null}
 */
function normalizeExamTypeCode(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  if (EXACT_ALIAS_TO_CODE[s]) return EXACT_ALIAS_TO_CODE[s];

  const upper = s.toUpperCase();
  if (CANONICAL_EXAM_TYPES.includes(upper)) return upper;

  if (s.includes('（LRSW）') || s.includes('(LRSW)') || /^聽說讀寫/.test(s) || /^四項全考/.test(s)) {
    return 'LRSW';
  }
  if (s.includes('（NON）') || s.includes('(NON)') || /^不報考/.test(s)) {
    return 'NON';
  }
  if (s.includes('（SW）') || s.includes('(SW)') || /^說寫/.test(s)) {
    return 'SW';
  }
  if (s.includes('（LR）') || s.includes('(LR)') || /^聽讀/.test(s)) {
    return 'LR';
  }

  return null;
}

function isCanonicalExamType(value) {
  return CANONICAL_EXAM_TYPES.includes(String(value || '').trim().toUpperCase());
}

/**
 * 將 schema 的 examType options 正規成代碼 value（保留／補齊 label）。
 * @param {Array<{value?: string, label?: string}|string>} options
 * @param {Array<{value: string, label: string}>} [defaultOptions]
 */
function normalizeExamTypeOptions(options, defaultOptions = []) {
  const defaultByCode = new Map(
    (defaultOptions || [])
      .map((o) => {
        const code = normalizeExamTypeCode(o?.value ?? o?.label ?? o);
        return code ? [code, { value: code, label: String(o.label || o.value || code) }] : null;
      })
      .filter(Boolean)
  );

  const seen = new Set();
  const next = [];
  for (const raw of options || []) {
    const value = typeof raw === 'string' ? raw : raw?.value;
    const label = typeof raw === 'string' ? raw : raw?.label;
    const code = normalizeExamTypeCode(value) || normalizeExamTypeCode(label);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const fallback = defaultByCode.get(code);
    next.push({
      value: code,
      label: String(label || fallback?.label || code).trim() || code,
    });
  }

  // 若缺標準四項，用預設補上
  for (const code of CANONICAL_EXAM_TYPES) {
    if (seen.has(code)) continue;
    const fallback = defaultByCode.get(code);
    if (fallback) {
      next.push({ ...fallback });
      seen.add(code);
    }
  }

  return next;
}

module.exports = {
  CANONICAL_EXAM_TYPES,
  EXACT_ALIAS_TO_CODE,
  normalizeExamTypeCode,
  isCanonicalExamType,
  normalizeExamTypeOptions,
};
