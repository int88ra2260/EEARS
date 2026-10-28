export function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('zh-TW');
}

/** 人數／分母（百分比）。分母為 0 時不計算比例。 */
export function formatRate(part, whole) {
  const n = Number(part);
  const d = Number(whole);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return '—';
  const pct = Math.round((n / d) * 1000) / 10;
  return `${formatCount(n)}／${formatCount(d)}（${pct}%）`;
}

export function formatHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 10) / 10;
  return `${rounded.toLocaleString('zh-TW')} 小時`;
}
