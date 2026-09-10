'use strict';

const {
  evaluateKpiPolicy,
  evaluatePairPass,
  pickBestCandidate,
} = require('../services/learningAnalytics/kpiPolicyEngine');
const { getBuiltinPolicySeeds } = require('../services/learningAnalytics/kpiPolicyDefaults');

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

  test('ay115 builtin policy evaluates LR and SW dimensions', () => {
    const seed = getBuiltinPolicySeeds().find((p) => p.policyKey === 'ay115-sitting-pair-sum');
    expect(seed).toBeTruthy();

    const evaluated = evaluateKpiPolicy(seed.definition, [
      {
        studentId: 'S001',
        attempts: [
          {
            id: 11,
            testType: 'TOEIC',
            examType: 'TOEIC',
            testDate: '2026-02-01',
            skillScores: [
              { skill: 'listening', rawScore: 410, cefr: 'B2', cefrRank: 4 },
              { skill: 'reading', rawScore: 375, cefr: 'B1', cefrRank: 3 },
            ],
          },
          {
            id: 12,
            testType: 'TOEIC_SW',
            examType: 'TOEIC_SW',
            testDate: '2026-02-15',
            skillScores: [
              { skill: 'speaking', rawScore: 160, cefr: 'B2', cefrRank: 4 },
              { skill: 'writing', rawScore: 150, cefr: 'B2', cefrRank: 4 },
            ],
          },
        ],
      },
      {
        studentId: 'S002',
        attempts: [
          {
            id: 21,
            testType: 'TOEIC',
            examType: 'TOEIC',
            testDate: '2026-02-01',
            skillScores: [
              { skill: 'listening', rawScore: 300, cefr: 'B1', cefrRank: 3 },
              { skill: 'reading', rawScore: 300, cefr: 'B1', cefrRank: 3 },
            ],
          },
        ],
      },
    ]);

    expect(evaluated.totalStudents).toBe(2);
    const lr = evaluated.dimensions.find((d) => d.id === 'lr_pair');
    const sw = evaluated.dimensions.find((d) => d.id === 'sw_pair');
    expect(lr.passedCount).toBe(1);
    expect(sw.passedCount).toBe(1);
    expect(evaluated.rows[0].dimensions.lr_pair.passed).toBe(true);
    expect(evaluated.rows[0].dimensions.sw_pair.passed).toBe(true);
    expect(evaluated.rows[1].dimensions.lr_pair.passed).toBe(false);
    // skill breakdown: S001 reading is B1 historically from that attempt only → reading not B2
    expect(evaluated.skillBreakdown.listening.count).toBe(1);
    expect(evaluated.skillBreakdown.reading.count).toBe(0);
  });

  test('legacy per-skill allows cross-attempt best', () => {
    const seed = getBuiltinPolicySeeds().find((p) => p.policyKey === 'legacy-per-skill-best');
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
    expect(evaluated.dimensions.find((d) => d.id === 'listening').passedCount).toBe(1);
    expect(evaluated.dimensions.find((d) => d.id === 'reading').passedCount).toBe(1);
    expect(evaluated.dimensions.find((d) => d.id === 'speaking').passedCount).toBe(0);
  });
});
