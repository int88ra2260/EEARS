import {
  computeVocabularyDepthResult,
  didPassLevel,
  passThresholdForLevel,
  validateQuestionBank,
} from './index.js';

describe('vocabularyDepth scoring', () => {
  beforeAll(() => {
    validateQuestionBank();
  });

  test('pass threshold is two-thirds rounded up', () => {
    expect(passThresholdForLevel(6)).toBe(4);
    expect(passThresholdForLevel(10)).toBe(7);
  });

  test('didPassLevel respects threshold', () => {
    expect(didPassLevel('B1', 4, 6)).toBe(true);
    expect(didPassLevel('B1', 3, 6)).toBe(false);
  });

  test('cleared_c1 yields C1 estimate', () => {
    const result = computeVocabularyDepthResult({
      traceId: 'vd_test',
      durationMs: 300000,
      passedLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
      failLevel: null,
      endReason: 'cleared_c1',
      levelStats: [],
      answerLog: [],
      totalCorrect: 28,
      totalAnswered: 30,
    });
    expect(result.estimatedLevel).toBe('C1');
    expect(result.endReason).toBe('cleared_c1');
  });

  test('fail at B1 yields A2 estimate', () => {
    const result = computeVocabularyDepthResult({
      traceId: 'vd_test',
      durationMs: 120000,
      passedLevels: ['A1', 'A2'],
      failLevel: 'B1',
      endReason: 'level_failed',
      levelStats: [
        { level: 'A1', correct: 5, total: 6, passed: true },
        { level: 'A2', correct: 4, total: 6, passed: true },
        { level: 'B1', correct: 2, total: 6, passed: false },
      ],
      answerLog: [],
      totalCorrect: 11,
      totalAnswered: 18,
    });
    expect(result.estimatedLevel).toBe('A2');
  });
});
