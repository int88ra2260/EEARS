import {
  CEFR_SIZE_THRESHOLDS,
  FREQUENCY_BANDS,
  MAX_ESTIMATED_VOCABULARY,
  WORDS_PER_BAND,
} from './constants';

/**
 * @typedef {Object} BandResponseStat
 * @property {number} band
 * @property {number} known
 * @property {number} sampled
 */

/**
 * @typedef {Object} VocabularySizeAnswer
 * @property {string} word
 * @property {number} band
 * @property {boolean} known
 */

/**
 * @typedef {Object} VocabularySizeSessionSummary
 * @property {string} traceId
 * @property {number} durationMs
 * @property {VocabularySizeAnswer[]} answerLog
 * @property {number} totalKnown
 * @property {number} totalSampled
 */

/**
 * @param {VocabularySizeAnswer[]} answerLog
 * @returns {BandResponseStat[]}
 */
export function aggregateBandResponses(answerLog) {
  return FREQUENCY_BANDS.map(({ band }) => {
    const inBand = answerLog.filter((a) => a.band === band);
    return {
      band,
      known: inBand.filter((a) => a.known).length,
      sampled: inBand.length || WORDS_PER_BAND,
    };
  });
}

/**
 * 依各帶認識率外推總詞彙量（Lenguia 頻率帶外推法）
 * @param {BandResponseStat[]} bandStats
 */
export function estimateVocabularySize(bandStats) {
  let total = 0;
  for (const stat of bandStats) {
    const meta = FREQUENCY_BANDS.find((b) => b.band === stat.band);
    if (!meta) continue;
    const rate = stat.sampled > 0 ? stat.known / stat.sampled : 0;
    total += rate * meta.bandSize;
  }
  return Math.min(Math.round(total), MAX_ESTIMATED_VOCABULARY);
}

/**
 * @param {number} estimatedWords
 * @returns {import('./constants').VocabularySizeCefrLevel}
 */
export function mapSizeToCefr(estimatedWords) {
  for (const threshold of CEFR_SIZE_THRESHOLDS) {
    if (estimatedWords <= threshold.maxWords) {
      return threshold.level;
    }
  }
  return 'C2';
}

/**
 * @param {number} estimatedWords
 * @param {string} cefrLevel
 */
export function wordsToNextCefrLevel(estimatedWords, cefrLevel) {
  const idx = CEFR_SIZE_THRESHOLDS.findIndex((t) => t.level === cefrLevel);
  if (idx < 0 || idx >= CEFR_SIZE_THRESHOLDS.length - 1) return 0;
  const next = CEFR_SIZE_THRESHOLDS[idx + 1];
  return Math.max(0, next.minWords - estimatedWords);
}

/**
 * @param {number} known
 * @param {number} sampled
 */
export function recognitionRate(known, sampled) {
  if (!sampled) return 0;
  return known / sampled;
}

/**
 * @param {VocabularySizeSessionSummary} summary
 */
export function computeVocabularySizeResult(summary) {
  const bandStats = aggregateBandResponses(summary.answerLog || []);
  const estimatedWords = estimateVocabularySize(bandStats);
  const estimatedLevel = mapSizeToCefr(estimatedWords);
  const totalKnown = summary.totalKnown ?? summary.answerLog.filter((a) => a.known).length;
  const totalSampled = summary.totalSampled ?? summary.answerLog.length;
  const recognition = recognitionRate(totalKnown, totalSampled);

  return {
    estimatedWords,
    estimatedLevel,
    recognitionRate: recognition,
    wordsToNextLevel: wordsToNextCefrLevel(estimatedWords, estimatedLevel),
    bandStats,
    endReason: 'completed',
    stats: {
      totalKnown,
      totalSampled,
      bandsTested: FREQUENCY_BANDS.length,
      wordsPerBand: WORDS_PER_BAND,
    },
  };
}
