'use strict';

const {
  BESTEP_CLASS_ANALYTICS_PILOT_ID,
  listBestepClassAnalyticsFields,
} = require('./bestepClassAnalyticsContract');

const ALLOWED_SOURCE_IDS = new Set([
  'bestep_exam_scores',
  'bestep_attendance',
  'english_test_registrations',
  'et_enrollment_snapshots',
  'exam_attempts',
  'et_exam_attempts',
  'bestep_team_rankings',
  'class_memberships',
  'classes',
  'learning_partner_teams',
  'learning_partner_team_members',
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(path) {
  return path.replace(/attendance\.([^.]+)/g, (all, key) => {
    if (key === '{examType}' || key === 'attended' || key === 'examDate' || key === 'absentReason') {
      return all;
    }
    return 'attendance.{examType}';
  });
}

function walk(value, path, visit) {
  if (path) visit(canonicalize(path), value);
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, `${path}[]`, visit));
    return;
  }
  if (!isObject(value)) return;
  Object.keys(value).forEach((key) => {
    walk(value[key], path ? `${path}.${key}` : key, visit);
  });
}

function typeOk(value, dataType) {
  if (dataType === 'object') return isObject(value);
  if (dataType === 'object_or_null') return value == null || isObject(value);
  if (dataType === 'array') return Array.isArray(value);
  if (dataType === 'integer') return Number.isInteger(value);
  if (dataType === 'integer_or_null') return value == null || Number.isInteger(value);
  if (dataType === 'number') return typeof value === 'number' && !Number.isNaN(value);
  if (dataType === 'number_or_null') return value == null || (typeof value === 'number' && !Number.isNaN(value));
  if (dataType === 'boolean') return typeof value === 'boolean';
  if (dataType === 'boolean_or_null') return value == null || typeof value === 'boolean';
  if (dataType === 'string_or_null') return value == null || typeof value === 'string';
  return true;
}

function warning(code, fieldPath) {
  return { code, fieldPath: fieldPath || null };
}

function governance() {
  return {
    officialUseAllowed: false,
    causalClaimAllowed: false,
    sourcePriorityApplied: false,
    mergePerformed: false,
  };
}

function emptyDiagnostic(status) {
  return {
    pilotId: BESTEP_CLASS_ANALYTICS_PILOT_ID,
    status,
    classifiedFields: 0,
    unknownFields: [],
    unmappedFields: [],
    proposedFields: [],
    warnings: status === 'undetermined' ? [warning('RESPONSE_UNUSABLE', null)] : [],
    attendanceEvidence: {
      confirmedPresent: 'not_observed',
      confirmedAbsent: 'not_observed',
      unknown: 'not_observed',
    },
    examSittings: null,
    sourceEvidence: {
      scoreTable: 'bestep_exam_scores',
      scoreAssessmentDate: 'unknown',
      mergedSources: false,
    },
    limitations: ['not_l3_validated', 'validator_does_not_recalculate'],
    governance: governance(),
    recalculated: false,
  };
}

function classifyAttendance(value, evidence) {
  if (!isObject(value) || !Object.prototype.hasOwnProperty.call(value, 'attended')) return;
  if (value.attended === true) evidence.confirmedPresent = 'observed';
  else if (value.attended === false) evidence.confirmedAbsent = 'observed';
  else evidence.unknown = 'observed';
}

function applyClaims(claims, warnings) {
  if (!isObject(claims)) return;
  if (claims.registrationHasCefrB2 === true) {
    warnings.push(warning('REGISTRATION_B2_FLAG_IS_NOT_FOUR_SKILL_PASS', 'students[].score.passed'));
  }
  if (claims.restoreStoredPlus === true) {
    warnings.push(warning('PLUS_NOT_RESTORED', 'students[].score.listeningLevel'));
  }
  if (claims.fileSemesterEqualsExamDate === true) {
    warnings.push(warning('FILE_SEMESTER_IS_NOT_EXAM_DATE', 'students[].attendance.{examType}.examDate'));
  }
  if (claims.mergeSources === true) {
    warnings.push(warning('MULTIPLE_SOURCES_NOT_MERGED', 'students[].score'));
  }
  if (claims.confirmedProjection === true) {
    warnings.push(warning('CONFIRMED_PROJECTION', null));
  }
  if (claims.possibleDuplicate === true) {
    warnings.push(warning('POSSIBLE_DUPLICATE', null));
  }
}

function applySourceNotes(notes, warnings) {
  if (!isObject(notes) || !Array.isArray(notes.records)) return;
  const ids = notes.records
    .map((row) => (row && ALLOWED_SOURCE_IDS.has(row.sourceId) ? row.sourceId : null))
    .filter(Boolean);
  if (new Set(ids).size > 1) {
    warnings.push(warning('MULTIPLE_SOURCES_NOT_MERGED', 'students[].score'));
  }
}

function evaluateBestepClassAnalytics(input) {
  const source = isObject(input) ? input : {};
  const response = source.response;
  if (!isObject(response)) return emptyDiagnostic('undetermined');

  const contracts = listBestepClassAnalyticsFields();
  const byPath = new Map(contracts.map((row) => [row.fieldPath, row]));
  const seen = new Set();
  const unknownFields = [];
  const warnings = [];
  const attendanceEvidence = {
    confirmedPresent: 'not_observed',
    confirmedAbsent: 'not_observed',
    unknown: 'not_observed',
  };
  let scoreObjectSeen = false;
  let scoreHasExamDate = false;

  try {
    walk(response, '', (path, value) => {
      seen.add(path);
      const contract = byPath.get(path);
      if (!contract) {
        if (!unknownFields.includes(path)) unknownFields.push(path);
        return;
      }
      if (!typeOk(value, contract.dataType) && !warnings.some((row) => row.code === 'TYPE_MISMATCH' && row.fieldPath === path)) {
        warnings.push(warning('TYPE_MISMATCH', path));
      }
      if (path === 'students[].attendance.{examType}') classifyAttendance(value, attendanceEvidence);
      if (path === 'students[].score' && isObject(value)) {
        scoreObjectSeen = true;
        if (Object.prototype.hasOwnProperty.call(value, 'examDate')) scoreHasExamDate = true;
      }
    });
  } catch (_err) {
    return emptyDiagnostic('undetermined');
  }

  ['classInfo', 'statistics', 'students', 'pagination'].forEach((path) => {
    if (!seen.has(path)) warnings.push(warning('MISSING_FIELD', path));
  });

  if (isObject(response.classInfo) && isObject(source.queryContext)
    && typeof response.classInfo.semester === 'string'
    && typeof source.queryContext.semester === 'string'
    && response.classInfo.semester !== source.queryContext.semester) {
    warnings.push(warning('TEMPORAL_CONTRACT_GAP', 'classInfo.semester'));
  }

  if (scoreObjectSeen && !scoreHasExamDate) {
    warnings.push(warning('SOURCE_ASSESSMENT_DATE_UNKNOWN', 'students[].score'));
  }

  applyClaims(source.claims, warnings);
  applySourceNotes(source.sourceNotes, warnings);

  const observedContracts = contracts.filter((row) => seen.has(row.fieldPath));
  const unmappedFields = observedContracts
    .filter((row) => row.metricMapping === 'unmapped')
    .map((row) => row.fieldPath);
  const proposedFields = observedContracts
    .filter((row) => row.metricMapping === 'proposed')
    .map((row) => row.fieldPath);
  const limitations = ['not_l3_validated', 'validator_does_not_recalculate'];
  observedContracts.forEach((row) => {
    row.limitations.forEach((code) => {
      if (!limitations.includes(code)) limitations.push(code);
    });
  });

  const status = unknownFields.length || warnings.length || unmappedFields.length || proposedFields.length
    ? 'partial'
    : 'complete';

  return {
    pilotId: BESTEP_CLASS_ANALYTICS_PILOT_ID,
    status,
    classifiedFields: observedContracts.length,
    unknownFields,
    unmappedFields,
    proposedFields,
    warnings,
    attendanceEvidence,
    examSittings: null,
    sourceEvidence: {
      scoreTable: 'bestep_exam_scores',
      scoreAssessmentDate: 'unknown',
      mergedSources: false,
    },
    limitations,
    governance: governance(),
    recalculated: false,
  };
}

module.exports = {
  evaluateBestepClassAnalytics,
};
