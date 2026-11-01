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
  try {
    const source = env && typeof env === 'object' ? env : {};
    const flag = source.BESTEP_FILE_QUALITY_SHADOW_ENABLED;
    if (typeof flag !== 'string' || flag.trim() !== 'true') return false;
    const nodeEnv = String(source.NODE_ENV || '').trim().toLowerCase();
    if (nodeEnv === 'production') return false;
    return ENABLED_ENVS.has(nodeEnv);
  } catch (_err) {
    return false;
  }
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

function failureDiagnostic(executionStage, code) {
  return {
    pilotId: PILOT_ID,
    importType: 'bestep_score_import',
    evaluationScope: 'batch',
    contractVersion: 'phase-4j',
    verificationStatus: 'unknown',
    status: 'shadow_error',
    executionStage,
    evaluatedRowCount: 0,
    totalRowCount: null,
    truncated: false,
    selectionMethod: 'first_n',
    maxRows: MAX_SHADOW_ROWS,
    wholeFileInference: false,
    stage: {
      sourceStage: 'not_provided',
      normalizationStatus: 'not_applicable',
      originalFileFidelity: 'not_applicable',
      selectionScope: null,
    },
    populations: {},
    counts: {
      rawRowCount: null,
      evaluatedRowCount: 0,
      acceptedRowCount: null,
      skippedRowCount: null,
      writtenRowCount: null,
      validatedRowCount: null,
      upsertSucceededRowCount: null,
      committedRowCount: null,
      currentStateRowCount: null,
    },
    findings: [{
      code,
      severity: 'error',
      dimension: 'runtime',
      count: 1,
      verificationStatus: 'unknown',
      rowRefs: [],
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
    `[bestep-file-quality-shadow] pilot=${PILOT_ID} status=${diagnostic.status} stage=${diagnostic.executionStage || 'complete'} evaluated=${diagnostic.evaluatedRowCount} truncated=${diagnostic.truncated} findings=${codes.join(',')}`,
  );
}

function safeLog(diagnostic, env, deps) {
  try {
    const log = deps && typeof deps.log === 'function'
      ? deps.log
      : (item) => emitSummary(item, env);
    const result = log(diagnostic);
    if (result && typeof result.then === 'function') {
      result.then(() => {}, () => {});
    }
  } catch (_err) {
    discardBestepFileQualityShadowFailure();
  }
}

function runStage(stage, fn) {
  try {
    const value = fn();
    if (value && typeof value.then === 'function') {
      value.then(() => {}, () => {});
      const asyncErr = new Error('SHADOW_ASYNC_NOT_SUPPORTED');
      asyncErr.code = 'SHADOW_ASYNC_NOT_SUPPORTED';
      asyncErr.stage = stage;
      throw asyncErr;
    }
    return value;
  } catch (err) {
    if (err && err.code === 'SHADOW_ASYNC_NOT_SUPPORTED') throw err;
    const wrapped = new Error('SHADOW_INTERNAL_ERROR');
    wrapped.code = 'SHADOW_INTERNAL_ERROR';
    wrapped.stage = stage;
    throw wrapped;
  }
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

function capturePrefix(payload) {
  const source = payload || {};
  const rows = Array.isArray(source.rows) ? source.rows : null;
  const totalRowCount = rows ? rows.length : null;
  const evaluatedRowCount = totalRowCount == null ? 0 : Math.min(MAX_SHADOW_ROWS, totalRowCount);
  const prefix = [];
  for (let index = 0; index < evaluatedRowCount; index += 1) {
    prefix.push(rows[index]);
  }
  const skipByRow = new Map();
  if (evaluatedRowCount > 0 && Array.isArray(source.errors)) {
    source.errors.forEach((error) => {
      const rowNum = Number(error && error.row);
      if (!Number.isInteger(rowNum) || rowNum < 2 || rowNum >= evaluatedRowCount + 2) return;
      if (!skipByRow.has(rowNum) && typeof error.error === 'string') skipByRow.set(rowNum, error.error);
    });
  }
  return {
    semester: source.semester || null,
    importBatchId: source.importBatchId || null,
    sourceFile: source.sourceFile || null,
    imported: source.imported,
    skipped: source.skipped,
    commitSucceeded: source.commitSucceeded === true,
    totalRowCount,
    evaluatedRowCount,
    truncated: totalRowCount != null && totalRowCount > MAX_SHADOW_ROWS,
    prefix,
    skipByRow,
  };
}

function mapPrefix(captured, deps) {
  const rawFileRows = [];
  const acceptedScoreRows = [];
  const skippedImportRows = [];
  captured.prefix.forEach((source, index) => {
    const rowKey = `eval:${index}`;
    rawFileRows.push({
      rowKey,
      semester: captured.semester,
      examDate: null,
      ...readSkills(source, deps, false),
    });
    const skipCode = captured.skipByRow.get(index + 2);
    if (skipCode) {
      skippedImportRows.push({ rowKey, code: skipCode });
      return;
    }
    acceptedScoreRows.push({
      rowKey,
      semester: captured.semester,
      examDate: null,
      importBatchId: captured.importBatchId,
      ...readSkills(source, deps, true),
    });
  });

  const validatorInput = {
    pilotId: PILOT_ID,
    fileSemester: captured.semester,
    source: {
      importType: 'bestep_score_import',
      sourceFileId: captured.sourceFile,
      importRunId: captured.importBatchId,
    },
  };
  if (captured.totalRowCount != null) {
    validatorInput.rawFileRows = rawFileRows;
    validatorInput.acceptedScoreRows = acceptedScoreRows;
    validatorInput.skippedImportRows = skippedImportRows;
  }
  return {
    totalRowCount: captured.totalRowCount,
    evaluatedRowCount: captured.evaluatedRowCount,
    truncated: captured.truncated,
    commitSucceeded: captured.commitSucceeded,
    writtenRowCount: integerOrNull(captured.imported),
    skippedRowCount: integerOrNull(captured.skipped),
    acceptedEvaluatedCount: acceptedScoreRows.length,
    skippedEvaluatedCount: skippedImportRows.length,
    validatorInput,
  };
}

function unavailable(reason) {
  return {
    availability: 'not_observed',
    sourceStage: 'not_provided',
    normalizationStatus: 'not_applicable',
    originalFileFidelity: 'not_applicable',
    selectionScope: null,
    identityLinkage: 'none',
    committed: null,
    evaluatedRowCount: null,
    totalRowCount: null,
    truncated: false,
    selectionMethod: null,
    reason,
  };
}

function presentFinding(row) {
  const finding = {
    code: row.code,
    severity: row.severity,
    dimension: row.dimension,
    count: row.count,
    verificationStatus: row.verificationStatus,
    rowRefs: Array.isArray(row.rowRefs)
      ? row.rowRefs.filter((ref) => typeof ref === 'string').slice(0, 20)
      : [],
  };
  if (row.code !== 'SOURCE_INFORMATION_LOSS') return finding;
  return {
    ...finding,
    verificationStatus: 'undetermined',
    evidenceLevel: 'parsed_versus_normalized',
    originalFileFidelity: 'not_verified',
  };
}

function sanitizeFindings(report) {
  return (report.findings || []).map(presentFinding);
}

function toDiagnostic(built, report) {
  const observed = built.totalRowCount != null;
  const acceptedStage = built.commitSucceeded
    ? 'committed_normalized_prefix'
    : 'normalized_prefix_without_skip_code';
  return {
    pilotId: PILOT_ID,
    importType: 'bestep_score_import',
    evaluationScope: 'batch',
    contractVersion: 'phase-4j',
    verificationStatus: report.verificationStatus || 'contract_only',
    status: report.status,
    executionStage: 'complete',
    evaluatedRowCount: built.evaluatedRowCount,
    totalRowCount: built.totalRowCount,
    truncated: built.truncated,
    selectionMethod: 'first_n',
    maxRows: MAX_SHADOW_ROWS,
    wholeFileInference: false,
    stage: observed ? {
      sourceStage: 'parsed_worksheet_rows',
      normalizationStatus: 'header_mapped_field_extract',
      originalFileFidelity: 'not_verified',
      selectionScope: 'first_n',
    } : {
      sourceStage: 'not_provided',
      normalizationStatus: 'not_applicable',
      originalFileFidelity: 'not_applicable',
      selectionScope: null,
    },
    populations: {
      rawFileRows: observed ? {
        availability: 'available_in_memory',
        sourceStage: 'parsed_worksheet_rows',
        normalizationStatus: 'header_mapped_field_extract',
        originalFileFidelity: 'not_verified',
        selectionScope: 'first_n',
        identityLinkage: 'eval_index',
        committed: false,
        evaluatedRowCount: built.evaluatedRowCount,
        totalRowCount: built.totalRowCount,
        truncated: built.truncated,
        selectionMethod: 'first_n',
      } : unavailable('rows_not_in_memory'),
      acceptedScoreRows: observed ? {
        availability: 'partially_available',
        sourceStage: acceptedStage,
        normalizationStatus: 'score_parsed_and_cefr_collapsed',
        originalFileFidelity: 'not_verified',
        selectionScope: 'accepted_within_raw_prefix',
        identityLinkage: 'eval_index',
        committed: built.commitSucceeded ? true : null,
        evaluatedRowCount: built.acceptedEvaluatedCount,
        totalRowCount: built.writtenRowCount,
        truncated: built.truncated,
        selectionMethod: 'accepted_within_raw_prefix',
      } : unavailable('rows_not_in_memory'),
      skippedImportRows: observed ? {
        availability: 'partially_available',
        sourceStage: 'skip_code_only',
        normalizationStatus: 'code_extracted_message_omitted',
        originalFileFidelity: 'not_applicable',
        selectionScope: 'skipped_within_raw_prefix',
        identityLinkage: 'eval_index',
        committed: false,
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
      validatedRowCount: null,
      upsertSucceededRowCount: built.writtenRowCount,
      committedRowCount: built.commitSucceeded ? built.writtenRowCount : null,
      currentStateRowCount: null,
    },
    findings: sanitizeFindings(report),
    governance: report.governance || governance(),
  };
}

function observeBestepScoreImport(payload, deps, env = process.env) {
  let enabled = false;
  try {
    enabled = isBestepFileQualityShadowEnabled(env);
  } catch (_err) {
    return null;
  }
  if (!enabled) return null;

  const safeDeps = deps && typeof deps === 'object' ? deps : {};
  try {
    const captured = runStage('snapshot', () => (
      typeof safeDeps.capturePrefix === 'function'
        ? safeDeps.capturePrefix(payload)
        : capturePrefix(payload)
    ));
    const built = runStage('input_mapping', () => mapPrefix(captured, safeDeps));
    const report = runStage('validator', () => {
      const evaluate = typeof safeDeps.evaluate === 'function'
        ? safeDeps.evaluate
        : evaluateBestepFileQuality;
      return evaluate(built.validatorInput);
    });
    const diagnostic = runStage('sanitizer', () => {
      if (typeof safeDeps.sanitize === 'function') return safeDeps.sanitize(report);
      return toDiagnostic(built, report);
    });
    safeLog(diagnostic, env, safeDeps);
    return diagnostic;
  } catch (err) {
    const code = err && err.code === 'SHADOW_ASYNC_NOT_SUPPORTED'
      ? 'SHADOW_ASYNC_NOT_SUPPORTED'
      : 'SHADOW_INTERNAL_ERROR';
    const executionStage = err && typeof err.stage === 'string' ? err.stage : 'snapshot';
    const diagnostic = failureDiagnostic(executionStage, code);
    safeLog(diagnostic, env, safeDeps);
    return diagnostic;
  }
}

module.exports = {
  MAX_SHADOW_ROWS,
  isBestepFileQualityShadowEnabled,
  observeBestepScoreImport,
  discardBestepFileQualityShadowFailure,
};
