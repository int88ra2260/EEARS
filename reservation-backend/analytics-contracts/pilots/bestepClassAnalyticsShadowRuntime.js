'use strict';

const { BESTEP_CLASS_ANALYTICS_PILOT_ID } = require('./bestepClassAnalyticsContract');
const { evaluateBestepClassAnalytics } = require('./bestepClassAnalyticsValidator');

const ENABLED_ENVS = new Set(['test', 'development', 'staging']);
const CONTRACT_VERSION = 'phase-4l';
const FINDING_CODE = 'F-BESTEP-01';

function isBestepClassAnalyticsShadowEnabled(env = process.env) {
  try {
    const source = env && typeof env === 'object' ? env : {};
    const flag = source.BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED;
    if (typeof flag !== 'string' || flag.trim() !== 'true') return false;
    const nodeEnv = String(source.NODE_ENV || '').trim().toLowerCase();
    if (nodeEnv === 'production') return false;
    return ENABLED_ENVS.has(nodeEnv);
  } catch (_err) {
    return false;
  }
}

function discardBestepClassAnalyticsShadowFailure() {
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
    pilotId: BESTEP_CLASS_ANALYTICS_PILOT_ID,
    contractVersion: CONTRACT_VERSION,
    status: 'shadow_error',
    executionStage,
    classifiedFields: 0,
    unknownFieldCount: 0,
    unmappedFieldCount: 0,
    proposedFieldCount: 0,
    warningCodes: [],
    semanticFindings: [{ code, evidence: 'not_verified' }],
    recalculated: false,
    examSittings: null,
    governance: governance(),
  };
}

function mapQueryContext(payload) {
  const query = payload && payload.queryContext && typeof payload.queryContext === 'object'
    ? payload.queryContext
    : {};
  return {
    semester: typeof query.semester === 'string' ? query.semester : null,
    examType: typeof query.examType === 'string' ? query.examType : null,
    page: Number.isInteger(query.page) ? query.page : null,
    pageSize: Number.isInteger(query.pageSize) ? query.pageSize : null,
    searchPresent: query.searchPresent === true,
  };
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string');
}

function warningCodes(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (item && typeof item.code === 'string' ? [item.code] : []));
}

function classifyPassRatePopulation(statistics) {
  if (!statistics || typeof statistics !== 'object') {
    return [{ code: FINDING_CODE, evidence: 'not_verified' }];
  }
  const { passedCount, registeredCount } = statistics;
  if (typeof passedCount !== 'number' || typeof registeredCount !== 'number') {
    return [{ code: FINDING_CODE, evidence: 'not_verified' }];
  }
  const findings = [{
    code: FINDING_CODE,
    evidence: 'definition_mismatch',
    population: 'passedCount_all_memberships_vs_registeredCount_domestic_success',
  }];
  const denominatorZeroWithPositiveNumerator = registeredCount === 0 && passedCount > 0;
  const numeratorExceedsDenominator = registeredCount > 0 && passedCount > registeredCount;
  if (numeratorExceedsDenominator || denominatorZeroWithPositiveNumerator) {
    findings.push({
      code: FINDING_CODE,
      evidence: 'observed_numerical_anomaly',
      numeratorExceedsDenominator,
      denominatorZeroWithPositiveNumerator,
    });
  }
  return findings;
}

function sanitizeDiagnostic(report, result) {
  const source = report && typeof report === 'object' ? report : {};
  const statistics = result && result.statistics && typeof result.statistics === 'object'
    ? result.statistics
    : null;
  return {
    pilotId: source.pilotId === BESTEP_CLASS_ANALYTICS_PILOT_ID
      ? BESTEP_CLASS_ANALYTICS_PILOT_ID
      : BESTEP_CLASS_ANALYTICS_PILOT_ID,
    contractVersion: CONTRACT_VERSION,
    status: typeof source.status === 'string' ? source.status : 'undetermined',
    executionStage: 'complete',
    classifiedFields: typeof source.classifiedFields === 'number' ? source.classifiedFields : 0,
    unknownFieldCount: stringList(source.unknownFields).length,
    unmappedFieldCount: stringList(source.unmappedFields).length,
    proposedFieldCount: stringList(source.proposedFields).length,
    warningCodes: warningCodes(source.warnings),
    semanticFindings: classifyPassRatePopulation(statistics),
    recalculated: false,
    examSittings: null,
    governance: governance(),
  };
}

function emitDiagnostic(diagnostic, env, deps) {
  const source = env && typeof env === 'object' ? env : {};
  if (typeof source.BESTEP_CLASS_ANALYTICS_SHADOW_LOG !== 'string'
    || source.BESTEP_CLASS_ANALYTICS_SHADOW_LOG.trim() !== 'true') {
    return;
  }
  const logger = deps && typeof deps.logger === 'function' ? deps.logger : null;
  if (!logger) return;
  logger(JSON.stringify({
    pilotId: diagnostic.pilotId,
    contractVersion: diagnostic.contractVersion,
    status: diagnostic.status,
    classifiedFields: diagnostic.classifiedFields,
    findingCodes: (diagnostic.semanticFindings || []).map((item) => item.code),
    mappingStatus: diagnostic.status,
  }));
}

function runStage(stage, fn) {
  try {
    return fn();
  } catch (err) {
    if (err && typeof err === 'object' && !err.stage) err.stage = stage;
    throw err;
  }
}

function observeBestepClassAnalytics(payload, deps, env = process.env) {
  const safeDeps = deps && typeof deps === 'object' ? deps : {};
  let enabled = false;
  try {
    enabled = isBestepClassAnalyticsShadowEnabled(env);
  } catch (_err) {
    return null;
  }
  if (!enabled) return null;

  try {
    const queryContext = runStage('query_context', () => (
      typeof safeDeps.mapQueryContext === 'function'
        ? safeDeps.mapQueryContext(payload)
        : mapQueryContext(payload)
    ));
    const report = runStage('validator', () => {
      const evaluate = typeof safeDeps.evaluate === 'function'
        ? safeDeps.evaluate
        : evaluateBestepClassAnalytics;
      const value = evaluate({
        response: payload && payload.result,
        queryContext,
      });
      if (value && typeof value.then === 'function') {
        value.then(() => {}, () => {});
        const error = new Error('async');
        error.code = 'SHADOW_ASYNC_NOT_SUPPORTED';
        error.stage = 'validator';
        throw error;
      }
      return value;
    });
    const diagnostic = runStage('sanitizer', () => (
      typeof safeDeps.sanitize === 'function'
        ? safeDeps.sanitize(report, payload)
        : sanitizeDiagnostic(report, payload && payload.result)
    ));
    try {
      emitDiagnostic(diagnostic, env, safeDeps);
    } catch (_logErr) {
      return diagnostic;
    }
    return diagnostic;
  } catch (err) {
    const stage = err && err.stage ? err.stage : 'snapshot';
    const code = err && err.code === 'SHADOW_ASYNC_NOT_SUPPORTED'
      ? 'SHADOW_ASYNC_NOT_SUPPORTED'
      : 'SHADOW_INTERNAL_ERROR';
    const diagnostic = failureDiagnostic(stage, code);
    try {
      emitDiagnostic(diagnostic, env, safeDeps);
    } catch (_logErr) {
      return diagnostic;
    }
    return diagnostic;
  }
}

module.exports = {
  isBestepClassAnalyticsShadowEnabled,
  observeBestepClassAnalytics,
  discardBestepClassAnalyticsShadowFailure,
  classifyPassRatePopulation,
};
