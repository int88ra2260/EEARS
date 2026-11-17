import dayjs from 'dayjs';
import { SEMESTER_ORDER } from '../config/semesterConfig';
import { getCurrentSemester, getSemesterByDate } from './semesterUtils';
import { getReservationEventStartMs, sortReservationsByEventStartDesc } from './reservationRecordsSort';

export function reservationSemesterId(record) {
  return getSemesterByDate(record?.date) || 'other';
}

/**
 * 活動結束時間。沒有 endTime 時用該日結束，避免同一天的場次在活動開始就被當成已結束。
 */
export function getReservationEventEnd(record) {
  const date = String(record?.date || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const endTime = String(record?.endTime || '').trim();
  if (endTime) {
    const timed = dayjs(`${date}T${endTime}`);
    if (timed.isValid()) return timed;
  }
  const endOfDay = dayjs(date).endOf('day');
  return endOfDay.isValid() ? endOfDay : null;
}

export function isReservationEventEnded(record, now = dayjs()) {
  const end = getReservationEventEnd(record);
  if (!end) return false;
  return now.isAfter(end);
}

/** upcoming | in_progress | ended | unknown */
export function reservationTiming(record, now = dayjs()) {
  if (isReservationEventEnded(record, now)) return 'ended';
  const startMs = getReservationEventStartMs(record);
  if (startMs == null) return 'unknown';
  if (now.valueOf() >= startMs) return 'in_progress';
  return 'upcoming';
}

function compareSemesterDesc(a, b, current) {
  if (a === current && b !== current) return -1;
  if (b === current && a !== current) return 1;
  const ai = SEMESTER_ORDER.indexOf(a);
  const bi = SEMESTER_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return String(b).localeCompare(String(a), 'en');
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return bi - ai;
}

/**
 * 依活動日期分學期。本學期即使沒有預約也會留一欄，避免一打開就落到舊學期。
 */
export function buildReservationSemesterViews(records, now = dayjs()) {
  const current = getCurrentSemester();
  const buckets = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    const id = reservationSemesterId(record);
    if (!buckets.has(id)) buckets.set(id, []);
    buckets.get(id).push(record);
  });
  if (current && !buckets.has(current)) buckets.set(current, []);

  return [...buckets.keys()]
    .sort((a, b) => compareSemesterDesc(a, b, current))
    .map((id) => {
      const sorted = sortReservationsByEventStartDesc(buckets.get(id) || []);
      const upcoming = [];
      const ended = [];
      sorted.forEach((record) => {
        if (isReservationEventEnded(record, now)) ended.push(record);
        else upcoming.push(record);
      });
      upcoming.sort((a, b) => {
        const aMs = getReservationEventStartMs(a);
        const bMs = getReservationEventStartMs(b);
        if (aMs == null || bMs == null) return 0;
        return aMs - bMs;
      });
      return {
        id,
        label: id === 'other' ? '其他' : id,
        isCurrent: Boolean(current) && id === current,
        records: sorted,
        upcoming,
        ended,
      };
    });
}
