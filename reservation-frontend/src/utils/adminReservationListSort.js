/**
 * 活動預約名單排序。組別為「Group N」或「Group N-overflow」。
 */

function groupSortKey(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return { missing: true, n: Number.POSITIVE_INFINITY, overflow: 1, text: '' };
  }
  const match = text.match(/(\d+)/);
  return {
    missing: false,
    n: match ? Number(match[1]) : Number.POSITIVE_INFINITY,
    overflow: /overflow/i.test(text) ? 1 : 0,
    text: text.toLowerCase(),
  };
}

/**
 * 依組號排序；沒有組別的列固定排在最後。
 * @returns {number}
 */
export function compareGroupLabels(a, b, order = 'asc') {
  const dir = order === 'desc' ? -1 : 1;
  const ka = groupSortKey(a);
  const kb = groupSortKey(b);
  if (ka.missing && kb.missing) return 0;
  if (ka.missing) return 1;
  if (kb.missing) return -1;
  if (ka.n !== kb.n) return (ka.n - kb.n) * dir;
  if (ka.overflow !== kb.overflow) return (ka.overflow - kb.overflow) * dir;
  return ka.text.localeCompare(kb.text, 'en') * dir;
}

export function compareAdminReservationRows(a, b, field, order = 'asc') {
  if (field === 'group') {
    return compareGroupLabels(a?.group, b?.group, order);
  }

  let aVal;
  let bVal;
  if (field === 'studentId') {
    aVal = a?.studentId;
    bVal = b?.studentId;
  } else if (field === 'name') {
    aVal = a?.studentName || a?.name;
    bVal = b?.studentName || b?.name;
  } else {
    aVal = a?.[field];
    bVal = b?.[field];
  }

  if (field === 'checkinStatus') {
    const statusOrder = { 已簽到: 1, 未簽到: 2, 已登記違規: 3 };
    aVal = statusOrder[aVal] || 4;
    bVal = statusOrder[bVal] || 4;
  }

  if (typeof aVal === 'string') aVal = aVal.toLowerCase();
  if (typeof bVal === 'string') bVal = bVal.toLowerCase();

  const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  return order === 'desc' ? -cmp : cmp;
}

export function sortAdminReservations(rows = [], field, order = 'asc') {
  return [...rows].sort((a, b) => compareAdminReservationRows(a, b, field, order));
}
