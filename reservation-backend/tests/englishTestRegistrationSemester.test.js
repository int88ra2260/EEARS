/**
 * @jest-environment node
 */
const {
  SEMESTER_RANGES,
  getSemesterByDate,
  getActiveRegistrationSemester,
} = require('../utils/englishTestRegistrationSemester');

describe('englishTestRegistrationSemester', () => {
  it('getSemesterByDate maps dates within configured ranges', () => {
    expect(getSemesterByDate('2026-03-15')).toBe('114-2');
    expect(getSemesterByDate('2026-10-15')).toBe('115-1');
    expect(getSemesterByDate('2025-09-01')).toBe('114-1');
  });

  it('getSemesterByDate maps August into 115-1 after range alignment', () => {
    expect(getSemesterByDate('2026-08-15')).toBe('115-1');
  });

  it('getActiveRegistrationSemester uses range when date is inside SEMESTER_RANGES', () => {
    expect(getActiveRegistrationSemester(new Date('2026-10-01'))).toBe('115-1');
    expect(getActiveRegistrationSemester(new Date('2026-04-01'))).toBe('114-2');
  });

  it('exports semester ranges for maintenance scripts', () => {
    expect(SEMESTER_RANGES['115-1']).toEqual({ start: '2026-08-01', end: '2027-01-31' });
  });
});
