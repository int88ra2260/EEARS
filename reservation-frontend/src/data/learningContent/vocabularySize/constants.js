/** @typedef {'A1'|'A2'|'B1'|'B2'|'C1'|'C2'} VocabularySizeCefrLevel */

export const VOCABULARY_SIZE_GAME_ID = 'vocabulary_size';

/** Lenguia 風格：10 個頻率帶，涵蓋最常見 10,000 詞 */
export const FREQUENCY_BANDS = [
  { band: 1, rankMin: 1, rankMax: 1000, bandSize: 1000 },
  { band: 2, rankMin: 1001, rankMax: 2000, bandSize: 1000 },
  { band: 3, rankMin: 2001, rankMax: 3000, bandSize: 1000 },
  { band: 4, rankMin: 3001, rankMax: 4000, bandSize: 1000 },
  { band: 5, rankMin: 4001, rankMax: 5000, bandSize: 1000 },
  { band: 6, rankMin: 5001, rankMax: 6000, bandSize: 1000 },
  { band: 7, rankMin: 6001, rankMax: 7000, bandSize: 1000 },
  { band: 8, rankMin: 7001, rankMax: 8000, bandSize: 1000 },
  { band: 9, rankMin: 8001, rankMax: 9000, bandSize: 1000 },
  { band: 10, rankMin: 9001, rankMax: 10000, bandSize: 1000 },
];

export const WORDS_PER_BAND = 5;
export const TOTAL_TEST_WORDS = FREQUENCY_BANDS.length * WORDS_PER_BAND;

/** Paul Nation / CEFR 近似門檻（Lenguia 方法論） */
export const CEFR_SIZE_THRESHOLDS = [
  { level: 'A1', minWords: 0, maxWords: 1000 },
  { level: 'A2', minWords: 1001, maxWords: 2000 },
  { level: 'B1', minWords: 2001, maxWords: 3500 },
  { level: 'B2', minWords: 3501, maxWords: 5000 },
  { level: 'C1', minWords: 5001, maxWords: 8000 },
  { level: 'C2', minWords: 8001, maxWords: 10000 },
];

export const MAX_ESTIMATED_VOCABULARY = 10000;
