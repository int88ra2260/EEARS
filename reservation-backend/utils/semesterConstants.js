/**
 * 學期日期範圍（與 adminClassesController 一致，供 analytics / evaluation 共用）
 */
const SEMESTER_RANGES = {
  '114-1': { start: '2025-08-01', end: '2026-01-31' },
  '113-2': { start: '2025-02-01', end: '2025-07-31' },
  '114-2': { start: '2026-02-01', end: '2026-07-31' },
  '115-1': { start: '2026-09-01', end: '2027-01-31' },
  '115-2': { start: '2027-02-01', end: '2027-07-31' }
};

/** 顯示／排序用（由早到晚） */
const SEMESTER_ORDER = ['113-2', '114-1', '114-2', '115-1', '115-2'];

/**
 * 依民國學制月曆由日期推算學期（例：2022-07-31 → 110-2）。
 * 規則：8–12 月為當年 ROC 第 1 學期；1 月為前一年 ROC 第 1 學期；2–7 月為前一年 ROC 第 2 學期。
 * @param {string|Date} date
 * @returns {string|null}
 */
function deriveSemesterIdFromDate(date) {
  if (!date) return null;
  const raw = typeof date === 'string' ? String(date).trim().slice(0, 10) : null;
  let year;
  let month;
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    year = Number(raw.slice(0, 4));
    month = Number(raw.slice(5, 7));
  } else {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(dateObj.getTime())) return null;
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
 * @param {string} dateStr YYYY-MM-DD
 * @returns {string|null}
 */
function semesterIdFromDate(dateStr) {
  const d = String(dateStr || '').slice(0, 10);
  if (!d) return null;
  for (const [sem, range] of Object.entries(SEMESTER_RANGES)) {
    if (d >= range.start && d <= range.end) return sem;
  }
  return deriveSemesterIdFromDate(d);
}

function compareSemester(a, b) {
  const ia = SEMESTER_ORDER.indexOf(a);
  const ib = SEMESTER_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

module.exports = {
  SEMESTER_RANGES,
  SEMESTER_ORDER,
  compareSemester,
  deriveSemesterIdFromDate,
  semesterIdFromDate,
};
