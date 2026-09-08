// utils/semesterUtils.js
// 學期相關工具函數（區間來自 shared/semesterConfig，經 sync 產生）

import { SEMESTER_RANGES, SEMESTER_ORDER } from '../config/semesterConfig';

export { SEMESTER_RANGES, SEMESTER_ORDER };

/**
 * 依民國學制月曆由日期推算學期（例：2022-07-31 → 110-2）。
 * @param {Date|string} date
 * @returns {string|null}
 */
export function deriveSemesterIdFromDate(date) {
  if (!date) return null;
  const raw = typeof date === 'string' ? String(date).trim().slice(0, 10) : null;
  let year;
  let month;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    year = Number(raw.slice(0, 4));
    month = Number(raw.slice(5, 7));
  } else {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return null;
    year = dateObj.getFullYear();
    month = dateObj.getMonth() + 1;
  }
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  if (month >= 8) return `${year - 1911}-1`;
  if (month === 1) return `${year - 1912}-1`;
  return `${year - 1912}-2`;
}

/**
 * 先查 SEMESTER_RANGES，否則用學制月曆推算。
 * @param {Date|string} date
 * @returns {string|null}
 */
export function semesterIdFromDate(date) {
  if (!date) return null;
  const raw = typeof date === 'string' ? String(date).trim().slice(0, 10) : null;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    for (const [sem, range] of Object.entries(SEMESTER_RANGES)) {
      if (raw >= range.start && raw <= range.end) return sem;
    }
    return deriveSemesterIdFromDate(raw);
  }
  return deriveSemesterIdFromDate(date);
}

/**
 * 根據日期判斷學期
 * @param {Date|string} date
 * @returns {string|null}
 */
export function getSemesterByDate(date) {
  return semesterIdFromDate(date);
}

/**
 * 取得當前學期
 * @returns {string|null}
 */
export function getCurrentSemester() {
  return getSemesterByDate(new Date());
}

export function isValidSemester(str) {
  return /^\d{3}-[12]$/.test(String(str || ''));
}

/**
 * 學期選項列表（含「全部」；順序與 SEMESTER_ORDER 一致）
 */
export const SEMESTER_OPTIONS = [
  { value: '', label: '全部學期' },
  ...SEMESTER_ORDER.map((value) => ({
    value,
    label: `${value}學期`,
  })),
];
