import {
  VOCABULARY_DEPTH_LEVELS,
  QUESTIONS_PER_LEVEL,
  passThresholdForLevel,
} from './constants';

const LEVEL_RANK = Object.fromEntries(VOCABULARY_DEPTH_LEVELS.map((l, i) => [l, i]));

/**
 * @typedef {Object} LevelStat
 * @property {string} level
 * @property {number} correct
 * @property {number} total
 * @property {boolean} passed
 */

/**
 * @typedef {Object} VocabularyDepthSessionSummary
 * @property {string} traceId
 * @property {number} durationMs
 * @property {string[]} passedLevels
 * @property {string|null} failLevel
 * @property {string} endReason
 * @property {LevelStat[]} levelStats
 * @property {{ questionId: string, level: string, word: string, isCorrect: boolean }[]} answerLog
 * @property {number} totalCorrect
 * @property {number} totalAnswered
 */

/**
 * @param {VocabularyDepthSessionSummary} summary
 */
export function computeVocabularyDepthResult(summary) {
  const threshold = passThresholdForLevel(QUESTIONS_PER_LEVEL);
  const { passedLevels, failLevel, endReason, levelStats } = summary;
  const totalAnswered = summary.totalAnswered || 0;
  const totalCorrect = summary.totalCorrect || 0;
  const accuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : null;

  let estimatedLevel = 'A1';
  if (endReason === 'cleared_c1') {
    estimatedLevel = 'C1';
  } else if (passedLevels.length > 0) {
    estimatedLevel = passedLevels[passedLevels.length - 1];
  } else if (failLevel) {
    const rank = LEVEL_RANK[failLevel] ?? 1;
    estimatedLevel = rank <= 1 ? 'A1' : VOCABULARY_DEPTH_LEVELS[rank - 2];
  }

  const lastStat = levelStats[levelStats.length - 1];
  let confidence = 'medium';
  if (lastStat && lastStat.passed && lastStat.correct === lastStat.total) {
    confidence = 'high';
  } else if (lastStat && !lastStat.passed && lastStat.correct <= 1) {
    confidence = 'low';
  } else if (lastStat && lastStat.passed && lastStat.correct === threshold) {
    confidence = 'low';
  }

  return {
    estimatedLevel,
    passedLevels: [...passedLevels],
    failLevel: failLevel || null,
    endReason,
    accuracy,
    levelStats,
    confidence,
    stats: {
      totalCorrect,
      totalAnswered,
      passThreshold: threshold,
      questionsPerLevel: QUESTIONS_PER_LEVEL,
    },
  };
}

/**
 * @param {string} level
 * @param {number} correct
 * @param {number} total
 */
export function didPassLevel(level, correct, total = QUESTIONS_PER_LEVEL) {
  return correct >= passThresholdForLevel(total);
}

/**
 * @param {string} currentLevel
 */
export function nextLevel(currentLevel) {
  const idx = VOCABULARY_DEPTH_LEVELS.indexOf(currentLevel);
  if (idx < 0 || idx >= VOCABULARY_DEPTH_LEVELS.length - 1) return null;
  return VOCABULARY_DEPTH_LEVELS[idx + 1];
}
