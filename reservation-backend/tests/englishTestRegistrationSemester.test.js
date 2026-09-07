/**
 * @jest-environment node
 */
const {
  SEMESTER_RANGES,
  getSemesterByDate,
  getActiveRegistrationSemester,
  toTaipeiDateOnly,
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

  it('getSemesterByDate uses Taipei calendar date for Date objects near day boundaries', () => {
    // 2026-07-31 23:30 Taipei = 2026-07-31 15:30Z → still 114-2
    expect(getSemesterByDate(new Date('2026-07-31T15:30:00.000Z'))).toBe('114-2');
    // 2026-08-01 00:30 Taipei = 2026-07-31 16:30Z → 115-1
    expect(getSemesterByDate(new Date('2026-07-31T16:30:00.000Z'))).toBe('115-1');
  });

  it('toTaipeiDateOnly prefers YYYY-MM-DD prefix from strings', () => {
    expect(toTaipeiDateOnly('2026-07-31T23:59:59.000Z')).toBe('2026-07-31');
  });

  it('getActiveRegistrationSemester uses range when date is inside SEMESTER_RANGES', () => {
    expect(getActiveRegistrationSemester(new Date('2026-10-01'))).toBe('115-1');
    expect(getActiveRegistrationSemester(new Date('2026-04-01'))).toBe('114-2');
  });

  it('exports semester ranges for maintenance scripts', () => {
    expect(SEMESTER_RANGES['115-1']).toEqual({ start: '2026-08-01', end: '2027-01-31' });
  });
});
