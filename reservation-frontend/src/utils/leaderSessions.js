export function taipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function sessionDateKey(value) {
  return String(value || '').slice(0, 10);
}

export function sortLeaderSessions(sessions, todayKey = taipeiDateKey()) {
  const list = Array.isArray(sessions) ? [...sessions] : [];
  const bucket = (item) => {
    const key = sessionDateKey(item?.date);
    if (key === todayKey) return 0;
    if (key > todayKey) return 1;
    return 2;
  };
  list.sort((a, b) => {
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    const dateA = sessionDateKey(a?.date);
    const dateB = sessionDateKey(b?.date);
    if (dateA !== dateB) {
      return ba === 2 ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
    }
    const timeA = String(a?.startTime || '');
    const timeB = String(b?.startTime || '');
    if (timeA !== timeB) {
      return ba === 2 ? timeB.localeCompare(timeA) : timeA.localeCompare(timeB);
    }
    return Number(a?.eventId || 0) - Number(b?.eventId || 0);
  });
  return list;
}

export function leaderSessionBadge(row, sessions, todayKey = taipeiDateKey()) {
  const key = sessionDateKey(row?.date);
  if (key === todayKey) return '今天';
  const firstUpcoming = (sessions || []).find((item) => sessionDateKey(item?.date) > todayKey);
  if (firstUpcoming && firstUpcoming.eventId === row?.eventId) return '下一場';
  return '';
}

export function shiftYearMonth(value, delta) {
  const [yearText, monthText] = String(value || '').split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return value;
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatYearMonth(value) {
  const [yearText, monthText] = String(value || '').split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return value || '';
  return `${year}年${month}月`;
}
