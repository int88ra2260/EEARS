'use strict';

const {
  identifyWeakSkills,
  estimateB2PlusProbability,
  RESOURCE_LABELS,
} = require('../services/learningAnalytics/learningAnalyticsDecisionSupportService');

describe('learningAnalyticsDecisionSupportService helpers', () => {
  it('identifies weak skills from best scores', () => {
    const weak = identifyWeakSkills({
      bestListeningScore: 400,
      bestReadingScore: 450,
      bestSpeakingScore: 200,
      bestWritingScore: 220,
    });
    expect(weak[0]).toBe('speaking');
    expect(weak).toContain('writing');
  });

  it('estimates B2+ probability with gse baseline', () => {
    const already = estimateB2PlusProbability({ isB2plus: true, baselineCefr: 'B1' });
    expect(already.probability).toBe(1);

    const outlook = estimateB2PlusProbability({
      isB2plus: false,
      baselineCefr: 'B1',
      retestFlag: true,
      totalResourceHours: 35,
      examCount: 2,
    });
    expect(outlook.probability).toBeGreaterThan(0.5);
    expect(outlook.factors.length).toBeGreaterThan(0);
  });

  it('exports resource labels', () => {
    expect(RESOURCE_LABELS.ENGLISH_TABLE).toBeTruthy();
  });
});
