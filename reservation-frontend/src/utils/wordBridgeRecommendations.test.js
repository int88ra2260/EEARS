import {
  buildPreferenceRecommendations,
  buildWordBridgeRecommendations,
  WRITING_WORKSHOP_KEY,
} from './wordBridgeRecommendations';

describe('buildWordBridgeRecommendations', () => {
  const summary = {
    endReason: 'mistakes',
    failLevel: 'B1',
    passedLevels: ['A1', 'A2'],
    totalMistakes: 5,
    durationMs: 120000,
  };

  it('includes writing workshop when focus is writing', () => {
    const result = buildWordBridgeRecommendations(summary, {
      density: 'balanced',
      focus: 'writing',
    });
    expect(result.activities).toContain(WRITING_WORKSHOP_KEY);
  });

  it('prefers club and forum for high-density speaking learners', () => {
    const result = buildPreferenceRecommendations({
      density: 'high',
      focus: 'speaking',
    });
    expect(result.activities[0]).toMatch(/english-club|international-forum/);
  });

  it('falls back to CEFR mapping without preferences', () => {
    const result = buildWordBridgeRecommendations(summary, null);
    expect(result.activities.length).toBeGreaterThan(0);
    expect(result.estimatedLevel).toBeTruthy();
  });

  it('buildPreferenceRecommendations is independent of CEFR level', () => {
    const result = buildPreferenceRecommendations({
      density: 'low',
      focus: 'balanced',
    });
    expect(result.activities[0]).toBe('english-table');
  });
});
