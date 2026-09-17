// utils/adminReportUtils.js
// 活動報表相關工具：學期／活動類型選項與日期對學期判斷。學期邏輯重用 semesterUtils，單一來源。

import { getSemesterByDate } from './semesterUtils';

/**
 * 依日期回傳學期代碼；若不在已知學期範圍則回傳 'other'（與報表篩選「全部學期」等行為一致）。
 * @param {Date|string} date
 * @returns {string}
 */
export function getSemesterInfo(date) {
  const code = getSemesterByDate(date);
  return code ?? 'other';
}

/**
 * 活動報表用學期選項（含「全部學期」、與報表 API 對應的 value）。
 * 與 semesterUtils.SEMESTER_OPTIONS 用途不同，此為報表篩選專用。
 */
export function getSemesterOptions() {
  return [
    { value: 'all', label: '全部學期' },
    { value: '113-2', label: '113-2 (2025/02-2025/07)' },
    { value: '114-1', label: '114-1 (2025/08-2026/01)' },
    { value: '114-2', label: '114-2 (2026/02-2026/07)' },
    { value: '115-1', label: '115-1 (2026/09-2027/01)' },
    { value: '115-2', label: '115-2 (2027/02-2027/07)' }
  ];
}

/**
 * 活動報表用活動類型選項。
 * @param {Array<{ code: string, displayName: string, isActive?: boolean }>} [catalog]
 */
export function getEventTypeOptions(catalog) {
  if (Array.isArray(catalog) && catalog.length) {
    const opts = catalog
      .filter((r) => r && r.isActive !== false)
      .slice()
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
      .map((r) => ({ value: r.code, label: r.displayName || r.code }));
    return [{ value: 'all', label: '全部類型' }, ...opts, { value: '其他', label: '其他' }];
  }
  return [
    { value: 'all', label: '全部類型' },
    { value: 'english_table', label: 'English Table' },
    { value: 'job_talk', label: 'Job Talk' },
    { value: 'english_club', label: 'English Club' },
    { value: 'international_forum', label: 'International Forum' },
    { value: '其他', label: '其他' },
  ];
}
