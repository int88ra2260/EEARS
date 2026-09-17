import {
  buildEventDetailSearchParams,
  EVENT_DETAIL_TAB_KEYS,
  resolveEventDetailTab,
} from './eventDetailTabs';

describe('resolveEventDetailTab', () => {
  it('defaults to reservations', () => {
    expect(resolveEventDetailTab(null)).toBe(EVENT_DETAIL_TAB_KEYS.reservations);
    expect(resolveEventDetailTab('')).toBe(EVENT_DETAIL_TAB_KEYS.reservations);
    expect(resolveEventDetailTab('nope')).toBe(EVENT_DETAIL_TAB_KEYS.reservations);
  });

  it('allows core tabs when visible', () => {
    expect(resolveEventDetailTab('checkin')).toBe('checkin');
    expect(resolveEventDetailTab('importExport')).toBe('importExport');
    expect(resolveEventDetailTab('violations')).toBe('violations');
  });

  it('gates checkin/importExport/violations by visibility', () => {
    const hidden = {
      checkinVisible: false,
      importExportVisible: false,
      violationsVisible: false,
    };
    expect(resolveEventDetailTab('checkin', hidden)).toBe('reservations');
    expect(resolveEventDetailTab('importExport', hidden)).toBe('reservations');
    expect(resolveEventDetailTab('violations', hidden)).toBe('reservations');
  });

  it('gates ET tabs by visibility', () => {
    expect(resolveEventDetailTab('grouping', { groupingVisible: true })).toBe('grouping');
    expect(resolveEventDetailTab('grouping', { groupingVisible: false })).toBe('reservations');
    expect(resolveEventDetailTab('taskMarks', { taskMarksVisible: true })).toBe('taskMarks');
    expect(resolveEventDetailTab('taskMarks', { taskMarksVisible: false })).toBe('reservations');
  });
});

describe('buildEventDetailSearchParams', () => {
  it('omits tab for reservations', () => {
    const prev = new URLSearchParams('tab=checkin&x=1');
    const next = buildEventDetailSearchParams(prev, 'reservations');
    expect(next.get('tab')).toBeNull();
    expect(next.get('x')).toBe('1');
  });

  it('sets tab for other keys', () => {
    const next = buildEventDetailSearchParams(new URLSearchParams(), 'checkin');
    expect(next.get('tab')).toBe('checkin');
  });
});
