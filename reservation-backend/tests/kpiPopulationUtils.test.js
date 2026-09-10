'use strict';

const {
  parseGradeNumber,
  normalizeGradeFilter,
  gradeMatchesFilter,
} = require('../services/learningAnalytics/kpiPopulationUtils');

describe('kpiPopulationUtils', () => {
  test('parseGradeNumber handles common labels', () => {
    expect(parseGradeNumber('2')).toBe(2);
    expect(parseGradeNumber('大二')).toBe(2);
    expect(parseGradeNumber('二年級')).toBe(2);
    expect(parseGradeNumber('大四')).toBe(4);
    expect(parseGradeNumber('')).toBeNull();
  });

  test('normalizeGradeFilter 2-4 labels 大二至大四', () => {
    const filter = normalizeGradeFilter({ gradeMin: 2, gradeMax: 4 });
    expect(filter.enabled).toBe(true);
    expect(filter.label).toBe('大二至大四');
  });

  test('gradeMatchesFilter includes 2-4 only', () => {
    const filter = normalizeGradeFilter({ gradeMin: 2, gradeMax: 4 });
    expect(gradeMatchesFilter('大一', filter)).toBe(false);
    expect(gradeMatchesFilter('大二', filter)).toBe(true);
    expect(gradeMatchesFilter('3', filter)).toBe(true);
    expect(gradeMatchesFilter('大四', filter)).toBe(true);
    expect(gradeMatchesFilter('大五', filter)).toBe(false);
    expect(gradeMatchesFilter(null, filter)).toBe(false);
  });

  test('no filter includes all', () => {
    const filter = normalizeGradeFilter({});
    expect(filter.enabled).toBe(false);
    expect(gradeMatchesFilter('大一', filter)).toBe(true);
  });
});
