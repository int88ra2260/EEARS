import { formatEnglishTestSemesterLabel } from './englishTestSemesterDisplay';

describe('formatEnglishTestSemesterLabel', () => {
  it('formats standard semester codes', () => {
    expect(formatEnglishTestSemesterLabel('115-1')).toBe('115 學年第 1 學期');
    expect(formatEnglishTestSemesterLabel('114-2')).toBe('114 學年第 2 學期');
  });

  it('falls back for unknown formats', () => {
    expect(formatEnglishTestSemesterLabel('custom')).toBe('custom 學期');
    expect(formatEnglishTestSemesterLabel('')).toBe('');
  });
});
