import { LISTENING_LADDER_LEVELS } from '../../constants/learningContentTypes';

export const SCORE_BY_LEVEL = {
  A1: 50,
  A2: 70,
  B1: 100,
  B2: 130,
  C1: 170,
  C2: 220,
};

export const STREAK_BONUS_THRESHOLD = 3;
export const STREAK_BONUS_POINTS = 20;

export const LADDER_UP_STREAK = 2;
export const LADDER_DOWN_STREAK = 2;

/**
 * @param {string} level
 * @param {number} streak
 */
export function scoreForCorrect(level, streak) {
  const base = SCORE_BY_LEVEL[level] ?? SCORE_BY_LEVEL.A1;
  const bonus = streak >= STREAK_BONUS_THRESHOLD ? STREAK_BONUS_POINTS : 0;
  return base + bonus;
}

/**
 * @param {string} level
 * @param {'up'|'down'|'same'} direction
 */
export function adjustLevel(level, direction) {
  const idx = LISTENING_LADDER_LEVELS.indexOf(level);
  if (idx < 0) return LISTENING_LADDER_LEVELS[0];
  if (direction === 'up') {
    return LISTENING_LADDER_LEVELS[Math.min(idx + 1, LISTENING_LADDER_LEVELS.length - 1)];
  }
  if (direction === 'down') {
    return LISTENING_LADDER_LEVELS[Math.max(idx - 1, 0)];
  }
  return level;
}

/**
 * @param {number} correct
 * @param {number} total
 */
export function computeAccuracy(correct, total) {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}
