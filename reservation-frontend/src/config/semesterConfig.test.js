import { SEMESTER_RANGES, SEMESTER_ORDER } from '../config/semesterConfig';
import { SEMESTER_OPTIONS, getCurrentSemester, semesterIdFromDate } from '../utils/semesterUtils';

describe('semesterConfig (synced from shared)', () => {
  it('exposes ranges and order', () => {
    expect(SEMESTER_RANGES['115-1']).toEqual({ start: '2026-08-01', end: '2027-01-31' });
    expect(SEMESTER_ORDER).toEqual(['113-2', '114-1', '114-2', '115-1', '115-2']);
  });

  it('builds SEMESTER_OPTIONS from SEMESTER_ORDER', () => {
    expect(SEMESTER_OPTIONS[0]).toEqual({ value: '', label: '全部學期' });
    expect(SEMESTER_OPTIONS.slice(1).map((o) => o.value)).toEqual([...SEMESTER_ORDER]);
  });

  it('maps August into 115-1', () => {
    expect(semesterIdFromDate('2026-08-15')).toBe('115-1');
    expect(typeof getCurrentSemester()).toBe('string');
  });
});
