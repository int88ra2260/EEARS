import dayjs from 'dayjs';

/**
 * 依活動開始時間由新到舊排序；無法解析時間的項目排在最後。
 */
export function getReservationEventStartMs(record) {
  if (!record) return null;
  if (record.eventStartTime) {
    const t = dayjs(record.eventStartTime);
    if (t.isValid()) return t.valueOf();
  }
  if (record.date && record.startTime) {
    const t = dayjs(`${record.date}T${record.startTime}`);
    if (t.isValid()) return t.valueOf();
  }
  if (record.date) {
    const t = dayjs(record.date);
    if (t.isValid()) return t.valueOf();
  }
  return null;
}

export function sortReservationsByEventStartDesc(records = []) {
  return [...records].sort((a, b) => {
    const aMs = getReservationEventStartMs(a);
    const bMs = getReservationEventStartMs(b);
    if (aMs == null && bMs == null) return 0;
    if (aMs == null) return 1;
    if (bMs == null) return -1;
    return bMs - aMs;
  });
}
