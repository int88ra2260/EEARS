/**
 * 依活動日期對應學期代碼（與 shared/semesterConfig 區間一致）。
 * @param {string|Date} date
 * @returns {string} 如 114-1、113-2；不在設定區間時為 other
 */
'use strict';

const { getSemesterByConfiguredRange } = require('./semesterConstants');

function getSemesterInfo(date) {
  return getSemesterByConfiguredRange(date) || 'other';
}

module.exports = { getSemesterInfo };
