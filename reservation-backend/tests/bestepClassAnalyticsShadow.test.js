'use strict';

const fs = require('fs');
const path = require('path');
const {
  isBestepClassAnalyticsShadowEnabled,
  observeBestepClassAnalytics,
  classifyPassRatePopulation,
} = require('../analytics-contracts/pilots/bestepClassAnalyticsShadowRuntime');
const { computeClassBestepExportSummary } = require('../services/bestepClassService');
const {
  listMetricDefinitions,
  listTemporalContracts,
  listDomains,
  listDecisionGates,
} = require('../analytics-contracts');

const ENABLED = {
  NODE_ENV: 'test',
  BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED: 'true',
};

function member({ domestic, status, examType, passed }) {
  return {
    isDomesticForStats: domestic,
    personalRegistration: status ? { status, examType: examType || 'LRSW' } : null,
    attendance: {},
    score: passed == null ? null : { passed },
  };
}

function applyLegacyPassRate(students) {
  const summary = computeClassBestepExportSummary(students);
  const passedCount = students.filter((student) => student.score && student.score.passed).length;
  const passRate = summary.registeredCount > 0
    ? Number(((passedCount / summary.registeredCount) * 100).toFixed(2))
    : 0;
  return { ...summary, passedCount, passRate };
}

function responseWith(statistics) {
  return {
    result: {
      classInfo: { className: '合成班', semester: '114-1' },
      statistics,
      students: [{
        studentId: 'SYN-M-1',
        studentName: '合成甲',
        email: 'person@example.com',
        score: { totalScore: 320, passed: true },
      }],
      pagination: { page: 2, pageSize: 10, total: 1 },
    },
    queryContext: { semester: '114-1', examType: 'SW', page: 2, pageSize: 10, searchPresent: true },
  };
}

describe('BESTEP class analytics shadow runtime', () => {
  test('flag stays off unless the exact true string is set outside production', () => {
    expect(isBestepClassAnalyticsShadowEnabled({})).toBe(false);
    expect(isBestepClassAnalyticsShadowEnabled({
      NODE_ENV: 'test',
      BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED: 'TRUE',
    })).toBe(false);
    expect(isBestepClassAnalyticsShadowEnabled({
      NODE_ENV: 'development',
      BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED: '1',
    })).toBe(false);
    expect(isBestepClassAnalyticsShadowEnabled({
      NODE_ENV: 'production',
      BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED: 'true',
    })).toBe(false);
    expect(isBestepClassAnalyticsShadowEnabled(ENABLED)).toBe(true);
  });

  test('disabled flag does not call the validator or build a snapshot', () => {
    const evaluate = jest.fn();
    const mapQueryContext = jest.fn();
    const result = observeBestepClassAnalytics(responseWith({ passedCount: 1, registeredCount: 1 }), {
      evaluate,
      mapQueryContext,
    }, { NODE_ENV: 'test' });
    expect(result).toBeNull();
    expect(evaluate).not.toHaveBeenCalled();
    expect(mapQueryContext).not.toHaveBeenCalled();
  });

  test('enabled flag validates without mutating the response or copying student values', () => {
    const payload = responseWith({
      passedCount: 1,
      registeredCount: 1,
      passRate: 100,
    });
    const before = JSON.stringify(payload);
    const diagnostic = observeBestepClassAnalytics(payload, {}, ENABLED);
    expect(JSON.stringify(payload)).toBe(before);
    expect(diagnostic.pilotId).toBe('bestep-class-analytics');
    expect(diagnostic.contractVersion).toBe('phase-4l');
    expect(diagnostic.recalculated).toBe(false);
    expect(diagnostic.examSittings).toBeNull();
    expect(diagnostic.governance).toEqual({
      officialUseAllowed: false,
      causalClaimAllowed: false,
      sourcePriorityApplied: false,
      mergePerformed: false,
    });
    const serialized = JSON.stringify(diagnostic);
    expect(serialized).not.toContain('SYN-M-1');
    expect(serialized).not.toContain('合成甲');
    expect(serialized).not.toContain('person@example.com');
    expect(serialized).not.toContain('320');
    expect(serialized).not.toContain('F-BESTEP-02');
    expect(diagnostic.semanticFindings.some((row) => row.code === 'F-BESTEP-01' && row.evidence === 'definition_mismatch')).toBe(true);
  });

  test('mapping, validator, and sanitizer failures stay inside a fixed diagnostic', () => {
    const leak = () => new Error('student SYN-M-1 person@example.com');
    const mapped = observeBestepClassAnalytics(responseWith({}), {
      mapQueryContext() { throw leak(); },
    }, ENABLED);
    const validated = observeBestepClassAnalytics(responseWith({}), {
      evaluate() { throw leak(); },
    }, ENABLED);
    const sanitized = observeBestepClassAnalytics(responseWith({}), {
      sanitize() { throw leak(); },
    }, ENABLED);
    [mapped, validated, sanitized].forEach((diagnostic) => {
      expect(diagnostic.status).toBe('shadow_error');
      expect(diagnostic.semanticFindings).toEqual([
        { code: 'SHADOW_INTERNAL_ERROR', evidence: 'not_verified' },
      ]);
      const serialized = JSON.stringify(diagnostic);
      expect(serialized).not.toContain('SYN-M-1');
      expect(serialized).not.toContain('person@example.com');
      expect(serialized).not.toContain('Error');
    });
    expect(mapped.executionStage).toBe('query_context');
    expect(validated.executionStage).toBe('validator');
    expect(sanitized.executionStage).toBe('sanitizer');
  });

  test('a throwing logger does not replace a completed diagnostic', () => {
    const diagnostic = observeBestepClassAnalytics(
      responseWith({ passedCount: 1, registeredCount: 1 }),
      { logger() { throw new Error('log failed SYN-M-1'); } },
      { ...ENABLED, BESTEP_CLASS_ANALYTICS_SHADOW_LOG: 'true' }
    );
    expect(diagnostic.status).not.toBe('shadow_error');
    expect(JSON.stringify(diagnostic)).not.toContain('SYN-M-1');
  });

  test('pass-rate populations follow the live summary helper and the live formula', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../services/bestepClassService.js'),
      'utf8'
    );
    expect(source).toContain(
      'const passedCount = allStudents.filter((s) => s.score && s.score.passed).length;'
    );
    expect(source).toContain('(passedCount / summary.registeredCount) * 100');

    const aligned = applyLegacyPassRate([
      member({ domestic: true, status: 'success', passed: true }),
      member({ domestic: true, status: 'success', passed: false }),
    ]);
    expect(aligned.registeredCount).toBe(2);
    expect(aligned.passedCount).toBe(1);
    expect(aligned.passRate).toBe(50);
    expect(classifyPassRatePopulation(aligned).some((row) => row.evidence === 'observed_numerical_anomaly')).toBe(false);

    const mismatched = applyLegacyPassRate([
      member({ domestic: true, status: 'success', passed: true }),
      member({ domestic: true, status: 'success', passed: false }),
      member({ domestic: true, status: 'failed', passed: true }),
      member({ domestic: false, status: 'success', passed: true }),
    ]);
    expect(mismatched.registeredCount).toBe(2);
    expect(mismatched.passedCount).toBe(3);
    expect(mismatched.passRate).toBe(150);

    const zeroDenominator = applyLegacyPassRate([
      member({ domestic: false, status: 'success', passed: true }),
    ]);
    expect(zeroDenominator.registeredCount).toBe(0);
    expect(zeroDenominator.passedCount).toBe(1);
    expect(zeroDenominator.passRate).toBe(0);

    const anomaly = classifyPassRatePopulation(mismatched);
    expect(anomaly).toEqual([
      {
        code: 'F-BESTEP-01',
        evidence: 'definition_mismatch',
        population: 'passedCount_all_memberships_vs_registeredCount_domestic_success',
      },
      {
        code: 'F-BESTEP-01',
        evidence: 'observed_numerical_anomaly',
        numeratorExceedsDenominator: true,
        denominatorZeroWithPositiveNumerator: false,
      },
    ]);
    expect(classifyPassRatePopulation(zeroDenominator)).toContainEqual({
      code: 'F-BESTEP-01',
      evidence: 'observed_numerical_anomaly',
      numeratorExceedsDenominator: false,
      denominatorZeroWithPositiveNumerator: true,
    });
  });

  test('governance registries stay unchanged', () => {
    expect(listMetricDefinitions()).toHaveLength(32);
    expect(listTemporalContracts()).toHaveLength(9);
    expect(listDomains()).toHaveLength(7);
    expect(listDecisionGates()).toHaveLength(11);
    expect(listDecisionGates().every((row) => row.status === 'pending')).toBe(true);
    expect(listMetricDefinitions().filter((row) => row.implementationStatus === 'not_implemented')).toHaveLength(2);
  });
});
