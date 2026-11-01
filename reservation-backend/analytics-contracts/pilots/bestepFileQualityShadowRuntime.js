'use strict';

const { evaluateBestepFileQuality } = require('./bestepFileQualityValidator');

const MAX_SHADOW_ROWS = 200;
const PILOT_ID = 'bestep-file-quality';
const ENABLED_ENVS = new Set(['test', 'development', 'staging']);
const SCORE_FIELDS = Object.freeze([
  ['listeningScore', 'listeningScore'],
  ['readingScore', 'readingScore'],
  ['speakingScore', 'speakingScore'],
  ['writingScore', 'writingScore'],
]);
const LEVEL_FIELDS = Object.freeze([
  ['listeningLevel', 'listeningLevel'],
  ['readingLevel', 'readingLevel'],
  ['speakingLevel', 'speakingLevel'],
  ['writingLevel', 'writingLevel'],
]);

function isBestepFileQualityShadowEnabled(env = process.env) {
  const source = env || {};
  if (String(source.BESTEP_FILE_QUALITY_SHADOW_ENABLED || '').trim() !== 'true') return false;
  const nodeEnv = String(source.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv === 'production') return false;
  return ENABLED_ENVS.has(nodeEnv);
}

function discardBestepFileQualityShadowFailure() {
  return null;
}

function governance() {
  return {
    officialUseAllowed: false,
    causalClaimAllowed: false,
    sourcePriorityApplied: false,
    mergePerformed: false,
  };
}

function failureDiagnostic() {
  return {
    pilotId: PILOT_ID,
    importType: 'bestep_score_import',
    evaluationScope: 'batch',
    contractVersion: 'phase-4j',
    verificationStatus: 'unknown',
    status: 'shadow_error',
    evaluatedRowCount: 0,
    totalRowCount: null,
    truncated: false,
    selectionMethod: 'first_n',
    maxRows: MAX_SHADOW_ROWS,
    wholeFileInference: false,
    populations: {},
    counts: {
      rawRowCount: null,
      evaluatedRowCount: 0,
      acceptedRowCount: null,
      skippedRowCount: null,
      writtenRowCount: null,
      currentStateRowCount: null,
    },
    findings: [{
      code: 'SHADOW_INTERNAL_ERROR',
      severity: 'error',
      dimension: 'runtime',
      count: 1,
      verificationStatus: 'unknown',
    }],
    governance: governance(),
  };
}

function emitSummary(diagnostic, env) {
  const source = env || {};
  if (!isBestepFileQualityShadowEnabled(source)) return;
  if (String(source.BESTEP_FILE_QUALITY_SHADOW_LOG || '').trim() !== 'true') return;
  const codes = (diagnostic.findings || [])
    .map((row) => row && row.code)
    .filter((code) => typeof code === 'string');
  console.info(
    `[bestep-file-quality-shadow] status=${diagnostic.status} evaluated=${diagnostic.evaluatedRowCount} truncated=${diagnostic.truncated} findings=${codes.join(',')}`,
  );
}

function readSkills(row, deps, normalize) {
  const output = {};
  SCORE_FIELDS.forEach(([key]) => {
    const value = deps.getFieldValue(row, 'scores', key);
    if (!normalize) {
      output[key] = value;
      return;
    }
    const parsed = deps.parseNullableScore(value);
    output[key] = Number.isNaN(parsed) ? null : parsed;
  });
  LEVEL_FIELDS.forEach(([key]) => {
    const value = deps.getFieldValue(row, 'scores', key);
    output[key] = normalize ? deps.normalizeCefrLevel(value) : value;
  });
  return output;
}

function integerOrNull(value) {
  return Number.isInteger(value) ? value : null;
}

function buildWindow(payload, deps) {
  const rows = Array.isArray(payload.rows) ? payload.rows : null;
  const totalRowCount = rows ? rows.length : null;
  const evaluatedRowCount = totalRowCount == null ? 0 : Math.min(MAX_SHADOW_ROWS, totalRowCount);
  const truncated = totalRowCount != null && totalRowCount > MAX_SHADOW_ROWS;
  const skipByRow = new Map();
  if (evaluatedRowCount > 0 && Array.isArray(payload.errors)) {
    payload.errors.forEach((error) => {
      const rowNum = Number(error && error.row);
      if (!Number.isInteger(rowNum) || rowNum < 2 || rowNum >= evaluatedRowCount + 2) return;
      if (!skipByRow.has(rowNum) && typeof error.error === 'string') skipByRow.set(rowNum, error.error);
    });
  }

  const rawFileRows = [];
  const acceptedScoreRows = [];
  const skippedImportRows = [];
  for (let index = 0; index < evaluatedRowCount; index += 1) {
    const rowKey = `eval:${index}`;
    const source = rows[index];
    rawFileRows.push({
      rowKey,
      semester: payload.semester || null,
      examDate: null,
      ...readSkills(source, deps, false),
    });
    const skipCode = skipByRow.get(index + 2);
    if (skipCode) {
      skippedImportRows.push({ rowKey, code: skipCode });
      continue;
    }
    acceptedScoreRows.push({
      rowKey,
      semester: payload.semester || null,
      examDate: null,
      importBatchId: payload.importBatchId || null,
      ...readSkills(source, deps, true),
    });
  }

  const validatorInput = {
    pilotId: PILOT_ID,
    fileSemester: payload.semester || null,
    source: {
      importType: 'bestep_score_import',
      sourceFileId: payload.sourceFile || null,
      importRunId: payload.importBatchId || null,
    },
  };
  if (totalRowCount != null) {
    validatorInput.rawFileRows = rawFileRows;
    validatorInput.acceptedScoreRows = acceptedScoreRows;
    validatorInput.skippedImportRows = skippedImportRows;
  }

  return {
    totalRowCount,
    evaluatedRowCount,
    truncated,
    writtenRowCount: integerOrNull(payload.imported),
    skippedRowCount: integerOrNull(payload.skipped),
    acceptedEvaluatedCount: acceptedScoreRows.length,
    skippedEvaluatedCount: skippedImportRows.length,
    validatorInput,
  };
}

function unavailable(reason) {
  return {
    availability: 'not_observed',
    evaluatedRowCount: null,
    totalRowCount: null,
    truncated: false,
    selectionMethod: null,
    reason,
  };
}

function sanitizeFindings(report) {
  return (report.findings || []).map((row) => ({
    code: row.code,
    severity: row.severity,
    dimension: row.dimension,
    count: row.count,
    verificationStatus: row.verificationStatus,
    rowRefs: Array.isArray(row.rowRefs)
      ? row.rowRefs.filter((ref) => typeof ref === 'string').slice(0, 20)
      : [],
  }));
}

function toDiagnostic(built, report) {
  const observed = built.totalRowCount != null;
  return {
    pilotId: PILOT_ID,
    importType: 'bestep_score_import',
    evaluationScope: 'batch',
    contractVersion: 'phase-4j',
    verificationStatus: report.verificationStatus || 'contract_only',
    status: report.status,
    evaluatedRowCount: built.evaluatedRowCount,
    totalRowCount: built.totalRowCount,
    truncated: built.truncated,
    selectionMethod: 'first_n',
    maxRows: MAX_SHADOW_ROWS,
    wholeFileInference: false,
    populations: {
      rawFileRows: observed ? {
        availability: 'available_in_memory',
        evaluatedRowCount: built.evaluatedRowCount,
        totalRowCount: built.totalRowCount,
        truncated: built.truncated,
        selectionMethod: 'first_n',
      } : unavailable('rows_not_in_memory'),
      acceptedScoreRows: observed ? {
        availability: 'partially_available',
        evaluatedRowCount: built.acceptedEvaluatedCount,
        totalRowCount: built.writtenRowCount,
        truncated: built.truncated,
        selectionMethod: 'accepted_within_raw_prefix',
      } : unavailable('rows_not_in_memory'),
      skippedImportRows: observed ? {
        availability: 'partially_available',
        evaluatedRowCount: built.skippedEvaluatedCount,
        totalRowCount: built.skippedRowCount,
        truncated: built.truncated,
        selectionMethod: 'skipped_within_raw_prefix',
      } : unavailable('rows_not_in_memory'),
      currentScoreRecords: unavailable('requires_db_query'),
      attendanceRows: unavailable('not_in_score_import'),
      projectionRecords: unavailable('sync_not_yet_materialized'),
      registrationPopulation: unavailable('requires_db_query'),
      importHistory: unavailable('not_retained'),
    },
    counts: {
      rawRowCount: built.totalRowCount,
      evaluatedRowCount: built.evaluatedRowCount,
      acceptedRowCount: observed ? built.acceptedEvaluatedCount : null,
      skippedRowCount: built.skippedRowCount,
      writtenRowCount: built.writtenRowCount,
      currentStateRowCount: null,
    },
    findings: sanitizeFindings(report),
    governance: report.governance || governance(),
  };
}

function observeBestepScoreImport(payload, deps, env = process.env) {
  if (!isBestepFileQualityShadowEnabled(env)) return null;
  try {
    const built = buildWindow(payload || {}, deps || {});
    const report = evaluateBestepFileQuality(built.validatorInput);
    const diagnostic = toDiagnostic(built, report);
    emitSummary(diagnostic, env);
    return diagnostic;
  } catch (_err) {
    const diagnostic = failureDiagnostic();
    try {
      emitSummary(diagnostic, env);
    } catch (_logErr) {
      discardBestepFileQualityShadowFailure();
    }
    return diagnostic;
  }
}

module.exports = {
  MAX_SHADOW_ROWS,
  isBestepFileQualityShadowEnabled,
  observeBestepScoreImport,
  discardBestepFileQualityShadowFailure,
};
