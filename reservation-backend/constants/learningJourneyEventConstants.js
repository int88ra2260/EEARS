'use strict';

const RULE_VERSION = 'lj-analytics-2026-v1';
const BUILD_VERSION = '1.0.0';

const EVENT_TYPES = Object.freeze({
  BASELINE: 'baseline_score',
  EXAM: 'exam_event',
  COURSE: 'course_event',
  ACTIVITY: 'activity_event',
});

const EVENT_STATUS = Object.freeze({
  VALID: 'valid',
  REGISTERED_NO_SCORE: 'registered_no_score',
  VOID: 'void',
  EXCLUDED: 'excluded',
});

const REASON_CODES = Object.freeze({
  OVERSEAS: 'overseas',
  DUPLICATE: 'duplicate',
  INVALID_SCORE: 'invalid_score',
  WITHDRAWN: 'withdrawn',
  IN_PROGRESS: 'in_progress',
  REGISTERED_NO_SCORE: 'registered_no_score',
  MANUAL_REVIEW: 'manual_review',
  IMPORT_ROLLBACK: 'import_rollback',
  OTHER: 'other',
});

const TIMING = Object.freeze({
  ENTRY: 'entry',
  IN_COURSE: 'in_course',
  VOLUNTARY: 'voluntary',
  EXIT: 'exit',
});

const EXPOSURE_LEVELS = Object.freeze({
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

const SKILLS = Object.freeze(['listening', 'reading', 'speaking', 'writing']);

/** 用於 lj_student_events 唯一鍵；MySQL UNIQUE 欄位為 NULL 時無法去重，故以空字串表示「無技能維度」。 */
const SKILL_UNSPECIFIED = '';

const B2_RANK = 4;

module.exports = {
  RULE_VERSION,
  BUILD_VERSION,
  EVENT_TYPES,
  EVENT_STATUS,
  REASON_CODES,
  TIMING,
  EXPOSURE_LEVELS,
  SKILLS,
  SKILL_UNSPECIFIED,
  B2_RANK,
};
