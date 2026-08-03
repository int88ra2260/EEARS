const { toYmd, filterEventsByDateQuery } = require('../utils/eventDateFilter');

describe('eventDateFilter', () => {
  test('toYmd normalizes string / slash / Date', () => {
    expect(toYmd('2026-03-09')).toBe('2026-03-09');
    expect(toYmd('2026/3/9')).toBe('2026-03-09');
    expect(toYmd(new Date(2026, 2, 9))).toBe('2026-03-09');
  });

  test('range filter excludes dates outside near-7-days window', () => {
    const events = [
      { id: 1, date: '2026-03-09' },
      { id: 2, date: '2026-07-18' },
      { id: 3, date: '2026-07-20' },
      { id: 4, date: '2026-07-24' },
      { id: 5, date: '2026-07-25' },
    ];

    const filtered = filterEventsByDateQuery(events, {
      dateFrom: '2026-07-18',
      dateTo: '2026-07-24',
    });

    expect(filtered.map((e) => e.id)).toEqual([2, 3, 4]);
  });

  test('range filter works when event.date is Date object', () => {
    const events = [
      { id: 1, date: new Date(2026, 2, 9) },
      { id: 2, date: new Date(2026, 6, 20) },
    ];

    const filtered = filterEventsByDateQuery(events, {
      dateFrom: '2026-07-18',
      dateTo: '2026-07-24',
    });

    expect(filtered.map((e) => e.id)).toEqual([2]);
  });

  test('single date filter', () => {
    const events = [
      { id: 1, date: '2026-07-24' },
      { id: 2, date: '2026-07-23' },
    ];
    expect(filterEventsByDateQuery(events, { date: '2026-07-24' }).map((e) => e.id)).toEqual([1]);
  });
});
