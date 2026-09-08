'use strict';

const {
  deriveSemesterIdFromDate,
  semesterIdFromDate,
} = require('../utils/semesterConstants');

describe('semesterConstants', () => {
  it('derives semester from calendar date', () => {
    expect(deriveSemesterIdFromDate('2022-07-31')).toBe('110-2');
    expect(deriveSemesterIdFromDate('2025-11-22')).toBe('114-1');
    expect(deriveSemesterIdFromDate('2026-04-20')).toBe('114-2');
    expect(deriveSemesterIdFromDate('2026-01-15')).toBe('114-1');
    expect(deriveSemesterIdFromDate('2025-08-01')).toBe('114-1');
  });

  it('prefers configured SEMESTER_RANGES when available', () => {
    expect(semesterIdFromDate('2026-04-20')).toBe('114-2');
    expect(semesterIdFromDate('2026-08-15')).toBe('115-1');
  });

  it('matches shared/semesterConfig for 115-1 (starts August)', () => {
    const { SEMESTER_RANGES } = require('../utils/semesterConstants');
    expect(SEMESTER_RANGES['115-1']).toEqual({ start: '2026-08-01', end: '2027-01-31' });
  });
});