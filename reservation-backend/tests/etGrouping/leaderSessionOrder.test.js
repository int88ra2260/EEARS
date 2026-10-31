'use strict';

const { sortLeaderSessions } = require('../../services/etGrouping/leaderSessionOrder');

describe('sortLeaderSessions', () => {
  const now = new Date('2026-10-31T12:00:00+08:00');

  test('puts today first, then upcoming, then recent past', () => {
    const sorted = sortLeaderSessions([
      { eventId: 1, date: '2026-10-01', startTime: '18:00' },
      { eventId: 2, date: '2026-11-02', startTime: '18:00' },
      { eventId: 3, date: '2026-10-31', startTime: '19:00' },
      { eventId: 4, date: '2026-10-30', startTime: '18:00' },
      { eventId: 5, date: '2026-11-01', startTime: '18:00' },
      { eventId: 6, date: '2026-10-31', startTime: '10:00' },
    ], now);

    expect(sorted.map((row) => row.eventId)).toEqual([6, 3, 5, 2, 4, 1]);
  });
});
