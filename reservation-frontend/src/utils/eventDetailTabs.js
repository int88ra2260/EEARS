/**
 * 活動明細分頁鍵與 URL 同步輔助
 */

export const EVENT_DETAIL_TAB_KEYS = Object.freeze({
  reservations: 'reservations',
  grouping: 'grouping',
  checkin: 'checkin',
  taskMarks: 'taskMarks',
  importExport: 'importExport',
  violations: 'violations',
});

/**
 * @param {string|null|undefined} tab
 * @param {{
 *   groupingVisible?: boolean,
 *   taskMarksVisible?: boolean,
 *   checkinVisible?: boolean,
 *   importExportVisible?: boolean,
 *   violationsVisible?: boolean,
 * }} visibility
 */
export function resolveEventDetailTab(tab, visibility = {}) {
  const allowed = new Set([EVENT_DETAIL_TAB_KEYS.reservations]);
  if (visibility.groupingVisible) allowed.add(EVENT_DETAIL_TAB_KEYS.grouping);
  if (visibility.taskMarksVisible) allowed.add(EVENT_DETAIL_TAB_KEYS.taskMarks);
  if (visibility.checkinVisible !== false) allowed.add(EVENT_DETAIL_TAB_KEYS.checkin);
  if (visibility.importExportVisible !== false) allowed.add(EVENT_DETAIL_TAB_KEYS.importExport);
  if (visibility.violationsVisible !== false) allowed.add(EVENT_DETAIL_TAB_KEYS.violations);

  const key = String(tab || '').trim();
  if (allowed.has(key)) return key;
  return EVENT_DETAIL_TAB_KEYS.reservations;
}

/**
 * 寫入／清除 ?tab=（預設 reservations 不帶 query，保持網址乾淨）
 * @param {URLSearchParams} prev
 * @param {string} tab
 */
export function buildEventDetailSearchParams(prev, tab) {
  const next = new URLSearchParams(prev);
  const resolved = tab || EVENT_DETAIL_TAB_KEYS.reservations;
  if (resolved === EVENT_DETAIL_TAB_KEYS.reservations) {
    next.delete('tab');
  } else {
    next.set('tab', resolved);
  }
  return next;
}
