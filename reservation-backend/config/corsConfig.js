/**
 * CORS：以 CORS_ORIGINS 白名單為主；無 Origin（curl、同源、部分 proxy）一律允許。
 * credentials 固定 false（本系統以 Bearer token 為主）。
 */

const cors = require('cors');

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

function parseOrigins(raw) {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getAllowedOriginSet() {
  const isProd = process.env.NODE_ENV === 'production';
  const fromEnv = parseOrigins(process.env.CORS_ORIGINS);
  if (isProd) {
    return new Set(fromEnv);
  }
  if (fromEnv.length) {
    return new Set(fromEnv);
  }
  return new Set(DEFAULT_DEV_ORIGINS);
}

function createCorsMiddleware() {
  const allowedSet = getAllowedOriginSet();

  return cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedSet.has(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'x-request-id',
      'X-User-Role',
      'x-user-role',
      'X-Confirm-Password',
      'x-confirm-password',
      'X-Captcha-Token',
      'x-captcha-token',
      'X-Trace-Id',
      'x-trace-id',
    ],
  });
}

module.exports = {
  createCorsMiddleware,
  getAllowedOriginSet,
  DEFAULT_DEV_ORIGINS,
};
