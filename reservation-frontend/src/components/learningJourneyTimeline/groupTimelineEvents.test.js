import { groupTimelineEvents, summarizeTimelineGroup } from './groupTimelineEvents';

describe('groupTimelineEvents', () => {
  it('groups activities by title', () => {
    const events = [
      { eventId: '1', title: 'English Table', eventDate: '2026-01-01', hours: 0.5 },
      { eventId: '2', title: 'English Table', eventDate: '2026-02-01', hours: 0.5 },
      { eventId: '3', title: 'English Club', eventDate: '2026-03-01', hours: 1 },
    ];
    const groups = groupTimelineEvents(events, 'activity');
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('English Table');
    expect(groups[0].events).toHaveLength(2);
  });

  it('groups exams by instrument', () => {
    const events = [
      { eventId: '1', instrument: 'BESTEP', skill: 'listening', eventDate: '2025-10-01' },
      { eventId: '2', instrument: 'BESTEP', skill: 'reading', eventDate: '2025-10-01' },
      { eventId: '3', instrument: 'TOEIC', skill: 'listening', eventDate: '2025-11-01' },
    ];
    const groups = groupTimelineEvents(events, 'exam');
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.key === 'BESTEP').events).toHaveLength(2);
  });

  it('summarizes date range and hours', () => {
    const summary = summarizeTimelineGroup([
      { eventDate: '2026-01-01', hours: 0.5 },
      { eventDate: '2026-03-01', hours: 0.5 },
    ]);
    expect(summary.count).toBe(2);
    expect(summary.totalHours).toBe(1);
    expect(summary.dateRange).toBe('2026-01-01～2026-03-01');
  });
});
