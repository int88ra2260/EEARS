'use strict';

const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Taipei';

function getEventStartMs(record) {
  if (!record) return null;
  if (record.eventStartTime) {
    const t = dayjs(record.eventStartTime);
    if (t.isValid()) return t.valueOf();
  }
  if (record.date && record.startTime) {
    const t = dayjs.tz(`${record.date}T${record.startTime}`, TZ);
    if (t.isValid()) return t.valueOf();
  }
  if (record.date) {
    const t = dayjs.tz(record.date, TZ);
    if (t.isValid()) return t.valueOf();
  }
  return null;
}

function sortByEventStartDesc(records = []) {
  return [...records].sort((a, b) => {
    const aMs = getEventStartMs(a);
    const bMs = getEventStartMs(b);
    if (aMs == null && bMs == null) return 0;
    if (aMs == null) return 1;
    if (bMs == null) return -1;
    return bMs - aMs;
  });
}

function deriveAttendanceStatus(record, nowMs = Date.now()) {
  const startMs = getEventStartMs(record);
  if (startMs != null && startMs > nowMs) return 'upcoming';
  if (record.checkinStatus === '已簽到') return 'attended';
  if (record.checkinStatus === '已登記違規') return 'no_show';
  if (startMs != null && startMs <= nowMs) return 'pending';
  return 'unknown';
}

function buildActivitySection(records = [], now = new Date()) {
  const nowMs = now.getTime();
  const sorted = sortByEventStartDesc(records);

  let attended = 0;
  let noShow = 0;
  let upcoming = 0;

  const normalized = sorted.map((record) => {
    const eventStartTime = (() => {
      const ms = getEventStartMs(record);
      return ms != null ? new Date(ms).toISOString() : null;
    })();
    const attendanceStatus = deriveAttendanceStatus(record, nowMs);

    if (attendanceStatus === 'attended') attended += 1;
    else if (attendanceStatus === 'no_show') noShow += 1;
    else if (attendanceStatus === 'upcoming') upcoming += 1;

    return {
      id: record.id,
      reservationId: record.reservationId || record.id,
      eventId: record.eventId,
      eventName: record.eventName,
      date: record.date,
      startTime: record.startTime,
      endTime: record.endTime,
      location: record.location,
      eventType: record.eventType,
      eventStartTime,
      checkinStatus: record.checkinStatus,
      attendanceStatus,
    };
  });

  const past = normalized
    .filter((r) => r.attendanceStatus !== 'upcoming')
    .sort((a, b) => getEventStartMs(b) - getEventStartMs(a));

  const future = normalized
    .filter((r) => r.attendanceStatus === 'upcoming')
    .sort((a, b) => getEventStartMs(a) - getEventStartMs(b));

  return {
    summary: {
      total: normalized.length,
      attended,
      noShow,
      upcoming,
    },
    nextUpcoming: future[0] || null,
    recent: past.slice(0, 3),
  };
}

module.exports = {
  TZ,
  getEventStartMs,
  sortByEventStartDesc,
  deriveAttendanceStatus,
  buildActivitySection,
};
