'use strict';

const { getCurrentSemester } = require('./semester');

/** 培力英檢報名學期日期區間（含報名／考試批次對應學期） */
const SEMESTER_RANGES = Object.freeze({
  '113-2': { start: '2025-02-01', end: '2025-07-31' },
  '114-1': { start: '2025-08-01', end: '2026-01-31' },
  '114-2': { start: '2026-02-01', end: '2026-07-31' },
  '115-1': { start: '2026-08-01', end: '2027-01-31' },
  '115-2': { start: '2027-02-01', end: '2027-07-31' },
});

/**
 * 轉成 Asia/Taipei 的 YYYY-MM-DD，避免 `new Date('YYYY-MM-DD')` UTC 午夜造成邊界誤判。
 * @param {Date|string|number} date
 * @returns {string|null}
 */
function toTaipeiDateOnly(date) {
  if (date == null || date === '') return null;

  if (typeof date === 'string') {
    const trimmed = date.trim();
    const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }

  const dateObj = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dateObj.getTime())) return null;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);
}

/**
 * 依日期落在區間判斷學期；不在任何區間則回傳 null。
 * @param {Date|string|number} date
 * @returns {string|null}
 */
function getSemesterByDate(date) {
  const day = toTaipeiDateOnly(date);
  if (!day) return null;

  for (const [semester, range] of Object.entries(SEMESTER_RANGES)) {
    if (day >= range.start && day <= range.end) {
      return semester;
    }
  }

  return null;
}

/**
 * 公開報名／查詢使用的「目前有效學期」。
 * 優先依 SEMESTER_RANGES；空窗期 fallback 至 getCurrentSemester()。
 * @param {Date} [atDate]
 * @returns {string}
 */
function getActiveRegistrationSemester(atDate = new Date()) {
  return getSemesterByDate(atDate) || getCurrentSemester();
}

module.exports = {
  SEMESTER_RANGES,
  toTaipeiDateOnly,
  getSemesterByDate,
  getActiveRegistrationSemester,
};
