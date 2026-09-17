/**
 * 培力英檢「匯出順序微調」：移動 orderedIds 中的單一 id。
 * @param {number[]} ids
 * @param {number|string} id
 * @param {'up'|'down'|'top'|'bottom'|'to'} action
 * @param {number} [targetOneBased] - action==='to' 時的 1-based 目標序號
 * @returns {number[]}
 */
export function moveIdInExportOrder(ids, id, action, targetOneBased) {
  const next = Array.isArray(ids) ? ids.map(Number) : [];
  const from = next.indexOf(Number(id));
  if (from < 0 || next.length === 0) return ids || [];

  let to = from;
  if (action === 'up') {
    to = Math.max(0, from - 1);
  } else if (action === 'down') {
    to = Math.min(next.length - 1, from + 1);
  } else if (action === 'top') {
    to = 0;
  } else if (action === 'bottom') {
    to = next.length - 1;
  } else if (action === 'to') {
    const n = Number(targetOneBased);
    if (!Number.isInteger(n) || n < 1 || n > next.length) return next;
    to = n - 1;
  } else {
    return next;
  }

  if (to === from) return next;
  const moved = next.splice(from, 1)[0];
  next.splice(to, 0, moved);
  return next;
}
