'use strict';

const {
  inferGsatOverallCefr,
  resolveBaselineCefrBand,
  applyBaselineLevelFilter,
} = require('../services/learningAnalytics/baselineAbilityUtils');

describe('baselineAbilityUtils', () => {
  it('maps GSAT score to CEFR band', () => {
    expect(inferGsatOverallCefr(12)).toBe('B1');
    expect(inferGsatOverallCefr(15)).toBe('B2');
    expect(inferGsatOverallCefr(5)).toBe('BELOW_A1');
  });

  it('resolves baseline from english score when baselineCefr is empty', () => {
    const band = resolveBaselineCefrBand({
      baselineCefr: null,
      baselineEnglishScore: 12,
      baselineLevel: '學測 12',
    });
    expect(band).toBe('B1');
  });

  it('filters students by baseline_level CEFR option', () => {
    const students = [
      { studentId: 'A', baselineEnglishScore: 12, baselineLevel: '學測 12' },
      { studentId: 'B', baselineEnglishScore: 16, baselineLevel: '學測 16' },
    ];
    const filtered = applyBaselineLevelFilter(students, { baseline_level: 'B1' });
    expect(filtered.map((s) => s.studentId)).toEqual(['A']);
  });
});
