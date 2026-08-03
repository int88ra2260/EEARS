/**
 * 互動學習內容類型常數
 */

export const MINI_GAME_IDS = {
  WORD_BRIDGE: 'word_bridge',
  LISTENING_LADDER: 'listening_ladder',
  WORD_MATCH: 'word_match',
  SENTENCE_BUILDER: 'sentence_builder',
  ERROR_HUNTER: 'error_hunter',
};

export const LEARNING_GUIDE_IDS = {
  ACTIVITY_PHRASEBOOK: 'activity_phrasebook',
};

export const LISTENING_LADDER_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

export const LISTENING_QUESTION_TYPES = {
  SOUND_MATCH: 'sound_match',
  SYNONYM: 'synonym',
  DEFINITION: 'definition',
};

export const LISTENING_LADDER_DURATION_SECONDS = 90;

export const PHRASEBOOK_ACTIVITY_TYPES = [
  'English Table',
  'English Club',
  'International Forum',
  'Job Talk',
];

/** slug → EVENT_TYPES value */
export const SLUG_TO_PHRASEBOOK_ACTIVITY = {
  'english-table': 'English Table',
  'english-club': 'English Club',
  'international-forum': 'International Forum',
  'job-talk': 'Job Talk',
};
