'use strict';

const {
  resolveBaselineCefrBand,
  applyBaselineLevelFilter,
} = require('../services/learningAnalytics/baselineAbilityUtils');

describe('baselineAbilityUtils', () => {
  it('does not turn a GSAT score or placement label into CEFR', () => {
    expect(resolveBaselineCefrBand({
      baselineCefr: null,
      baselineEnglishScore: 15,
      baselineLevel: '學測 15 · 英文高級',
    })).toBeNull();
  });

  it('keeps an explicitly stored CEFR', () => {
    expect(resolveBaselineCefrBand({
      baselineCefr: 'B1',
      baselineEnglishScore: 12,
      baselineLevel: '英文中級',
    })).toBe('B1');
  });

  it('filters students only by an explicit baseline CEFR', () => {
    const students = [
      { studentId: 'A', baselineCefr: 'B1', baselineEnglishScore: 8, baselineLevel: '英文初級' },
      { studentId: 'B', baselineCefr: null, baselineEnglishScore: 15, baselineLevel: '英文高級' },
    ];
    const filtered = applyBaselineLevelFilter(students, { baseline_level: 'B1' });
    expect(filtered.map((s) => s.studentId)).toEqual(['A']);
  });
});
