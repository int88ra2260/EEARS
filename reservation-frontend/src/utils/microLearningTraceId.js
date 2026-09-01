/**
 * 微學習 traceId 產生（各遊戲共用前綴）
 * @param {string} prefix 例如 wb_ | ll_ | vd_
 */
export function createMicroLearningTraceId(prefix) {
  const safePrefix = String(prefix || 'ml_').replace(/[^a-z0-9_]/gi, '');
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${safePrefix}${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }
  return `${safePrefix}${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
