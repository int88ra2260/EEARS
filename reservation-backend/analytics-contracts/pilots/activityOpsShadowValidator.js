'use strict';

const { getMetricDefinition, VERSION } = require('../metricRegistry');
const {
  listActivityOpsFieldCards,
  getActivityOpsFieldCard,
} = require('./activityOpsFieldContract');

const PILOT_ID = 'PILOT-OPS-OVERVIEW-RESERVATION';
const EVENT_TEMPORAL_CONTRACT = 'TC-OPS-DATE-SEMESTER';
const EVENT_TIME_FIELD = 'events.date';
const MAX_ROWS = 200;

const CARDS = listActivityOpsFieldCards();

function issue(code, fieldPath, extra) {
  return {
    code,
    fieldPath,
    contractId: extra.contractId || null,
    verificationStatus: extra.verificationStatus || 'unknown',
    detail: extra.detail,
  };
}

function allowedChildKeys(parentPath) {
  const keys = new Set();
  const prefix = parentPath ? `${parentPath}.` : '';
  CARDS.forEach((row) => {
    if (!parentPath) {
      if (!row.fieldPath.includes('.')) keys.add(row.fieldPath);
      return;
    }
    if (!row.fieldPath.startsWith(prefix)) return;
    const token = row.fieldPath.slice(prefix.length).split('.')[0].replace(/\[\]$/, '');
    if (token) keys.add(token);
  });
  return keys;
}

function inspectActivityOpsFieldBinding(spec) {
  const row = spec || {};
  const found = [];
  const fieldPath = row.fieldPath || '$';
  if (!row.populationDefinition) {
    found.push(issue('POPULATION_DEFINITION_MISSING', fieldPath, {
      contractId: row.metricId || null,
      verificationStatus: 'unknown',
      detail: 'population definition is missing',
    }));
  }
  if (!row.metricId) return found;
  let metric = null;
  try {
    metric = getMetricDefinition(row.metricId);
  } catch (_err) {
    found.push(issue('METRIC_CONTRACT_NOT_FOUND', fieldPath, {
      contractId: row.metricId,
      verificationStatus: 'unknown',
      detail: 'metric id is not in the registry',
    }));
    return found;
  }
  if (row.temporalContractId && !metric.temporalContractIds.includes(row.temporalContractId)) {
    found.push(issue('TEMPORAL_CONTRACT_MISMATCH', fieldPath, {
      contractId: row.temporalContractId,
      verificationStatus: 'partial',
      detail: 'temporal contract is not one this metric declares',
    }));
  }
  if (
    row.timeField
    && row.timeField !== EVENT_TIME_FIELD
    && metric.temporalContractIds.includes(EVENT_TEMPORAL_CONTRACT)
  ) {
    found.push(issue('UNSUPPORTED_TIME_COMPARISON', fieldPath, {
      contractId: EVENT_TEMPORAL_CONTRACT,
      verificationStatus: 'partial',
      detail: 'time field is not events.date',
    }));
  }
  return found;
}

function pushBindingIssues(card, bucket) {
  if (!card.metricId) return;
  inspectActivityOpsFieldBinding({
    fieldPath: card.fieldPath,
    metricId: card.metricId,
    temporalContractId: card.temporalContractId,
    populationDefinition: card.population,
    timeField: card.timeField === 'NOT_APPLICABLE' ? null : card.timeField,
  }).forEach((row) => bucket.push(row));
}

function walk(value, path, errors) {
  const card = getActivityOpsFieldCard(path);
  if (card && card.fieldType === 'array') {
    if (!Array.isArray(value)) {
      errors.push(issue('UNVERIFIED_LEGACY_CALCULATION', path, {
        verificationStatus: 'unknown',
        detail: 'expected an array',
      }));
      return;
    }
    const limit = Math.min(value.length, MAX_ROWS);
    for (let index = 0; index < limit; index += 1) {
      const row = value[index];
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        errors.push(issue('UNVERIFIED_LEGACY_CALCULATION', `${path}[]`, {
          verificationStatus: 'unknown',
          detail: 'expected an object row',
        }));
        continue;
      }
      walk(row, `${path}[]`, errors);
    }
    if (value.length > MAX_ROWS) {
      errors.push(issue('UNVERIFIED_LEGACY_CALCULATION', path, {
        verificationStatus: 'partial',
        detail: 'row inspection capped',
      }));
    }
    return;
  }
  if (card && card.fieldType === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(issue('UNVERIFIED_LEGACY_CALCULATION', path, {
        verificationStatus: 'unknown',
        detail: 'expected an object',
      }));
      return;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const allowed = allowedChildKeys(path);
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) {
      const fieldPath = path ? `${path}.${key}` : key;
      errors.push(issue('UNKNOWN_RESPONSE_FIELD', fieldPath, {
        verificationStatus: 'unknown',
        detail: 'response field is not in the field contract',
      }));
      return;
    }
    const childPath = path ? `${path}.${key}` : key;
    walk(value[key], childPath, errors);
  });
}

function safeSemesterId(value) {
  return typeof value === 'string' && /^[0-9]{3}-[12]$/.test(value.trim())
    ? value.trim()
    : null;
}

function fieldSnapshot(card) {
  return {
    fieldPath: card.fieldPath,
    semanticType: card.semanticType,
    metricId: card.metricId,
    temporalContractId: card.temporalContractId,
    verificationStatus: card.verificationStatus,
    metricStatus: card.metricStatus,
  };
}

function validateActivityOpsOverview(input) {
  const source = input && typeof input === 'object' ? input : {};
  const legacyResult = source.legacyResult;
  const errors = [];
  const warnings = [];
  const unmappedFields = [];

  if (!legacyResult || typeof legacyResult !== 'object' || Array.isArray(legacyResult)) {
    errors.push(issue('UNVERIFIED_LEGACY_CALCULATION', '$', {
      verificationStatus: 'unknown',
      detail: 'legacy result is not an object',
    }));
  } else {
    walk(legacyResult, '', errors);
    CARDS.forEach((card) => {
      if (!Object.prototype.hasOwnProperty.call(legacyResult, card.fieldPath)) return;
      if (card.fieldPath.includes('.')) return;
      pushBindingIssues(card, errors);
      if (card.crossDomain) {
        warnings.push(issue('CROSS_DOMAIN_LEGACY_FIELD', card.fieldPath, {
          contractId: card.metricId,
          verificationStatus: card.verificationStatus,
          detail: 'registration flag rate is not an activity outcome',
        }));
      }
      if (card.unmappedMetric) {
        unmappedFields.push(card.fieldPath);
        warnings.push(issue('FIELD_UNMAPPED', card.fieldPath, {
          verificationStatus: card.verificationStatus,
          detail: 'no approved metric id for this field',
        }));
      }
    });
    if (legacyResult.capacityBreakdown && typeof legacyResult.capacityBreakdown === 'object') {
      CARDS.forEach((card) => {
        if (!card.fieldPath.startsWith('capacityBreakdown.')) return;
        if (!card.metricId) return;
        pushBindingIssues(card, errors);
      });
    }
  }

  warnings.push(issue('UNSUPPORTED_TIME_COMPARISON', 'timeComparison', {
    contractId: EVENT_TEMPORAL_CONTRACT,
    verificationStatus: 'partial',
    detail: 'inclusive CAST end is not proven equal to the half-open window',
  }));
  warnings.push(issue('UNVERIFIED_LEGACY_CALCULATION', '$', {
    verificationStatus: 'partial',
    detail: 'formulas were read from source and were not recounted',
  }));

  const presentTopLevel = !legacyResult || typeof legacyResult !== 'object' || Array.isArray(legacyResult)
    ? []
    : CARDS.filter((card) => !card.fieldPath.includes('.') && Object.prototype.hasOwnProperty.call(legacyResult, card.fieldPath));

  let status = 'ok';
  if (errors.length) status = 'error';
  else if (warnings.length || unmappedFields.length) status = 'partial';

  return {
    pilotId: PILOT_ID,
    status,
    validatedFieldCount: presentTopLevel.length,
    unmappedFields,
    warnings,
    errors,
    metricContractVersion: VERSION,
    temporalContractId: EVENT_TEMPORAL_CONTRACT,
    semesterId: safeSemesterId(source.semesterId),
    fields: presentTopLevel.map(fieldSnapshot),
  };
}

module.exports = {
  PILOT_ID,
  validateActivityOpsOverview,
  inspectActivityOpsFieldBinding,
};
