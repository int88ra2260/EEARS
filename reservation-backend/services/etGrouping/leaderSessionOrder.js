'use strict';

const { dateKey } = require('./etPracticeBrief');

function sessionDateKey(value) {
  return dateKey(value);
}

/**
 * 今天的場次在最前，其次是之後的場次（由近到遠），再來是過去場次（由近到遠）。
 * @param {Array<{ date?: string, startTime?: string, eventId?: number }>} sessions
 * @param {Date} [now]
 */
function sortLeaderSessions(sessions, now = new Date()) {
  const today = dateKey(now);
  const list = Array.isArray(sessions) ? [...sessions] : [];
  const bucket = (item) => {
    const key = dateKey(item?.date);
    if (key === today) return 0;
    if (key > today) return 1;
    return 2;
  };
  list.sort((a, b) => {
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    const dateA = dateKey(a?.date);
    const dateB = dateKey(b?.date);
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

module.exports = {
  sessionDateKey,
  sortLeaderSessions,
};
