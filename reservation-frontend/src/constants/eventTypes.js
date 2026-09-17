// src/constants/eventTypes.js
import {
  DEFAULT_EVENT_TYPES,
  DEFAULT_EVENT_TYPE_CODE,
  normalizeEventTypeCode,
} from './eventTypeCatalog';

export const EVENT_TYPES = {
  ENGLISH_TABLE: 'english_table',
  JOB_TALK: 'job_talk',
  ENGLISH_CLUB: 'english_club',
  INTERNATIONAL_FORUM: 'international_forum',
};

export const EVENT_TYPE_LIST = Object.values(EVENT_TYPES);

export const EVENT_TYPE_ABBREVIATIONS = Object.freeze(
  Object.fromEntries(DEFAULT_EVENT_TYPES.map((r) => [r.code, r.abbreviation]))
);

export const EVENT_TYPE_DISPLAY_NAMES = Object.freeze(
  Object.fromEntries(DEFAULT_EVENT_TYPES.map((r) => [r.code, r.displayName]))
);

export const DEFAULT_EVENT_TYPE = DEFAULT_EVENT_TYPE_CODE;

export const getEventAbbreviation = (eventType) => {
  const code = normalizeEventTypeCode(eventType) || eventType;
  return EVENT_TYPE_ABBREVIATIONS[code] || EVENT_TYPE_DISPLAY_NAMES[code] || eventType;
};

export const getEventDisplayName = (eventType) => {
  const code = normalizeEventTypeCode(eventType) || eventType;
  return EVENT_TYPE_DISPLAY_NAMES[code] || eventType;
};
