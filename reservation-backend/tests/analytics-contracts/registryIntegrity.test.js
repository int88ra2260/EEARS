'use strict';

const {
  listMetricDefinitions,
  getMetricDefinition,
  listTemporalContracts,
  getTemporalContract,
  listDecisionGates,
  listDomains,
  listLegacyMappings,
  validateRegistry,
  ContractRegistryError,
} = require('../../analytics-contracts');

describe('analytics contract registry integrity', () => {
  const result = validateRegistry();

  test('registry has no integrity errors', () => {
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test('covers 32 metrics, 9 contracts, 7 domains, 11 pending gates', () => {
    expect(listMetricDefinitions()).toHaveLength(32);
    expect(listTemporalContracts()).toHaveLength(9);
    expect(listDomains()).toHaveLength(7);
    expect(listDecisionGates()).toHaveLength(11);
    expect(listDecisionGates().every((gate) => gate.status === 'pending')).toBe(true);
    expect(listMetricDefinitions().some((row) => row.governanceStatus === 'approved')).toBe(false);
  });

  test('metric ids and contract ids are unique', () => {
    const metricIds = listMetricDefinitions().map((row) => row.metricId);
    const contractIds = listTemporalContracts().map((row) => row.temporalContractId);
    expect(new Set(metricIds).size).toBe(metricIds.length);
    expect(new Set(contractIds).size).toBe(contractIds.length);
  });

  test('unknown ids throw a stable error code', () => {
    expect(() => getMetricDefinition('not.a.metric')).toThrow(ContractRegistryError);
    try {
      getMetricDefinition('not.a.metric');
    } catch (err) {
      expect(err.code).toBe('METRIC_NOT_FOUND');
    }
    expect(() => getTemporalContract('TC-NOT-REAL')).toThrow(ContractRegistryError);
  });

  test('two unimplemented metrics stay unimplemented', () => {
    ['ops.participation.streak', 'roster.pair_pass.both_pairs'].forEach((id) => {
      const metric = getMetricDefinition(id);
      expect(metric.implementationStatus).toBe('not_implemented');
      expect(metric.legacyActive).toBe(false);
      expect(metric.officialUseAllowed).toBe(false);
    });
  });

  test('legacy mappings point at known metrics', () => {
    const ids = new Set(listMetricDefinitions().map((row) => row.metricId));
    listLegacyMappings().forEach((mapping) => {
      mapping.metricIds.forEach((id) => expect(ids.has(id)).toBe(true));
    });
    expect(listLegacyMappings().some((row) => row.mappingStatus === 'unmapped')).toBe(true);
    expect(listLegacyMappings().filter((row) => row.mappingStatus === 'verified').length).toBeGreaterThan(0);
  });
});
