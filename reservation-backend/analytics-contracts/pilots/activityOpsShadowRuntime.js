'use strict';

const validator = require('./activityOpsShadowValidator');

const ENABLED_ENVS = new Set(['test', 'development', 'staging']);

function isActivityOpsShadowEnabled(env = process.env) {
  const source = env || {};
  const flag = String(source.ANALYTICS_SEMANTIC_SHADOW_ENABLED || '').trim().toLowerCase();
  if (flag !== 'true') return false;
  const nodeEnv = String(source.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv === 'production') return false;
  return ENABLED_ENVS.has(nodeEnv);
}

function emitShadowSummary(report, env) {
  const source = env || {};
  if (String(source.ANALYTICS_SEMANTIC_SHADOW_LOG || '').trim().toLowerCase() !== 'true') return;
  const codes = []
    .concat(report.errors || [], report.warnings || [])
    .map((row) => row && row.code)
    .filter((code) => typeof code === 'string');
  console.info(`[analytics-shadow] ${report.pilotId || 'unknown'} ${report.status || 'unknown'} ${codes.join(',')}`);
}

function shadowFailureReport() {
  return {
    pilotId: validator.PILOT_ID,
    status: 'error',
    validatedFieldCount: 0,
    unmappedFields: [],
    warnings: [],
    errors: [{
      code: 'SHADOW_INTERNAL_ERROR',
      fieldPath: '$',
      contractId: null,
      verificationStatus: 'unknown',
      detail: 'shadow validator failed and was discarded',
    }],
    metricContractVersion: null,
    temporalContractId: null,
    semesterId: null,
    fields: [],
  };
}

function runActivityOpsShadow(input, env = process.env) {
  if (!isActivityOpsShadowEnabled(env)) return null;
  try {
    const report = validator.validateActivityOpsOverview(input);
    emitShadowSummary(report, env);
    return report;
  } catch (_err) {
    const report = shadowFailureReport();
    emitShadowSummary(report, env);
    return report;
  }
}

function discardShadowFailure() {
  return null;
}

module.exports = {
  isActivityOpsShadowEnabled,
  runActivityOpsShadow,
  discardShadowFailure,
};
