function localYmd(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getEventRowStatusBadges(evt, isToday) {
  const badges = [];
  const eventDay = String(evt?.date || '').slice(0, 10);
  const today = localYmd();
  if (isToday) {
    badges.push({ label: '今日場次', className: 'bg-success' });
  } else if (eventDay && eventDay < today) {
    badges.push({ label: '已結束', className: 'bg-secondary' });
  } else if (eventDay && eventDay > today) {
    badges.push({ label: '尚未開始', className: 'bg-info' });
  }
  const spots = Number(evt?.availableSpots);
  if (Number.isFinite(spots) && spots <= 0) {
    badges.push({ label: '額滿', className: 'bg-warning text-dark' });
  }
  return badges;
}

export function eventDetailPath(eventId, tab) {
  const query = tab ? `?tab=${encodeURIComponent(tab)}` : '';
  return `/admin/operations/${eventId}${query}`;
}
