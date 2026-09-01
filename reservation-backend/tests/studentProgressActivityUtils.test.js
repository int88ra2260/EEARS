const {
  buildActivitySection,
  sortByEventStartDesc,
} = require('../services/studentProgress/studentProgressActivityUtils');

describe('studentProgressActivityUtils', () => {
  const now = new Date('2026-05-01T12:00:00+08:00');

  it('sorts reservations by event start descending', () => {
    const sorted = sortByEventStartDesc([
      { date: '2026-03-01', startTime: '10:00' },
      { date: '2026-06-01', startTime: '14:00' },
    ]);
    expect(sorted[0].date).toBe('2026-06-01');
  });

  it('builds summary, recent 3 past, and next upcoming', () => {
    const records = [
      { id: 1, date: '2026-04-20', startTime: '10:00', checkinStatus: '已簽到', eventName: 'ET A' },
      { id: 2, date: '2026-04-10', startTime: '10:00', checkinStatus: '已登記違規', eventName: 'EC B' },
      { id: 3, date: '2026-03-01', startTime: '10:00', checkinStatus: '未簽到', eventName: 'IF C' },
      { id: 4, date: '2026-02-01', startTime: '10:00', checkinStatus: '已簽到', eventName: 'JT D' },
      { id: 5, date: '2026-05-15', startTime: '14:00', checkinStatus: '未簽到', eventName: 'ET Next' },
    ];

    const section = buildActivitySection(records, now);

    expect(section.summary.total).toBe(5);
    expect(section.summary.attended).toBe(2);
    expect(section.summary.noShow).toBe(1);
    expect(section.summary.upcoming).toBe(1);
    expect(section.recent.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(section.nextUpcoming?.id).toBe(5);
  });
});
