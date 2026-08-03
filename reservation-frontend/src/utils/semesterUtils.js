// utils/semesterUtils.js
// 學期相關工具函數

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
 * @param {Date|string} date - 日期物件或日期字串
 * @returns {string|null} 學期代碼（如 '114-1'），如果不在任何學期範圍內則返回 null
 */
export function getSemesterByDate(date) {
  return semesterIdFromDate(date);
}

/**
 * 取得當前學期
 * @returns {string|null} 當前學期代碼
 */
export function getCurrentSemester() {
  return getSemesterByDate(new Date());
}

/**
 * 學期選項列表
 */
export const SEMESTER_OPTIONS = [
  { value: '', label: '全部學期' },
  { value: '114-1', label: '114-1學期' },
  { value: '113-2', label: '113-2學期' },
  { value: '114-2', label: '114-2學期' },
  { value: '115-1', label: '115-1學期' },
  { value: '115-2', label: '115-2學期' }
];

/**
 * 學期日期範圍配置
 */
export const SEMESTER_RANGES = {
  '113-2': { start: '2025-02-01', end: '2025-07-31' },
  '114-1': { start: '2025-08-01', end: '2026-01-31' },
  '114-2': { start: '2026-02-01', end: '2026-07-31' },
  '115-1': { start: '2026-09-01', end: '2027-01-31' },
  '115-2': { start: '2027-02-01', end: '2027-07-31' }
};
