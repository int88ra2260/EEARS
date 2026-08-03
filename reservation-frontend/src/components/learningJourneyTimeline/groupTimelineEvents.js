function compareByDate(a, b) {
  const d = String(a.eventDate || '').localeCompare(String(b.eventDate || ''));
  if (d !== 0) return d;
  return String(a.eventId || '').localeCompare(String(b.eventId || ''));
}

export function buildTimelineGroupKey(event, lane) {
  if (lane === 'baseline') return 'baseline';
  if (lane === 'exam') {
    return String(event.instrument || event.title || 'exam').trim().toUpperCase();
  }
  return String(event.title || lane).trim() || lane;
}

export function buildTimelineGroupLabel(events, lane) {
  if (!events.length) return '事件';
  const first = events[0];
  if (lane === 'baseline') return first.title || '入學基準';
  if (lane === 'exam') return first.instrument || first.title || '英檢';
  return first.title || '事件';
}

/**
 * 依泳道將同類型事件分組（活動依標題、英檢依工具）。
 * @param {object[]} events
 * @param {string} lane
 */
export function groupTimelineEvents(events, lane) {
  const order = [];
  const map = new Map();

  for (const ev of events || []) {
    const key = buildTimelineGroupKey(ev, lane);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key).push(ev);
  }

  return order.map((key) => {
    const items = [...map.get(key)].sort(compareByDate);
    return {
      key,
      label: buildTimelineGroupLabel(items, lane),
      events: items,
    };
  });
}

export function summarizeTimelineGroup(events) {
  const dates = events.map((e) => e.eventDate).filter(Boolean).sort();
  const totalHours = events.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
  let dateRange = '—';
  if (dates.length === 1) dateRange = dates[0];
  else if (dates.length > 1) dateRange = `${dates[0]}～${dates[dates.length - 1]}`;

  return { dateRange, totalHours, count: events.length };
}
