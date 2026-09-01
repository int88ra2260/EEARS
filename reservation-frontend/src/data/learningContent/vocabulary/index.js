/**
 * EEARS Canonical Vocabulary Bank — 微學習共用詞彙查詢 API
 */
import {
  CANONICAL_VOCABULARY,
  CANONICAL_BY_WORD,
  CANONICAL_ZH_BY_WORD,
} from './canonicalVocabulary.js';
import { WORD_BRIDGE_THEME_BANKS } from '../../wordBridgeThemes.js';

export {
  CANONICAL_VOCABULARY,
  CANONICAL_BY_WORD,
  CANONICAL_ZH_BY_WORD,
};

/**
 * @param {string} word
 * @returns {import('./types').CanonicalVocabEntry|null}
 */
export function getCanonicalEntry(word) {
  if (!word || typeof word !== 'string') return null;
  return CANONICAL_BY_WORD[word] ?? CANONICAL_BY_WORD[word.toLowerCase()] ?? null;
}

/**
 * @param {string} englishWord
 * @returns {string|null}
 */
export function getWordZh(englishWord) {
  if (!englishWord || typeof englishWord !== 'string') return null;
  return CANONICAL_ZH_BY_WORD[englishWord] ?? CANONICAL_ZH_BY_WORD[englishWord.toLowerCase()] ?? null;
}

/**
 * @param {string} [level]
 * @returns {import('./types').CanonicalVocabEntry[]}
 */
export function getVocabularyByLevel(level) {
  if (!level) return [...CANONICAL_VOCABULARY];
  return CANONICAL_VOCABULARY.filter((entry) => entry.level === level);
}

/**
 * @param {string} source — word_bridge | listening_ladder
 */
export function getVocabularyBySource(source) {
  return CANONICAL_VOCABULARY.filter((entry) => entry.sources.includes(source));
}

/** 聽力階梯可用詞彙（含 listening 欄位） */
export function getListeningLadderVocabulary() {
  return CANONICAL_VOCABULARY.filter((entry) => entry.listening);
}

/** 驗證 Word Bridge 主題詞是否皆有 canonical 條目 */
export function assertWordBridgeThemeCoverage() {
  const themeWords = new Set(
    Object.values(WORD_BRIDGE_THEME_BANKS).flatMap((themes) =>
      themes.flatMap((theme) => theme.words),
    ),
  );
  const missing = [];
  for (const word of themeWords) {
    if (!getWordZh(word)) missing.push(word);
  }
  if (missing.length > 0) {
    throw new Error(`canonical vocabulary: missing zh for theme words: ${missing.join(', ')}`);
  }
}

assertWordBridgeThemeCoverage();

/**
 * @returns {Record<string, number>}
 */
export function getLevelDistribution() {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const entry of CANONICAL_VOCABULARY) {
    counts[entry.level] = (counts[entry.level] || 0) + 1;
  }
  return counts;
}
