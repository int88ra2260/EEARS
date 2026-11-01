'use strict';

/**
 * BESTEP 檔案品質診斷碼。
 * 嚴重程度只描述證據缺口，不描述學生能力。
 */
const BESTEP_FILE_QUALITY_FINDINGS = Object.freeze([
  Object.freeze({ code: 'SOURCE_FILE_UNKNOWN', severity: 'warning', dimension: 'sourceCompleteness' }),
  Object.freeze({ code: 'IMPORT_RUN_UNKNOWN', severity: 'warning', dimension: 'sourceCompleteness' }),
  Object.freeze({ code: 'FILE_SEMESTER_MISSING', severity: 'error', dimension: 'sourceCompleteness' }),
  Object.freeze({ code: 'IMPORT_TYPE_UNKNOWN', severity: 'warning', dimension: 'sourceCompleteness' }),
  Object.freeze({ code: 'SKILL_SCORE_MISSING', severity: 'warning', dimension: 'skillCompleteness' }),
  Object.freeze({ code: 'SKILL_CEFR_MISSING', severity: 'warning', dimension: 'skillCompleteness' }),
  Object.freeze({ code: 'SKILL_VALUE_INVALID', severity: 'warning', dimension: 'skillCompleteness' }),
  Object.freeze({ code: 'SOURCE_EXAM_DATE_MISSING', severity: 'warning', dimension: 'dateProvenance' }),
  Object.freeze({ code: 'PROJECTED_DATE_INFERRED', severity: 'warning', dimension: 'dateProvenance' }),
  Object.freeze({ code: 'DATE_PROVENANCE_UNKNOWN', severity: 'unknown', dimension: 'dateProvenance' }),
  Object.freeze({ code: 'DATE_CONFLICT', severity: 'warning', dimension: 'dateProvenance' }),
  Object.freeze({ code: 'ATTENDANCE_UNKNOWN', severity: 'unknown', dimension: 'registrationAttendance' }),
  Object.freeze({ code: 'ATTENDANCE_CONFIRMED_ABSENT', severity: 'informational', dimension: 'registrationAttendance' }),
  Object.freeze({ code: 'IMPORT_ROW_SKIPPED_UNMATCHED', severity: 'warning', dimension: 'registrationAttendance' }),
  Object.freeze({ code: 'REGISTRATION_POPULATION_NOT_OBSERVED', severity: 'unknown', dimension: 'registrationAttendance' }),
  Object.freeze({ code: 'PROJECTION_UNVERIFIED', severity: 'unknown', dimension: 'projectionConsistency' }),
  Object.freeze({ code: 'PROJECTION_CONTENT_CONFLICT', severity: 'warning', dimension: 'projectionConsistency' }),
  Object.freeze({ code: 'POSSIBLE_DUPLICATE_UNMERGED', severity: 'informational', dimension: 'projectionConsistency' }),
  Object.freeze({ code: 'SOURCE_INFORMATION_LOSS', severity: 'warning', dimension: 'informationLoss' }),
  Object.freeze({ code: 'REIMPORT_HISTORY_UNKNOWN', severity: 'unknown', dimension: 'informationLoss' }),
]);

const BY_CODE = new Map(BESTEP_FILE_QUALITY_FINDINGS.map((row) => [row.code, row]));

function getBestepFileQualityFinding(code) {
  const found = BY_CODE.get(code);
  if (!found) {
    throw new Error(`unknown BESTEP file quality finding: ${code}`);
  }
  return found;
}

module.exports = {
  BESTEP_FILE_QUALITY_FINDINGS,
  getBestepFileQualityFinding,
};
