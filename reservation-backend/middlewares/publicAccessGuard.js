const crypto = require('crypto');
const auditLogService = require('../services/auditLogService');

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function createSimpleRateLimit({ windowMs, max, message, keyFn }) {
  const buckets = new Map();
  const windowSize = Number(windowMs) || 10 * 60 * 1000;
  const maxHits = Number(max) || 10;
  const errorMessage = message || 'Too many requests.';

  return (req, res, next) => {
    const now = Date.now();
    const ip = getClientIp(req);
    const key = typeof keyFn === 'function' ? keyFn(req, ip) : ip;
    const current = buckets.get(key);

    if (!current || now > current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowSize });
      return next();
    }

    current.count += 1;
    if (current.count > maxHits) {
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: errorMessage,
      });
    }
    return next();
  };
}

/** 護照學生端：有學號時僅依學號分桶；否則退回 IP（身分驗證前） */
function elpStudentKey(req, ip) {
  const source = req.method === 'GET' ? (req.query || {}) : (req.body || {});
  const studentId = String(source.studentId || '').trim();
  if (studentId) return `elp:stu:${studentId}`;
  return `elp:ip:${ip}`;
}

async function verifyCaptchaToken(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return false;
  try {
    const payload = new URLSearchParams();
    payload.append('secret', secret);
    payload.append('response', token);
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return !!data.success;
  } catch (_) {
    return false;
  }
}

async function requireCaptchaIfEnabled(req, res, next) {
  if (String(process.env.PUBLIC_QUERY_CAPTCHA_ENABLED || 'false') !== 'true') return next();
  const token = req.body?.captchaToken || req.query?.captchaToken || req.headers['x-captcha-token'];
  if (!token) return res.status(400).json({ success: false, message: 'Verification failed.' });
  const ok = await verifyCaptchaToken(String(token).trim());
  if (!ok) return res.status(400).json({ success: false, message: 'Verification failed.' });
  return next();
}

function normalizePublicLookupInput(req, _res, next) {
  const normalizeObj = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    const candidateKeys = ['studentId', 'studentName', 'name', 'email', 'studentEmail', 'idNumber', 'verificationCode', 'cancellationCode'];
    candidateKeys.forEach((k) => {
      if (obj[k] !== undefined && obj[k] !== null) {
        obj[k] = String(obj[k]).trim();
      }
    });
    if (obj.email) obj.email = String(obj.email).toLowerCase();
    if (obj.studentEmail) obj.studentEmail = String(obj.studentEmail).toLowerCase();
    if (obj.idNumber) obj.idNumber = String(obj.idNumber).toUpperCase();
  };
  normalizeObj(req.query);
  normalizeObj(req.body);
  next();
}

function requireLookupMinimumFields({ requireStudentId = false, requireName = false, requireEmail = false } = {}) {
  return (req, res, next) => {
    const source = req.method === 'GET' ? (req.query || {}) : (req.body || {});
    const studentId = source.studentId || '';
    const name = source.studentName || source.name || '';
    const email = source.email || source.studentEmail || '';

    if (requireStudentId && String(studentId).length < 6) {
      return res.status(400).json({ success: false, message: 'Invalid query.' });
    }
    if (requireName && String(name).length < 2) {
      return res.status(400).json({ success: false, message: 'Invalid query.' });
    }
    if (requireEmail && String(email).length < 6) {
      return res.status(400).json({ success: false, message: 'Invalid query.' });
    }
    return next();
  };
}

const publicReservationLookupRateLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many requests.',
});

const publicEnglishTestLookupRateLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: 'Too many requests.',
});

function genericLookupResponse(res, payload = {}) {
  const found = !!payload.found;
  return res.json({
    success: true,
    found,
    message: payload.message || 'Request processed.',
    data: payload.data || null,
  });
}

function hashLookupPayload(payload) {
  const src = JSON.stringify(payload || {});
  return crypto.createHash('sha256').update(src).digest('hex');
}

function publicLookupAudit(req, meta = {}) {
  try {
    auditLogService.logAuditAsync({
      module: 'public_lookup',
      action: meta.action || 'query',
      entityType: meta.entityType || 'PublicLookup',
      entityId: meta.entityId || hashLookupPayload(meta.payload || {}),
      targetSummary: meta.targetSummary || null,
      afterData: {
        found: !!meta.found,
        payloadHash: hashLookupPayload(meta.payload || {}),
      },
      req,
    });
  } catch (error) {
    console.warn('[publicLookupAudit] failed', error?.message || error);
  }
}

module.exports = {
  createSimpleRateLimit,
  elpStudentKey,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  requireLookupMinimumFields,
  publicReservationLookupRateLimit,
  publicEnglishTestLookupRateLimit,
  genericLookupResponse,
  publicLookupAudit,
  hashLookupPayload,
};
