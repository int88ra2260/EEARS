/**
 * EEARS 學期設定（前後端唯一來源）。
 *
 * 修改區間時只改這個檔，然後執行：
 *   node scripts/sync-semester-config.js
 *
 * 規則（與成大學制一致）：
 * - 第 1 學期（-1）：約 8 月～隔年 1 月
 * - 第 2 學期（-2）：約 2 月～7 月
 */
'use strict';

const SEMESTER_RANGES = Object.freeze({
  '113-2': Object.freeze({ start: '2025-02-01', end: '2025-07-31' }),
  '114-1': Object.freeze({ start: '2025-08-01', end: '2026-01-31' }),
  '114-2': Object.freeze({ start: '2026-02-01', end: '2026-07-31' }),
  '115-1': Object.freeze({ start: '2026-08-01', end: '2027-01-31' }),
  '115-2': Object.freeze({ start: '2027-02-01', end: '2027-07-31' }),
});

/** 顯示／排序用（由早到晚） */
const SEMESTER_ORDER = Object.freeze(['113-2', '114-1', '114-2', '115-1', '115-2']);

module.exports = {
  SEMESTER_RANGES,
  SEMESTER_ORDER,
};
