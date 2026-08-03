'use strict';

const {
  fitOlsRegression,
  fitLogisticRegression,
  computeAustinLogitCaliper,
  logit,
  predictOls,
} = require('../services/learningJourney/analytics/lvaMathUtils');
const {
  resolveMonthsBetweenTests,
  computeAdjustedGrowthEpisodesV2,
  computeAdjustedGrowthEpisodesLegacy,
} = require('../services/learningJourney/analytics/lvaAdjustedGrowthService');
const {
  propensityLikeScoreLegacy,
  summarizeQuasiCausalEstimatesV2,
  summarizeAipwEstimates,
} = require('../services/learningJourney/analytics/lvaPropensityService');
const { getMethodComparisonPayload } = require('../services/learningAnalytics/learningAnalyticsMethodComparison');

describe('lvaMathUtils', () => {
  it('fits a simple OLS line', () => {
    const X = [[1, 0], [1, 1], [1, 2], [1, 3]];
    const y = [2, 4, 6, 8];
    const model = fitOlsRegression(X, y);
    expect(model.coefficients[0]).toBeCloseTo(2, 0);
    expect(model.coefficients[1]).toBeCloseTo(2, 0);
    expect(predictOls(model, [1, 1.5])).toBeCloseTo(5, 0);
  });

  it('computes Austin caliper from propensities', () => {
    const caliper = computeAustinLogitCaliper([0.2, 0.35, 0.5, 0.65, 0.8]);
    expect(caliper).toBeGreaterThan(0);
    expect(caliper).toBeLessThan(2);
  });

  it('fits logistic regression on separable data', () => {
    const X = [[1, -1], [1, -0.5], [1, 0.5], [1, 1]];
    const y = [0, 0, 1, 1];
    const model = fitLogisticRegression(X, y);
    expect(model.coefficients[1]).toBeGreaterThan(0);
    expect(logit(0.5)).toBe(0);
  });
});

describe('lvaAdjustedGrowthService', () => {
  const studentById = new Map([
    ['S001', {
      studentId: 'S001',
      department: '外文系',
      baselineCefr: 'A2',
      retestFlag: true,
      hasValidExam: true,
      totalResourceHours: 6,
    }],
  ]);

  const exams = [
    {
      id: 10,
      studentId: 'S001',
      retestFlag: true,
      deltaRawScore: 125,
      previousRawScore: 275,
      previousExamEventId: 9,
      rawScore: 400,
      instrument: 'TOEIC',
      skill: 'listening',
      examDate: '2025-07-01',
      resourceHoursBeforeExam: 6,
    },
    {
      id: 9,
      studentId: 'S001',
      retestFlag: false,
      rawScore: 275,
      instrument: 'TOEIC',
      skill: 'listening',
      examDate: '2025-01-01',
    },
  ];

  it('resolves monthsBetweenTests from previous exam id', () => {
    const examById = new Map([[9, exams[1]]]);
    expect(resolveMonthsBetweenTests(exams[0], examById)).toBeCloseTo(5.98, 1);
  });

  it('legacy and v2 both produce adjusted growth episodes', () => {
    const legacy = computeAdjustedGrowthEpisodesLegacy(exams, studentById);
    const v2 = computeAdjustedGrowthEpisodesV2(exams, studentById);
    expect(legacy).toHaveLength(1);
    expect(v2).toHaveLength(1);
    expect(legacy[0].actualGseGrowth).toBe(16);
    expect(v2[0].monthsBetweenTests).not.toBeNull();
    expect(v2[0].estimateType).toBe('baseline_adjusted_regression_v2');
  });
});

describe('lvaPropensityService v2', () => {
  const episodes = [
    {
      studentId: 'S001',
      skill: 'listening',
      baselineGse: 36,
      initialCefrBand: 'A2',
      department: '外文系',
      evidenceQuality: 'high',
      resourceHoursBeforeExam: 4,
      monthsBetweenTests: 6,
      adjustedGseGrowth: 20,
    },
    {
      studentId: 'S002',
      skill: 'listening',
      baselineGse: 36,
      initialCefrBand: 'A2',
      department: '外文系',
      evidenceQuality: 'high',
      resourceHoursBeforeExam: 0,
      monthsBetweenTests: 6,
      adjustedGseGrowth: 5,
    },
  ];

  it('keeps legacy propensity-like score bounded', () => {
    const score = propensityLikeScoreLegacy(episodes[0]);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('builds v2 matched estimates with logistic propensity metadata', () => {
    const result = summarizeQuasiCausalEstimatesV2([
      { studentId: 'S001', eventType: 'activity_event', title: 'English Table', hours: 2, status: 'valid' },
    ], { sampleEpisodes: episodes }, {
      resourceKeyForEvent: () => 'ENGLISH_TABLE',
    });
    expect(result.estimateType).toBe('propensity_matched_logistic_v2');
    expect(result.causalClaimAllowed).toBe(false);
    expect(result.byResource[0].propensityModel).toMatch(/logistic|heuristic/);
  });

  it('builds AIPW estimates without allowing causal claims', () => {
    const result = summarizeAipwEstimates([
      { studentId: 'S001', eventType: 'activity_event', title: 'English Table', hours: 2, status: 'valid' },
    ], { sampleEpisodes: episodes }, {
      resourceKeyForEvent: () => 'ENGLISH_TABLE',
    });
    expect(result.estimateType).toBe('aipw_doubly_robust_v2');
    expect(result.causalClaimAllowed).toBe(false);
  });
});

describe('learningAnalyticsMethodComparison', () => {
  it('exports a comparison table for API consumers', () => {
    const payload = getMethodComparisonPayload();
    expect(payload.rows.length).toBeGreaterThanOrEqual(5);
    expect(payload.activeMethods.adjustedGrowth).toBe('baseline_adjusted_regression_v2');
    expect(payload.disclaimer).toMatch(/causalClaimAllowed/);
  });
});
