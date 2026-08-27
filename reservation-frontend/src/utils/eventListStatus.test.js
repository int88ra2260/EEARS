import { eventDetailPath, getEventRowStatusBadges } from './eventListStatus';

describe('getEventRowStatusBadges', () => {
  it('marks today events', () => {
    const badges = getEventRowStatusBadges({ date: '2099-01-01', availableSpots: 3 }, true);
    expect(badges.map((b) => b.label)).toContain('今日場次');
  });

  it('marks full events', () => {
    const badges = getEventRowStatusBadges({ date: '2099-01-01', availableSpots: 0 }, false);
    expect(badges.map((b) => b.label)).toContain('額滿');
  });
});

describe('eventDetailPath', () => {
  it('adds tab query when provided', () => {
    expect(eventDetailPath(12, 'checkin')).toBe('/admin/operations/12?tab=checkin');
  });
});
