/**
 * 統一 scope 常數（第二階段：正式參與授權）
 */

const SCOPE = {
  ALL: 'all',
  ENGLISH_TABLE: 'english_table',
  INTERNATIONAL_FORUM: 'international_forum',
  JOB_TALK: 'job_talk',
  ENGLISH_CLUB: 'english_club',
  CLASS: 'class',
  SURVEY_ENGLISH_TABLE: 'survey_english_table',
  SURVEY_ENGLISH_CLUB: 'survey_english_club',
  ENGLISH_TEST: 'english_test',
};

const ALL_SCOPES = Object.freeze(Object.values(SCOPE));

module.exports = {
  SCOPE,
  ALL_SCOPES,
};

