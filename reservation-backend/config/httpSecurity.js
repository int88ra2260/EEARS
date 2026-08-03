/**
 * HTTP 對外安全設定（helmet、body limit、trust proxy、全域 rate limit）。
 */

const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/** 全站限流在 auth 之前執行；從 Bearer token 解出 user id 作分桶（僅限流用，不授權） */
function rateLimitKeyFromRequest(req) {
  if (req.user?.id != null) return `user:${req.user.id}`;
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    try {
      const segment = auth.slice(7).trim().split('.')[1];
      if (segment) {
        const json = Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        const payload = JSON.parse(json);
        if (payload?.id != null) return `user:${payload.id}`;
        if (payload?.sub != null) return `user:${payload.sub}`;
      }
    } catch (_) {
      // ignore malformed token
    }
  }
  return ipKeyGenerator(req.ip);
}

/** 已登入後台／內部 API 另有 auth + 權限，不應與公開流量共用 IP 桶 */
function shouldSkipGlobalRateLimit(req) {
  if (req.method === 'OPTIONS') return true;
  const p = req.path || '';
  if (p === '/health' || p.startsWith('/health/')) return true;
  if (p === '/stats/views' || p.startsWith('/stats/')) return true;
  if (p.startsWith('/admin/')) return true;
  if (p.startsWith('/internal/')) return true;
  // 護照學生端另有 elpReadRateLimit / elpWriteRateLimit，避免與全站 IP 桶疊加
  if (p.startsWith('/english-learning-passport/')) return true;
  return false;
}

function parseBool(raw, defaultValue) {
  if (raw == null || raw === '') return defaultValue;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

function getRequestBodyLimit() {
  const raw = process.env.REQUEST_BODY_LIMIT;
  if (raw != null && String(raw).trim()) return String(raw).trim();
  return '1mb';
}

function getGlobalRateLimitConfig() {
  const isTest = process.env.NODE_ENV === 'test';
  const enabledDefault = !isTest;
  const enabled = parseBool(process.env.GLOBAL_RATE_LIMIT_ENABLED, enabledDefault);
  const windowMs = Number(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
  const max = Number(process.env.GLOBAL_RATE_LIMIT_MAX) || 1000;
  return { enabled, windowMs, max };
}

function applyTrustProxy(app) {
  const raw = process.env.TRUST_PROXY;
  if (raw == null || raw === '') return false;
  const v = String(raw).trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  const hops = Number(raw);
  if (Number.isFinite(hops) && hops >= 0) {
    app.set('trust proxy', hops);
    return true;
  }
  if (['1', 'true', 'yes', 'on'].includes(v)) {
    app.set('trust proxy', 1);
    return true;
  }
  return false;
}

function createSecurityHeadersMiddleware() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });
}

function createGlobalRateLimitMiddleware() {
  const { enabled, windowMs, max } = getGlobalRateLimitConfig();
  if (!enabled) {
    return (req, res, next) => next();
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipGlobalRateLimit,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: '請求次數過多，請稍後再試。',
      });
    },
    keyGenerator: rateLimitKeyFromRequest,
  });
}

module.exports = {
  parseBool,
  getRequestBodyLimit,
  getGlobalRateLimitConfig,
  applyTrustProxy,
  createSecurityHeadersMiddleware,
  createGlobalRateLimitMiddleware,
  rateLimitKeyFromRequest,
  shouldSkipGlobalRateLimit,
};
