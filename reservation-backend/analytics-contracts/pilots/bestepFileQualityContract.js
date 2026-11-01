'use strict';

const { ContractRegistryError } = require('../errors');

const PILOT_ID = 'bestep-file-quality';
const IMPORT_TYPE = 'bestep_score_import';
const LIST_KEYS = Object.freeze([
  'rawFileRows',
  'acceptedScoreRows',
  'skippedImportRows',
  'currentScoreRecords',
  'attendanceRows',
  'projectionRecords',
]);
const PROJECTION_TABLES = new Set(['exam_attempts', 'et_exam_attempts']);
const INPUT_ERROR = 'BESTEP_FILE_QUALITY_INPUT';

function fail(message) {
  throw new ContractRegistryError(INPUT_ERROR, message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value, label) {
  if (value == null) return null;
  if (typeof value !== 'string') fail(`${label} must be a string or null`);
  const text = value.trim();
  return text || null;
}

function readList(input, key) {
  if (!Object.prototype.hasOwnProperty.call(input, key)) {
    return { availability: 'not_observed', rows: [] };
  }
  if (!Array.isArray(input[key])) fail(`${key} must be an array when provided`);
  input[key].forEach((row, index) => {
    if (!isPlainObject(row)) fail(`${key}[${index}] must be an object`);
  });
  return { availability: 'provided', rows: input[key] };
}

function readRegistration(input) {
  if (!Object.prototype.hasOwnProperty.call(input, 'registrationPopulation')) {
    return { availability: 'not_observed', successRegistrationCount: null };
  }
  const value = input.registrationPopulation;
  if (!isPlainObject(value)) fail('registrationPopulation must be an object');
  if (value.availability === 'not_observed') {
    return { availability: 'not_observed', successRegistrationCount: null };
  }
  if (value.availability !== 'provided') fail('registrationPopulation.availability is invalid');
  const count = value.successRegistrationCount;
  if (!Number.isInteger(count) || count < 0) {
    fail('registrationPopulation.successRegistrationCount must be a non-negative integer');
  }
  return { availability: 'provided', successRegistrationCount: count };
}

function readHistory(input) {
  if (!Object.prototype.hasOwnProperty.call(input, 'importHistory')) {
    return { availability: 'not_observed', priorVersions: [] };
  }
  const value = input.importHistory;
  if (!isPlainObject(value)) fail('importHistory must be an object');
  if (value.availability === 'not_observed') {
    return { availability: 'not_observed', priorVersions: [] };
  }
  if (value.availability !== 'provided') fail('importHistory.availability is invalid');
  if (!Array.isArray(value.priorVersions)) fail('importHistory.priorVersions must be an array');
  return { availability: 'provided', priorVersions: value.priorVersions };
}

function assertAttendance(rows) {
  rows.forEach((row, index) => {
    if (!Object.prototype.hasOwnProperty.call(row, 'attended')) {
      fail(`attendanceRows[${index}].attended is required`);
    }
    if (row.attended != null && row.attended !== true && row.attended !== false) {
      fail(`attendanceRows[${index}].attended must be true, false, or null`);
    }
  });
}

function assertSkipped(rows) {
  rows.forEach((row, index) => {
    if (typeof row.code !== 'string' || !row.code.trim()) {
      fail(`skippedImportRows[${index}].code is required`);
    }
  });
}

function assertProjections(rows) {
  rows.forEach((row, index) => {
    if (!isPlainObject(row.row)) fail(`projectionRecords[${index}].row is required`);
    if (row.targetTable != null && !PROJECTION_TABLES.has(row.targetTable)) {
      fail(`projectionRecords[${index}].targetTable is invalid`);
    }
    if (row.skillScores != null && !Array.isArray(row.skillScores)) {
      fail(`projectionRecords[${index}].skillScores must be an array`);
    }
    if (row.dateProvenance != null
      && !['stated', 'inferred', 'unknown'].includes(row.dateProvenance)) {
      fail(`projectionRecords[${index}].dateProvenance is invalid`);
    }
  });
}

function parseBestepFileQualityInput(input) {
  if (!isPlainObject(input)) fail('input must be an object');
  if (input.pilotId != null && input.pilotId !== PILOT_ID) {
    fail('pilotId must be bestep-file-quality');
  }
  if (input.fileSemester != null && typeof input.fileSemester !== 'string') {
    fail('fileSemester must be a string or null');
  }
  if (input.source != null && !isPlainObject(input.source)) fail('source must be an object');

  const source = input.source || {};
  const lists = {};
  LIST_KEYS.forEach((key) => {
    lists[key] = readList(input, key);
  });
  if (lists.attendanceRows.availability === 'provided') assertAttendance(lists.attendanceRows.rows);
  if (lists.skippedImportRows.availability === 'provided') assertSkipped(lists.skippedImportRows.rows);
  if (lists.projectionRecords.availability === 'provided') assertProjections(lists.projectionRecords.rows);

  const registration = readRegistration(input);
  const history = readHistory(input);
  const snapshot = {
    pilotId: PILOT_ID,
    fileSemester: optionalString(input.fileSemester, 'fileSemester'),
    source: {
      importType: optionalString(source.importType, 'source.importType'),
      sourceFileId: optionalString(source.sourceFileId, 'source.sourceFileId'),
      importRunId: optionalString(source.importRunId, 'source.importRunId'),
      sourceFileSeen: Object.prototype.hasOwnProperty.call(source, 'sourceFileId'),
      importRunSeen: Object.prototype.hasOwnProperty.call(source, 'importRunId'),
    },
    lists,
    registration,
    history,
  };
  return structuredClone(snapshot);
}

module.exports = {
  BESTEP_FILE_QUALITY_PILOT_ID: PILOT_ID,
  BESTEP_SCORE_IMPORT_TYPE: IMPORT_TYPE,
  parseBestepFileQualityInput,
};
