/**
 * 語彙連橋中英對照表（執行時由 canonical vocabulary bank 提供）
 */

import { getWordZh as getCanonicalWordZh } from './learningContent/vocabulary/index.js';

/**
 * @param {string} englishWord
 * @returns {string|null}
 */
export function getWordZh(englishWord) {
  return getCanonicalWordZh(englishWord);
}

/**
 * @param {Array<{ level: string, reason: 'wrong_group'|'timeout', words: string[] }>} mistakeLog
 * @returns {Array<{ en: string, zh: string|null, level: string, count: number }>}
 */
export function buildMistakeWordRows(mistakeLog) {
  if (!Array.isArray(mistakeLog) || mistakeLog.length === 0) {
    return [];
  }

  /** @type {Map<string, { level: string, count: number }>} */
  const byEn = new Map();
  /** @type {string[]} */
  const order = [];

  for (const entry of mistakeLog) {
    if (!entry || entry.reason !== 'wrong_group' || !Array.isArray(entry.words)) {
      continue;
    }
    for (const en of entry.words) {
      if (!en || typeof en !== 'string') {
        continue;
      }
      const existing = byEn.get(en);
      if (existing) {
        existing.count += 1;
      } else {
        byEn.set(en, { level: entry.level, count: 1 });
        order.push(en);
      }
    }
  }

  return order.map((en) => {
    const { level, count } = byEn.get(en);
    return {
      en,
      zh: getWordZh(en),
      level,
      count,
    };
  });
}
