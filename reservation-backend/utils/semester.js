/**
 * 學期代碼（ROC 民國年 + 上下學期）。
 * 與 shared/semesterConfig.js / semesterConstants.js 同一套區間與推算。
 */
'use strict';

const {
  getCurrentSemester,
  isValidSemester,
  semesterIdFromDate,
} = require('./semesterConstants');

module.exports = {
  getCurrentSemester,
  isValidSemester,
  semesterIdFromDate,
};
