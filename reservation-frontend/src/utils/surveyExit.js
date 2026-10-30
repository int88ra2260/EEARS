/**
 * 問卷離開導向。React Router 會把本次工作階段的歷史索引放在 history.state.idx。
 * 回傳 -1 表示應 navigate(-1)；否則為站內路徑。不要回傳首頁。
 */

export function routerHistoryIndex(historyState) {
  const idx = historyState?.idx;
  return typeof idx === 'number' && Number.isFinite(idx) ? idx : 0;
}

export function surveyBackTarget(historyState, fallback) {
  if (routerHistoryIndex(historyState) > 0) return -1;
  return fallback;
}
