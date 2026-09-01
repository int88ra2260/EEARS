import { getReservationEventStartMs, sortReservationsByEventStartDesc } from './reservationRecordsSort';

describe('reservationRecordsSort', () => {
  it('sorts by event start time descending', () => {
    const input = [
      { id: 1, date: '2026-03-01', startTime: '10:00' },
      { id: 2, date: '2026-05-10', startTime: '14:00' },
      { id: 3, eventStartTime: '2026-04-15T12:30:00+08:00' },
    ];
    const sorted = sortReservationsByEventStartDesc(input);
    expect(sorted.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it('puts records without parseable time last', () => {
    const input = [
      { id: 'x' },
      { id: 1, date: '2026-01-01', startTime: '09:00' },
    ];
    const sorted = sortReservationsByEventStartDesc(input);
    expect(sorted.map((r) => r.id)).toEqual([1, 'x']);
  });

  it('prefers eventStartTime when present', () => {
    const ms = getReservationEventStartMs({
      date: '2026-01-01',
      startTime: '09:00',
      eventStartTime: '2026-06-01T18:00:00+08:00',
    });
    expect(ms).toBe(new Date('2026-06-01T18:00:00+08:00').getTime());
  });
});
