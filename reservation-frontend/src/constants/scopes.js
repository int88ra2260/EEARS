export const SCOPE = {
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

export const ALL_SCOPES = Object.freeze(Object.values(SCOPE));

/** 非活動類型的系統業務 scope（帳號編輯「其他業務」區） */
export const SYSTEM_SCOPES = Object.freeze([
  SCOPE.ALL,
  SCOPE.CLASS,
  SCOPE.SURVEY_ENGLISH_TABLE,
  SCOPE.SURVEY_ENGLISH_CLUB,
  SCOPE.ENGLISH_TEST,
]);

const SYSTEM_SCOPE_SET = new Set(SYSTEM_SCOPES);

export function isSystemScope(scope) {
  return SYSTEM_SCOPE_SET.has(String(scope || '').trim());
}

/** 活動類型 scope：snake_case 且非系統 scope */
export function isEventActivityScope(scope) {
  const key = String(scope || '').trim();
  if (!key || isSystemScope(key)) return false;
  return /^[a-z][a-z0-9_]{1,63}$/.test(key);
}
