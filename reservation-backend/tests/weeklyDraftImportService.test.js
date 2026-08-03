const {
  pickEventIdsInRange,
  injectEventIds,
} = require('../services/weeklyDraftImportService');

describe('weeklyDraftImportService', () => {
  const events = [
    { id: 3, date: '2026-07-01', startTime: '18:00', name: 'ET Wed' },
    { id: 1, date: '2026-06-29', startTime: '12:00', name: 'EC Mon' },
    { id: 2, date: '2026-06-30', startTime: '14:00', name: 'ET Tue' },
    { id: 9, date: '2026-07-10', startTime: '10:00', name: 'Out of range' },
  ];

  test('pickEventIdsInRange sorts by date and caps at limit', () => {
    const ids = pickEventIdsInRange(events, '2026-06-29', '2026-07-05', 6);
    expect(ids).toEqual([1, 2, 3]);
  });

  test('pickEventIdsInRange respects limit', () => {
    const ids = pickEventIdsInRange(events, '2026-06-29', '2026-07-05', 2);
    expect(ids).toEqual([1, 2]);
  });

  test('injectEventIds fills empty eventsHighlight only', () => {
    const blocks = [
      { id: 'a', type: 'hero', props: {} },
      { id: 'b', type: 'eventsHighlight', props: { title: 'X', eventIds: [] } },
      { id: 'c', type: 'eventsHighlight', props: { title: 'Y', eventIds: [99] } },
    ];
    const next = injectEventIds(blocks, [1, 2]);
    expect(next[1].props.eventIds).toEqual([1, 2]);
    expect(next[2].props.eventIds).toEqual([99]);
  });
});
