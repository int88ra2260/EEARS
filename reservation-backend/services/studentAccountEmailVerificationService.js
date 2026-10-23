const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { StudentAccountEmailVerification } = require('../models');
const { validateEmail } = require('../utils/validators');

const CODE_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_SEC = 30 * 60;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const TOKEN_PURPOSE = 'student_account_email_verified';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function assertEmailFormat(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 100 || !validateEmail(normalized)) {
    throw httpError(400, 'INVALID_EMAIL', '請輸入有效的電子郵件');
  }
  return normalized;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET != null ? String(process.env.JWT_SECRET).trim() : '';
  if (!secret) {
    throw httpError(503, 'JWT_SECRET_MISSING', '伺服器驗證設定尚未完成，請稍後再試');
  }
  return secret;
}

function hashCode(code) {
  return crypto.createHmac('sha256', getJwtSecret()).update(String(code)).digest('hex');
}

function generateNumericCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function invalidateActiveCodes(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  await StudentAccountEmailVerification.update(
    { consumedAt: new Date() },
    {
      where: {
        email: normalized,
        consumedAt: { [Op.is]: null },
      },
    },
  );
}

async function createAndSendCode({ email, studentId = null }) {
  const normalized = assertEmailFormat(email);

  const existing = await StudentAccountEmailVerification.findOne({
    where: {
      email: normalized,
      consumedAt: { [Op.is]: null },
    },
    order: [['id', 'DESC']],
  });

  if (existing && existing.lastSentAt) {
    const elapsed = Date.now() - new Date(existing.lastSentAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      const err = httpError(429, 'RESEND_COOLDOWN', `請稍候 ${waitSec} 秒後再重新寄送驗證碼`);
      err.retryAfterSec = waitSec;
      throw err;
    }
  }

  const code = generateNumericCode();
  const now = new Date();
  await invalidateActiveCodes(normalized);
  await StudentAccountEmailVerification.create({
    email: normalized,
    studentId: studentId ? String(studentId).trim().slice(0, 20) : null,
    codeHash: hashCode(code),
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    attemptCount: 0,
    consumedAt: null,
    lastSentAt: now,
  });

  return {
    email: normalized,
    code,
    expiresInSec: Math.floor(CODE_TTL_MS / 1000),
  };
}

async function verifyCode({ email, code }) {
  const normalized = assertEmailFormat(email);
  const trimmedCode = String(code || '').trim();
  if (!/^\d{6}$/.test(trimmedCode)) {
    throw httpError(400, 'INVALID_CODE_FORMAT', '驗證碼格式不正確');
  }

  const record = await StudentAccountEmailVerification.findOne({
    where: {
      email: normalized,
      consumedAt: { [Op.is]: null },
    },
    order: [['id', 'DESC']],
  });
  if (!record) {
    throw httpError(400, 'CODE_NOT_FOUND', '請先寄送驗證碼至信箱');
  }
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    await record.update({ consumedAt: new Date() });
    throw httpError(400, 'CODE_EXPIRED', '驗證碼已過期，請重新寄送');
  }
  if (record.attemptCount >= MAX_ATTEMPTS) {
    await record.update({ consumedAt: new Date() });
    throw httpError(400, 'TOO_MANY_ATTEMPTS', '驗證碼錯誤次數過多，請重新寄送');
  }

  const expected = Buffer.from(record.codeHash, 'hex');
  const actual = Buffer.from(hashCode(trimmedCode), 'hex');
  const match = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  if (!match) {
    await record.update({ attemptCount: record.attemptCount + 1 });
    const remaining = MAX_ATTEMPTS - (record.attemptCount + 1);
    throw httpError(
      400,
      'CODE_MISMATCH',
      remaining > 0 ? `驗證碼錯誤，還可再試 ${remaining} 次` : '驗證碼錯誤次數過多，請重新寄送',
    );
  }

  await record.update({ consumedAt: new Date() });
  const token = jwt.sign(
    { purpose: TOKEN_PURPOSE, email: normalized },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL_SEC },
  );
  return {
    email: normalized,
    emailVerificationToken: token,
    expiresInSec: TOKEN_TTL_SEC,
  };
}

function assertEmailVerifiedToken({ token, email }) {
  const normalized = assertEmailFormat(email);
  if (!token || !String(token).trim()) {
    throw httpError(400, 'EMAIL_VERIFICATION_REQUIRED', '請先完成信箱驗證後再建立帳號');
  }
  let payload;
  try {
    payload = jwt.verify(String(token).trim(), getJwtSecret());
  } catch (_) {
    throw httpError(400, 'EMAIL_VERIFICATION_INVALID', '信箱驗證已過期或無效，請重新驗證');
  }
  if (payload.purpose !== TOKEN_PURPOSE || normalizeEmail(payload.email) !== normalized) {
    throw httpError(400, 'EMAIL_VERIFICATION_MISMATCH', '信箱驗證與目前填寫的電子郵件不符，請重新驗證');
  }
  return true;
}

module.exports = {
  CODE_TTL_MS,
  TOKEN_TTL_SEC,
  TOKEN_PURPOSE,
  normalizeEmail,
  createAndSendCode,
  invalidateActiveCodes,
  verifyCode,
  assertEmailVerifiedToken,
};
