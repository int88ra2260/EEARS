'use strict';

const QUALITY_FLAGS = Object.freeze([
  'MISSING_ASSESSMENT_DATE',
  'INFERRED_ASSESSMENT_DATE',
  'SEMESTER_ONLY_DATE',
  'MISSING_CEFR_LEVEL',
  'MISSING_RAW_SCORE',
  'NORMALIZED_CEFR_LOSS',
  'UNKNOWN_SOURCE_IDENTITY',
  'UNVERIFIED_PROJECTION',
  'POSSIBLE_DUPLICATE',
  'SOURCE_CONFLICT',
  'INSTRUMENT_NOT_COMPARABLE',
  'UNKNOWN_IMPORT_BATCH',
]);

const FLAG_SET = new Set(QUALITY_FLAGS);

function normalizeFlags(flags) {
  const unique = [];
  (flags || []).forEach((flag) => {
    if (!FLAG_SET.has(flag) || unique.includes(flag)) return;
    unique.push(flag);
  });
  unique.sort();
  return Object.freeze(unique);
}

module.exports = {
  QUALITY_FLAGS,
  normalizeFlags,
};
