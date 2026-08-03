'use strict';

/** 作答 JSON 中的受訪者／系統欄位，不應計入「題目無法對照 schema」 */
const METADATA_ANSWER_KEYS = new Set([
  'studentid',
  'studentname',
  'name',
  'email',
  'studentemail',
  'semester',
  'semesterkey',
  'eventid',
  'reservationid',
  'activitytype',
  'eventtype',
  'status',
  'submissionstatus',
  'phone',
  'source',
  '__legacyactivitytype',
  'createdat',
  'updatedat',
  'id',
]);

/** 舊版欄位名 → 現行 schema question id */
const QUESTION_KEY_ALIASES = {
  interviewemail: 'interview_email',
  timesthissemester: 'times_this_semester',
  reasonattend: 'reason_attend',
  informationchannel: 'information_channel',
  abilityimproved: 'ability_improved',
  abilitydescription: 'ability_description',
  othercomments: 'other_comments',
};

function normKey(key) {
  return String(key || '').trim().toLowerCase();
}

function isSurveyAnswerMetadataKey(questionKey) {
  return METADATA_ANSWER_KEYS.has(normKey(questionKey));
}

function resolveSurveyQuestionKeyAlias(questionKey) {
  const raw = String(questionKey || '').trim();
  if (!raw) return raw;
  const aliased = QUESTION_KEY_ALIASES[normKey(raw)];
  return aliased || raw;
}

module.exports = {
  METADATA_ANSWER_KEYS,
  QUESTION_KEY_ALIASES,
  isSurveyAnswerMetadataKey,
  resolveSurveyQuestionKeyAlias,
};
