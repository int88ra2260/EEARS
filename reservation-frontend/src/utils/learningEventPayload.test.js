import {
  buildListeningLadderCompletePayload,
  buildVocabularyDepthCompletePayload,
  buildVocabularySizeCompletePayload,
} from './learningEventPayload.js';

describe('learningEventPayload micro-learning', () => {
  test('buildListeningLadderCompletePayload', () => {
    const payload = buildListeningLadderCompletePayload({
      traceId: 'll_testtrace001',
      score: 420,
      accuracy: 0.75,
      highestLevelReached: 'B1',
      correctCount: 15,
      totalAnswered: 20,
      bestStreak: 5,
      durationMs: 90000,
    });
    expect(payload.gameId).toBe('listening_ladder');
    expect(payload.cefrLevel).toBe('B1');
    expect(payload.skillTags).toContain('listening');
  });

  test('buildVocabularyDepthCompletePayload', () => {
    const result = {
      estimatedLevel: 'B2',
      accuracy: 0.8,
      confidence: 'medium',
      stats: { totalCorrect: 20, totalAnswered: 24 },
    };
    const summary = {
      traceId: 'vd_testtrace001',
      durationMs: 360000,
      passedLevels: ['A1', 'A2', 'B1'],
      failLevel: 'B2',
      endReason: 'level_failed',
      levelStats: [],
      totalCorrect: 20,
      totalAnswered: 24,
    };
    const payload = buildVocabularyDepthCompletePayload(result, summary);
    expect(payload.gameId).toBe('vocabulary_depth');
    expect(payload.cefrLevel).toBe('B2');
    expect(payload.payload.recommendedActivities).toContain('international-forum');
  });

  test('buildVocabularySizeCompletePayload', () => {
    const result = {
      estimatedWords: 3200,
      estimatedLevel: 'B1',
      recognitionRate: 0.72,
      wordsToNextLevel: 301,
      endReason: 'completed',
      stats: { totalKnown: 36, totalSampled: 50 },
    };
    const summary = {
      traceId: 'vs_testtrace001',
      durationMs: 120000,
      totalKnown: 36,
      totalSampled: 50,
      answerLog: [],
    };
    const payload = buildVocabularySizeCompletePayload(result, summary);
    expect(payload.gameId).toBe('vocabulary_size');
    expect(payload.cefrLevel).toBe('B1');
    expect(payload.score).toBe(3200);
    expect(payload.skillTags).toContain('vocabulary_size');
  });
});
