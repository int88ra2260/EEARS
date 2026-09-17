// constants/eventTypes.js
// 活動類型常數（相容層）。正式來源為 event_types 表／eventTypeCatalog。

const {
  DEFAULT_EVENT_TYPES,
  DEFAULT_EVENT_TYPE_CODE,
} = require('./eventTypeCatalog');

const EVENT_TYPES = {
  ENGLISH_TABLE: 'english_table',
  JOB_TALK: 'job_talk',
  ENGLISH_CLUB: 'english_club',
  INTERNATIONAL_FORUM: 'international_forum',
};

/** @deprecated 顯示名；請優先用 code */
const EVENT_TYPE_DISPLAY_NAMES = Object.freeze(
  Object.fromEntries(DEFAULT_EVENT_TYPES.map((r) => [r.code, r.displayName]))
);

const EVENT_TYPE_LIST = Object.values(EVENT_TYPES);

const EVENT_TYPE_ABBREVIATIONS = Object.freeze(
  Object.fromEntries(DEFAULT_EVENT_TYPES.map((r) => [r.code, r.abbreviation]))
);

const DEFAULT_EVENT_TYPE = DEFAULT_EVENT_TYPE_CODE;

module.exports = {
  EVENT_TYPES,
  EVENT_TYPE_LIST,
  EVENT_TYPE_ABBREVIATIONS,
  EVENT_TYPE_DISPLAY_NAMES,
  DEFAULT_EVENT_TYPE,
};
