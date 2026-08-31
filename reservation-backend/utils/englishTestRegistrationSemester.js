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
 * 依日期落在區間判斷學期；不在任何區間則回傳 null。
 * @param {Date|string|number} date
 * @returns {string|null}
 */
function getSemesterByDate(date) {
  if (!date) return null;

  const dateObj = new Date(date);
  if (Number.isNaN(dateObj.getTime())) return null;

  for (const [semester, range] of Object.entries(SEMESTER_RANGES)) {
    const startDate = new Date(range.start);
    const endDate = new Date(range.end);
    if (dateObj >= startDate && dateObj <= endDate) {
      return semester;
    }
  }

  return null;
}

/**
 * 公開報名／查詢使用的「目前有效學期」。
 * 優先依 SEMESTER_RANGES；空窗期（如 8 月）fallback 至 getCurrentSemester()。
 * @param {Date} [atDate]
 * @returns {string}
 */
function getActiveRegistrationSemester(atDate = new Date()) {
  return getSemesterByDate(atDate) || getCurrentSemester();
}

module.exports = {
  SEMESTER_RANGES,
  getSemesterByDate,
  getActiveRegistrationSemester,
};
