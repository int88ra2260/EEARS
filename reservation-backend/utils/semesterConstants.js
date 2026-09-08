/**
 * 學期日期範圍與推算（analytics / evaluation / 英檢 / 問卷共用）。
 * 區間唯一來源：repo root shared/semesterConfig.js
 */
'use strict';

const {
  SEMESTER_RANGES: SHARED_RANGES,
  SEMESTER_ORDER: SHARED_ORDER,
} = require('../../shared/semesterConfig');

const SEMESTER_RANGES = SHARED_RANGES;
const SEMESTER_ORDER = SHARED_ORDER;

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
 * 依民國學制月曆由日期推算學期（例：2022-07-31 → 110-2）。
 * 規則：8–12 月為當年 ROC 第 1 學期；1 月為前一年 ROC 第 1 學期；2–7 月為前一年 ROC 第 2 學期。
 * @param {string|Date} date
 * @returns {string|null}
 */
function deriveSemesterIdFromDate(date) {
  if (!date) return null;
  const day = toTaipeiDateOnly(date);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  if (month >= 8) return `${year - 1911}-1`;
  if (month === 1) return `${year - 1912}-1`;
  return `${year - 1912}-2`;
}

/**
 * 先查 SEMESTER_RANGES，否則用學制月曆推算。
 * @param {string|Date|number} date
 * @returns {string|null}
 */
function semesterIdFromDate(date) {
  const d = toTaipeiDateOnly(date);
  if (!d) return null;
  for (const [sem, range] of Object.entries(SEMESTER_RANGES)) {
    if (d >= range.start && d <= range.end) return sem;
  }
  return deriveSemesterIdFromDate(d);
}

/**
 * 僅落在 SEMESTER_RANGES 內才回傳；空窗期為 null（不 fallback）。
 * @param {string|Date|number} date
 * @returns {string|null}
 */
function getSemesterByConfiguredRange(date) {
  const d = toTaipeiDateOnly(date);
  if (!d) return null;
  for (const [sem, range] of Object.entries(SEMESTER_RANGES)) {
    if (d >= range.start && d <= range.end) return sem;
  }
  return null;
}

/**
 * 目前學期：優先 SEMESTER_RANGES，否則學制月曆推算。
 * @param {Date|string|number} [atDate]
 * @returns {string}
 */
function getCurrentSemester(atDate = new Date()) {
  return semesterIdFromDate(atDate) || deriveSemesterIdFromDate(atDate) || '';
}

function compareSemester(a, b) {
  const ia = SEMESTER_ORDER.indexOf(a);
  const ib = SEMESTER_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

function isValidSemester(str) {
  return /^\d{3}-[12]$/.test(String(str || ''));
}

module.exports = {
  SEMESTER_RANGES,
  SEMESTER_ORDER,
  compareSemester,
  deriveSemesterIdFromDate,
  semesterIdFromDate,
  getSemesterByConfiguredRange,
  getCurrentSemester,
  isValidSemester,
  toTaipeiDateOnly,
};
