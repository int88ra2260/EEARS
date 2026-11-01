'use strict';

const { getDomain } = require('./domainRegistry');
const { getDecisionGate, DECISION_GATES } = require('./decisionGateRegistry');
const { listTemporalContracts, getTemporalContract } = require('./temporalRegistry');
const { listMetricDefinitions, getMetricDefinition } = require('./metricRegistry');
const { listLegacyMappings } = require('./legacyMappings');
const { ContractRegistryError } = require('./errors');

const IMPLEMENTATION_STATUS = new Set(['implemented', 'partial', 'not_implemented', 'unknown']);
const GOVERNANCE_STATUS = new Set(['proposed', 'pending_decision', 'approved', 'deprecated_candidate']);
const MAPPING_STATUS = new Set(['verified', 'partial', 'ambiguous', 'unmapped']);
const VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

const ATTENDANCE_RATE_IDS = [
  'ops.reservation.checkin_row_rate',
  'ops.roster.distinct_checkin_rate',
  'bestep.file.attendance_lr_sw_avg',
];

const DISTINCT_ATTAINMENT_IDS = [
  'bestep.file.four_skill_cefr_b2',
  'ops.roster.bestep_pass_over_attendance',
  'roster.pair_pass.listening_reading',
  'roster.pair_pass.speaking_writing',
  'roster.best_skill_rank_b2',
  'snapshot.exam_cell_rank_b2',
];

function push(errors, code, message) {
  errors.push({ code, message });
}

function validateRegistry() {
  const errors = [];
  const metrics = listMetricDefinitions();
  const contracts = listTemporalContracts();
  const mappings = listLegacyMappings();

  const metricIds = new Set();
  metrics.forEach((metric) => {
    if (metricIds.has(metric.metricId)) {
      push(errors, 'DUPLICATE_METRIC', metric.metricId);
    }
    metricIds.add(metric.metricId);

    ['metricId', 'version', 'displayName', 'domainId', 'businessQuestion', 'analysisUnit', 'populationDefinition', 'implementationStatus', 'governanceStatus', 'evidenceClassification'].forEach((field) => {
      if (metric[field] == null || metric[field] === '') {
        push(errors, 'METRIC_FIELD_MISSING', `${metric.metricId || '?'} 缺少 ${field}`);
      }
    });
    if (!VERSION_PATTERN.test(String(metric.version || ''))) {
      push(errors, 'METRIC_VERSION', metric.metricId);
    }
    if (!IMPLEMENTATION_STATUS.has(metric.implementationStatus)) {
      push(errors, 'IMPLEMENTATION_STATUS', metric.metricId);
    }
    if (!GOVERNANCE_STATUS.has(metric.governanceStatus)) {
      push(errors, 'GOVERNANCE_STATUS', metric.metricId);
    }
    if (!getDomain(metric.domainId)) {
      push(errors, 'DOMAIN_MISSING', `${metric.metricId} -> ${metric.domainId}`);
    }
    metric.temporalContractIds.forEach((id) => {
      try {
        getTemporalContract(id);
      } catch (err) {
        push(errors, 'TEMPORAL_MISSING', `${metric.metricId} -> ${id}`);
      }
    });
    metric.decisionGateIds.forEach((id) => {
      if (!getDecisionGate(id)) push(errors, 'DECISION_MISSING', `${metric.metricId} -> ${id}`);
    });
    if (metric.governanceStatus === 'approved') {
      push(errors, 'APPROVED_FORBIDDEN', metric.metricId);
    }
    if (metric.officialUseAllowed !== false) {
      push(errors, 'OFFICIAL_FLAG', metric.metricId);
    }
    if (metric.causalClaimAllowed !== false) {
      push(errors, 'CAUSAL_FLAG', metric.metricId);
    }
    if (metric.implementationStatus === 'not_implemented' && metric.legacyActive) {
      push(errors, 'UNBUILT_MARKED_ACTIVE', metric.metricId);
    }
    if (metric.implementationStatus === 'not_implemented' && !metric.claimRestrictions.includes('not_implemented')) {
      push(errors, 'UNBUILT_RESTRICTION', metric.metricId);
    }
    if (metric.decisionGateIds.length > 0 && metric.governanceStatus !== 'pending_decision') {
      push(errors, 'PENDING_GATE_STATUS', metric.metricId);
    }
    if (metric.evidenceClassification === 'causal' || metric.claimRestrictions.includes('causal')) {
      push(errors, 'CAUSAL_CLASS', metric.metricId);
    }
    if (['associational', 'adjusted', 'longitudinal'].includes(metric.evidenceClassification)
      && !metric.claimRestrictions.includes('not_causal')) {
      push(errors, 'NONCAUSAL_RESTRICTION', metric.metricId);
    }
    if (metric.supportsAsOfQuery === true) {
      push(errors, 'ASOF_NOT_SUPPORTED_IN_PHASE4A', metric.metricId);
    }
  });

  const contractIds = new Set();
  contracts.forEach((contract) => {
    if (contractIds.has(contract.temporalContractId)) {
      push(errors, 'DUPLICATE_CONTRACT', contract.temporalContractId);
    }
    contractIds.add(contract.temporalContractId);
    ['temporalContractId', 'version', 'displayName', 'analysisUnit', 'asOfPolicy', 'observationWindowPolicy', 'historicalRecalculationPolicy', 'comparisonEligibility'].forEach((field) => {
      if (!contract[field]) push(errors, 'CONTRACT_FIELD_MISSING', `${contract.temporalContractId} ${field}`);
    });
    if (!VERSION_PATTERN.test(String(contract.version || ''))) {
      push(errors, 'CONTRACT_VERSION', contract.temporalContractId);
    }
    if (contract.asOfQuerySupported === true) {
      push(errors, 'CONTRACT_ASOF_UNSUPPORTED', contract.temporalContractId);
    }
  });

  const best = contracts.find((row) => row.temporalContractId === 'TC-ROSTER-BEST-ASOF-NOW');
  if (!best || !best.limitations.includes('asof_query_unsupported') || !best.limitations.includes('not_single_sitting')) {
    push(errors, 'BEST_CONTRACT', '歷史最佳契約必須標明不支援截止日查詢，且不是單次測驗');
  }
  const snap = contracts.find((row) => row.temporalContractId === 'TC-SNAPSHOT-VERSION');
  if (!snap || !snap.limitations.includes('generated_at_is_not_data_as_of')) {
    push(errors, 'SNAPSHOT_CONTRACT', '快照契約不得把產生時間當成資料截止');
  }

  DECISION_GATES.forEach((gate) => {
    if (gate.status !== 'pending') push(errors, 'GATE_NOT_PENDING', gate.decisionId);
  });

  ATTENDANCE_RATE_IDS.forEach((id) => {
    if (!metricIds.has(id)) push(errors, 'ATTENDANCE_ID', id);
  });
  if (ATTENDANCE_RATE_IDS.every((id) => metricIds.has(id))) {
    const attendanceGroups = new Set(ATTENDANCE_RATE_IDS.map((id) => getMetricDefinition(id).conflictGroup));
    if (attendanceGroups.size !== 1 || !attendanceGroups.has('attendance_rate')) {
      push(errors, 'ATTENDANCE_GROUP', '三種出席率必須分開且同屬 attendance_rate 衝突組');
    }
  }

  DISTINCT_ATTAINMENT_IDS.forEach((id) => {
    if (!metricIds.has(id)) push(errors, 'ATTAINMENT_ID', id);
  });
  if (new Set(DISTINCT_ATTAINMENT_IDS).size !== DISTINCT_ATTAINMENT_IDS.length) {
    push(errors, 'ATTAINMENT_COLLAPSE', '達標口徑 ID 被合併');
  }

  const bestMetric = getMetricDefinition('roster.best_skill_rank_b2');
  if (bestMetric.domainId !== 'DOM-STATE' || bestMetric.evidenceClassification !== 'descriptive_state') {
    push(errors, 'BEST_DOMAIN', '歷史最佳不得放在單次達標');
  }
  if (!bestMetric.claimRestrictions.includes('not_single_sitting')) {
    push(errors, 'BEST_CLAIM', '歷史最佳必須聲明不是單次測驗');
  }

  mappings.forEach((mapping) => {
    if (!MAPPING_STATUS.has(mapping.mappingStatus)) {
      push(errors, 'MAPPING_STATUS', mapping.legacyId);
    }
    mapping.metricIds.forEach((id) => {
      if (!metricIds.has(id)) push(errors, 'MAPPING_METRIC', `${mapping.legacyId} -> ${id}`);
    });
    mapping.temporalContractIds.forEach((id) => {
      if (!contractIds.has(id)) push(errors, 'MAPPING_CONTRACT', `${mapping.legacyId} -> ${id}`);
    });
  });

  metrics.forEach((metric) => {
    metric.legacyReferences.forEach((legacyId) => {
      const found = mappings.find((row) => row.legacyId === legacyId);
      if (!found) push(errors, 'LEGACY_REF', `${metric.metricId} -> ${legacyId}`);
      else if (!found.metricIds.includes(metric.metricId)) {
        push(errors, 'LEGACY_REF_REVERSE', `${metric.metricId} 不在 ${legacyId}`);
      }
    });
  });

  return { ok: errors.length === 0, errors };
}

function assertRegistryValid() {
  const result = validateRegistry();
  if (!result.ok) {
    const summary = result.errors.map((item) => `${item.code}:${item.message}`).join('; ');
    throw new ContractRegistryError('REGISTRY_INVALID', summary);
  }
  return result;
}

/**
 * 同一 ID、同一政策鍵、同一時間契約才 compatible。
 * 缺 policyKey 而該指標要求 disambiguators 時為 undetermined。
 * 不同 ID 且同衝突組為 incompatible。其餘不同 ID 為 undetermined，不猜成可比。
 */
function checkComparison(left, right) {
  const a = getMetricDefinition(left.metricId);
  const b = getMetricDefinition(right.metricId);
  if (a.conflictGroup && a.conflictGroup === b.conflictGroup && a.metricId !== b.metricId) {
    return { status: 'incompatible', reason: 'conflict_group' };
  }
  if (a.metricId !== b.metricId) {
    return { status: 'undetermined', reason: 'different_metric' };
  }
  if (a.disambiguators.includes('policyKey') && (!left.policyKey || !right.policyKey)) {
    return { status: 'undetermined', reason: 'policy_key_required' };
  }
  if (left.policyKey && right.policyKey && left.policyKey !== right.policyKey) {
    return { status: 'incompatible', reason: 'policy_key' };
  }
  const leftContract = left.temporalContractId || a.temporalContractIds[0];
  const rightContract = right.temporalContractId || b.temporalContractIds[0];
  if (leftContract !== rightContract) {
    return { status: 'incompatible', reason: 'temporal_contract' };
  }
  return { status: 'compatible', reason: 'same_contract' };
}

function requestAsOf(metricId) {
  const metric = getMetricDefinition(metricId);
  if (metric.supportsAsOfQuery !== true) {
    return {
      status: 'unsupported',
      reason: 'asof_query_unsupported',
      metricId,
    };
  }
  return { status: 'undetermined', reason: 'no_engine', metricId };
}

function claimOfficial(metricId) {
  const metric = getMetricDefinition(metricId);
  if (metric.implementationStatus === 'not_implemented') {
    return { allowed: false, reason: 'not_implemented', metricId };
  }
  if (metric.governanceStatus !== 'approved' || metric.officialUseAllowed !== true) {
    return { allowed: false, reason: 'not_approved', metricId };
  }
  return { allowed: false, reason: 'not_approved', metricId };
}

module.exports = {
  validateRegistry,
  assertRegistryValid,
  checkComparison,
  requestAsOf,
  claimOfficial,
  ATTENDANCE_RATE_IDS,
  DISTINCT_ATTAINMENT_IDS,
};
