import { formatYearMonth, leaderSessionBadge, shiftYearMonth, sortLeaderSessions } from './leaderSessions';

describe('sortLeaderSessions', () => {
  const today = '2026-10-31';

  test('puts today first, then the next session, then recent past', () => {
    const sorted = sortLeaderSessions([
      { eventId: 1, date: '2026-10-01', startTime: '18:00' },
      { eventId: 2, date: '2026-11-02', startTime: '18:00' },
      { eventId: 3, date: '2026-10-31', startTime: '19:00' },
      { eventId: 4, date: '2026-10-30', startTime: '18:00' },
      { eventId: 5, date: '2026-11-01', startTime: '18:00' },
      { eventId: 6, date: '2026-10-31', startTime: '10:00' },
    ], today);

    expect(sorted.map((row) => row.eventId)).toEqual([6, 3, 5, 2, 4, 1]);
    expect(leaderSessionBadge(sorted[0], sorted, today)).toBe('今天');
    expect(leaderSessionBadge(sorted[2], sorted, today)).toBe('下一場');
    expect(leaderSessionBadge(sorted[3], sorted, today)).toBe('');
  });
});

describe('year month helpers', () => {
  test('shifts and labels a month', () => {
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftYearMonth('2026-10', 1)).toBe('2026-11');
    expect(formatYearMonth('2026-10')).toBe('2026年10月');
  });
});
