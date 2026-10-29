const GENERIC_UNAVAILABLE = '目前無法取得學習分析資料，請稍後再試。若問題持續發生，請聯絡系統管理員。';

const STATUS_MESSAGES = {
  401: '登入已失效，請重新登入後再查看學習分析。',
  404: '找不到這筆學習分析資料。',
  429: '請求過於頻繁，請稍後再試。',
};

export function looksLikeInternalAnalyticsError(message) {
  return /table\s+['"`]|doesn'?t exist|does not exist|ER_[A-Z0-9_]+|Sequelize|SQL syntax|sqlMessage|ECONNREFUSED|at\s+\S+\.js:\d+|[/\\]reservation-|Bearer\s+\S+|password\s*[:=]/i
    .test(String(message || ''));
}

export function presentLearningAnalyticsError({
  status,
  message,
  code,
  forbiddenMessage = '您沒有執行此操作的權限。',
} = {}) {
  if (status === 403 || code === 'INSUFFICIENT_PERMISSIONS' || code === 'LEARNING_ANALYTICS_FORBIDDEN') {
    return forbiddenMessage;
  }
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500 || looksLikeInternalAnalyticsError(message)) {
    return GENERIC_UNAVAILABLE;
  }
  const text = String(message || '').trim();
  return text || `HTTP ${status || 500}`;
}
