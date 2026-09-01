/** @typedef {'A1'|'A2'|'B1'|'B2'|'C1'} VocabularyDepthLevel */
/** @typedef {'definition'|'context'|'synonym'|'collocation'|'nuance'} VocabularyDepthQuestionType */

export const VOCABULARY_DEPTH_LEVELS = /** @type {const} */ (['A1', 'A2', 'B1', 'B2', 'C1']);

export const VOCABULARY_DEPTH_GAME_ID = 'vocabulary_depth';

/** MVP: 6 題/級；正式版可改 10 */
export const QUESTIONS_PER_LEVEL = 6;

/** Lenguia 風格：每級需答對比例 */
export const PASS_RATIO = 2 / 3;

export const QUESTION_TYPE_BY_LEVEL = {
  A1: 'definition',
  A2: 'context',
  B1: 'synonym',
  B2: 'collocation',
  C1: 'nuance',
};

/**
 * @param {number} perLevel
 * @param {number} [ratio]
 */
export function passThresholdForLevel(perLevel = QUESTIONS_PER_LEVEL, ratio = PASS_RATIO) {
  return Math.ceil(perLevel * ratio);
}
