'use strict';

const {
  SEMESTER_RANGES,
  getSemesterByConfiguredRange,
  getCurrentSemester,
  toTaipeiDateOnly,
} = require('./semesterConstants');

/**
 * 依日期落在設定區間判斷學期；不在任何區間則回傳 null。
 * @param {Date|string|number} date
 * @returns {string|null}
 */
function getSemesterByDate(date) {
  return getSemesterByConfiguredRange(date);
}

/**
 * 公開報名／查詢使用的「目前有效學期」。
 * 優先依 SEMESTER_RANGES；空窗期 fallback 至學制月曆推算。
 * @param {Date} [atDate]
 * @returns {string}
 */
function getActiveRegistrationSemester(atDate = new Date()) {
  return getSemesterByDate(atDate) || getCurrentSemester(atDate);
}

module.exports = {
  SEMESTER_RANGES,
  toTaipeiDateOnly,
  getSemesterByDate,
  getActiveRegistrationSemester,
};
