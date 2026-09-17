'use strict';

const {
  evaluateKpiPolicy,
  evaluatePairPass,
  pickBestCandidate,
  buildPairAssemblies,
} = require('../services/learningAnalytics/kpiPolicyEngine');
const {
  getBuiltinPolicySeeds,
  DEFAULT_BUILTIN_POLICY_KEY,
  RETIRED_BUILTIN_POLICY_KEYS,
} = require('../services/learningAnalytics/kpiPolicyDefaults');

function toeicAttempt({ id, date, listening, reading }) {
  return {
    id,
    testType: 'TOEIC',
    examType: 'TOEIC',
    testDate: date,
    skillScores: [
      {
        skill: 'listening',
        rawScore: listening.raw,
        cefr: listening.cefr,
        cefrRank: listening.rank,
      },
      {
        skill: 'reading',
        rawScore: reading.raw,
        cefr: reading.cefr,
        cefrRank: reading.rank,
      },
    ],
  };
}

describe('kpiPolicyEngine', () => {
  test('TOEIC LR sum_only: 410+375=785 passes even if reading below skill B2', () => {
    const skillMap = {
      listening: { skill: 'listening', rawScore: 410, cefr: 'B2', cefrRank: 4 },
      reading: { skill: 'reading', rawScore: 375, cefr: 'B1', cefrRank: 3 },
    };
    const result = evaluatePairPass({
      skills: ['listening', 'reading'],
      skillMap,
      rule: { passMode: 'sum_raw', minTotal: 785 },
    });
    expect(result.passed).toBe(true);
    expect(result.combined).toBe(785);
  });

  test('pair incomplete skills does not pass', () => {
    const result = evaluatePairPass({
      skills: ['listening', 'reading'],
      skillMap: {
        listening: { skill: 'listening', rawScore: 450, cefr: 'B2', cefrRank: 4 },
      },
      rule: { passMode: 'sum_raw', minTotal: 785 },
    });
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('INCOMPLETE_SKILLS');
  });

  test('proofSelection highest_combined picks max sum', () => {
    const best = pickBestCandidate([
      { combined: 785, examDate: '2026-01-01', attemptId: 1 },
      { combined: 820, examDate: '2025-06-01', attemptId: 2 },
      { combined: 800, examDate: '2026-03-01', attemptId: 3 },
    ], 'highest_combined');
    expect(best.attemptId).toBe(2);
    expect(best.combined).toBe(820);
  });

  test('same_date assembly merges skills from same instrument+date', () => {
    const attempts = [
      {
        id: 1,
        instrumentCode: 'BESTEP',
        examDate: '2026-05-16',
        skillMap: {
          listening: { skill: 'listening', rawScore: 100, cefrRank: 4 },
        },
      },
      {
        id: 2,
        instrumentCode: 'BESTEP',
        examDate: '2026-05-16',
        skillMap: {
          reading: { skill: 'reading', rawScore: 100, cefrRank: 4 },
        },
      },
      {
        id: 3,
        instrumentCode: 'BESTEP',
        examDate: '2026-06-01',
        skillMap: {
          speaking: { skill: 'speaking', rawScore: 280, cefrRank: 4 },
        },
      },
    ];
    const sittings = buildPairAssemblies(attempts, 'same_date');
    expect(sittings).toHaveLength(2);
    const may = sittings.find((s) => s.examDate === '2026-05-16');
    expect(may.skillMap.listening).toBeTruthy();
    expect(may.skillMap.reading).toBeTruthy();
  });

  test('builtin seeds: eight pair policies, retired keys gone', () => {
    const seeds = getBuiltinPolicySeeds();
    expect(seeds).toHaveLength(8);
    expect(seeds.every((p) => p.policyKey.startsWith('pair-'))).toBe(true);
    expect(seeds.find((p) => p.policyKey === DEFAULT_BUILTIN_POLICY_KEY)).toBeTruthy();
    for (const key of RETIRED_BUILTIN_POLICY_KEYS) {
      expect(seeds.find((p) => p.policyKey === key)).toBeFalsy();
    }
  });

  test('strict same_date both_cefr: split attempts same date pass; sum-only B1 reading fails', () => {
    const seed = getBuiltinPolicySeeds().find((p) => p.policyKey === 'pair-bothcefr-samedate-g24');
    const evaluated = evaluateKpiPolicy(seed.definition, [
      {
        studentId: 'S001',
        attempts: [
          {
            id: 1,
            testType: 'BESTEP',
            examType: 'BESTEP',
            testDate: '2026-05-16',
            skillScores: [
              { skill: 'listening', rawScore: 100, cefr: 'B2', cefrRank: 4 },
            ],
          },
          {
            id: 2,
            testType: 'BESTEP',
            examType: 'BESTEP',
            testDate: '2026-05-16',
            skillScores: [
              { skill: 'reading', rawScore: 100, cefr: 'B2', cefrRank: 4 },
            ],
          },
        ],
      },
      {
        studentId: 'S002',
        attempts: [
          toeicAttempt({
            id: 11,
            date: '2026-02-01',
            listening: { raw: 410, cefr: 'B2', rank: 4 },
            reading: { raw: 375, cefr: 'B1', rank: 3 },
          }),
        ],
      },
    ]);
    expect(evaluated.dimensions.find((d) => d.id === 'lr_pair').passedCount).toBe(1);
    expect(evaluated.rows[0].dimensions.lr_pair.passed).toBe(true);
    expect(evaluated.rows[1].dimensions.lr_pair.passed).toBe(false);
  });

  test('relax sitting cross_date both_cefr: different dates same instrument pass', () => {
    const seed = getBuiltinPolicySeeds().find((p) => p.policyKey === 'pair-bothcefr-crossdate-g24');
    const evaluated = evaluateKpiPolicy(seed.definition, [
      {
        studentId: 'S003',
        attempts: [
          {
            id: 31,
            testType: 'BESTEP',
            examType: 'BESTEP',
            testDate: '2025-10-01',
            skillScores: [
              { skill: 'listening', rawScore: 100, cefr: 'B2', cefrRank: 4 },
            ],
          },
          {
            id: 32,
            testType: 'BESTEP',
            examType: 'BESTEP',
            testDate: '2026-03-01',
            skillScores: [
              { skill: 'reading', rawScore: 100, cefr: 'B2', cefrRank: 4 },
            ],
          },
        ],
      },
    ]);
    expect(evaluated.dimensions.find((d) => d.id === 'lr_pair').passedCount).toBe(1);
  });

  test('relax section same_date sum_raw: TOEIC 785 with B1 reading passes', () => {
    const seed = getBuiltinPolicySeeds().find((p) => p.policyKey === 'pair-sumraw-samedate-g24');
    const evaluated = evaluateKpiPolicy(seed.definition, [
      {
        studentId: 'S004',
        attempts: [
          toeicAttempt({
            id: 41,
            date: '2026-02-01',
            listening: { raw: 410, cefr: 'B2', rank: 4 },
            reading: { raw: 375, cefr: 'B1', rank: 3 },
          }),
        ],
      },
    ]);
    expect(evaluated.dimensions.find((d) => d.id === 'lr_pair').passedCount).toBe(1);
  });

  test('relax section+sitting sum_raw: best L and R across dates', () => {
    const seed = getBuiltinPolicySeeds().find((p) => p.policyKey === 'pair-sumraw-crossdate-g24');
    const evaluated = evaluateKpiPolicy(seed.definition, [
      {
        studentId: 'S005',
        attempts: [
          toeicAttempt({
            id: 51,
            date: '2026-01-01',
            listening: { raw: 410, cefr: 'B2', rank: 4 },
            reading: { raw: 300, cefr: 'B1', rank: 3 },
          }),
          toeicAttempt({
            id: 52,
            date: '2026-06-01',
            listening: { raw: 350, cefr: 'B1', rank: 3 },
            reading: { raw: 375, cefr: 'B1', rank: 3 },
          }),
        ],
      },
    ]);
    // best L=410 (Jan) + best R=375 (Jun) = 785
    expect(evaluated.dimensions.find((d) => d.id === 'lr_pair').passedCount).toBe(1);
  });

  test('grade groups differ only by population', () => {
    const g13 = getBuiltinPolicySeeds().find((p) => p.policyKey === 'pair-bothcefr-samedate-g13');
    const g24 = getBuiltinPolicySeeds().find((p) => p.policyKey === 'pair-bothcefr-samedate-g24');
    expect(g13.definition.population.gradeMin).toBe(1);
    expect(g13.definition.population.gradeMax).toBe(3);
    expect(g24.definition.population.gradeMin).toBe(2);
    expect(g24.definition.population.gradeMax).toBe(4);
    expect(g13.definition.dimensions[0].pairAssembly).toBe(g24.definition.dimensions[0].pairAssembly);
  });
});
