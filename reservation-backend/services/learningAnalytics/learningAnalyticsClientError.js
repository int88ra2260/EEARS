'use strict';

const logger = require('../../utils/logger');

const GENERIC_UNAVAILABLE = '目前無法取得學習分析資料，請稍後再試。若問題持續發生，請聯絡系統管理員。';

const STATUS_MESSAGES = {
  401: '登入已失效，請重新登入後再查看學習分析。',
  403: '您沒有檢視這項學習分析的權限。',
  404: '找不到這筆學習分析資料。',
  429: '請求過於頻繁，請稍後再試。',
};

const STATUS_CODES = {
  401: 'LEARNING_ANALYTICS_AUTH_REQUIRED',
  403: 'LEARNING_ANALYTICS_FORBIDDEN',
  404: 'LEARNING_ANALYTICS_NOT_FOUND',
  429: 'LEARNING_ANALYTICS_RATE_LIMITED',
};

function looksInternal(message) {
  return /table\s+['"`]|doesn'?t exist|does not exist|ER_[A-Z0-9_]+|Sequelize|SQL syntax|sqlMessage|ECONNREFUSED|at\s+\S+\.js:\d+|[/\\]reservation-|Bearer\s+\S+|password\s*[:=]/i
    .test(String(message || ''));
}

function resolveStatus(error, statusOverride) {
  const override = Number(statusOverride);
  if (override >= 400 && override < 600) return override;
  const fromError = Number(error?.status || error?.statusCode);
  if (fromError >= 400 && fromError < 600) return fromError;
  return 500;
}

function statusFromValidationMessage(message) {
  return /不支援|須為|必填|不可|重複|至少一筆|至少一項|migration/.test(String(message || '')) ? 400 : 500;
}

function publicMessage(error, status) {
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500) return GENERIC_UNAVAILABLE;
  const message = String(error?.message || '').trim();
  if (!message || looksInternal(message)) return '無法完成這項學習分析操作，請確認條件後再試。';
  return message;
}

function publicCode(error, status) {
  if (error?.code && !looksInternal(error.code)) return error.code;
  if (STATUS_CODES[status]) return STATUS_CODES[status];
  if (status >= 500) return 'LEARNING_ANALYTICS_UNAVAILABLE';
  return 'LEARNING_ANALYTICS_ERROR';
}

function diagnosticError(error) {
  const raw = String(error?.message || '');
  const safe = raw
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/password\s*[:=]\s*\S+/gi, 'password=[redacted]')
    .slice(0, 300);
  const logged = new Error(safe || 'learning analytics request failed');
  logged.name = error?.name || 'Error';
  const code = error?.parent?.code || error?.code;
  if (code && !looksInternal(String(code))) logged.code = code;
  const stack = String(error?.stack || '');
  if (stack && !/SELECT |INSERT |UPDATE |DELETE |password|Bearer /i.test(stack)) {
    logged.stack = stack;
  }
  return logged;
}

function sendAnalyticsError(req, res, error, statusOverride) {
  const status = resolveStatus(error, statusOverride);
  logger.error(
    `learning analytics request failed status=${status} requestId=${req?.requestId || '-'}`,
    diagnosticError(error)
  );
  return res.status(status).json({
    success: false,
    code: publicCode(error, status),
    error: publicMessage(error, status),
    requestId: req?.requestId || null,
  });
}

module.exports = {
  GENERIC_UNAVAILABLE,
  looksInternal,
  publicMessage,
  sendAnalyticsError,
  statusFromValidationMessage,
};
