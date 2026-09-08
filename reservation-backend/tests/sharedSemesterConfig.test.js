/**
 * @jest-environment node
 */
'use strict';

const shared = require('../../shared/semesterConfig');
const {
  SEMESTER_RANGES: constantsRanges,
  SEMESTER_ORDER: constantsOrder,
  getCurrentSemester,
  semesterIdFromDate,
} = require('../utils/semesterConstants');
const {
  SEMESTER_RANGES: englishRanges,
  getActiveRegistrationSemester,
} = require('../utils/englishTestRegistrationSemester');
const semesterUtil = require('../utils/semester');

describe('shared semester config wiring', () => {
  it('semesterConstants and englishTestRegistrationSemester use shared ranges', () => {
    expect(constantsRanges).toEqual(shared.SEMESTER_RANGES);
    expect(constantsOrder).toEqual(shared.SEMESTER_ORDER);
    expect(englishRanges).toEqual(shared.SEMESTER_RANGES);
  });

  it('utils/semester re-exports the same getCurrentSemester', () => {
    expect(semesterUtil.getCurrentSemester()).toBe(getCurrentSemester());
    expect(semesterIdFromDate('2026-08-01')).toBe('115-1');
    expect(getActiveRegistrationSemester(new Date('2026-08-15T00:00:00+08:00'))).toBe('115-1');
  });
});
