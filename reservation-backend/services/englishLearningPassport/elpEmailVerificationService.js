'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { EnglishLearningPassportEmailVerification } = require('../../models');
const { validateNsysuStudentEmail } = require('../../utils/validators');

const CODE_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_SEC = 30 * 60;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const TOKEN_PURPOSE = 'elp_email_verified';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmailFormat(email) {
  return validateNsysuStudentEmail(email);
}

function assertNsysuStudentEmail(email) {
  const normalized = normalizeEmail(email);
  if (!isValidEmailFormat(normalized)) {
    const err = new Error('請使用中山大學學生信箱（@student.nsysu.edu.tw）');
    err.code = 'INVALID_STUDENT_EMAIL_DOMAIN';
    err.status = 400;
    throw err;
  }
  return normalized;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET != null ? String(process.env.JWT_SECRET).trim() : '';
  if (!secret) {
    const err = new Error('伺服器驗證設定尚未完成，請稍後再試');
    err.code = 'JWT_SECRET_MISSING';
    err.status = 503;
    throw err;
  }
  return secret;
}

function hashCode(code) {
  return crypto.createHmac('sha256', getJwtSecret()).update(String(code)).digest('hex');
}

function generateNumericCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isEmailVerificationEnforced() {
  const raw = process.env.ELP_EMAIL_VERIFICATION_ENABLED;
  if (raw == null || raw === '') return true;
  return String(raw).toLowerCase() !== 'false';
}

async function invalidateActiveCodes(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  await EnglishLearningPassportEmailVerification.update(
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
  const normalized = assertNsysuStudentEmail(email);

  const existing = await EnglishLearningPassportEmailVerification.findOne({
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
      const err = new Error(`請稍候 ${waitSec} 秒後再重新寄送驗證碼`);
      err.code = 'RESEND_COOLDOWN';
      err.status = 429;
      err.retryAfterSec = waitSec;
      throw err;
    }
  }

  const code = generateNumericCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);

  await invalidateActiveCodes(normalized);

  await EnglishLearningPassportEmailVerification.create({
    email: normalized,
    studentId: studentId ? String(studentId).trim() : null,
    codeHash: hashCode(code),
    expiresAt,
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
  const normalized = assertNsysuStudentEmail(email);
  const trimmedCode = String(code || '').trim();

  if (!/^\d{6}$/.test(trimmedCode)) {
    const err = new Error('驗證碼格式不正確');
    err.code = 'INVALID_CODE_FORMAT';
    err.status = 400;
    throw err;
  }

  const record = await EnglishLearningPassportEmailVerification.findOne({
    where: {
      email: normalized,
      consumedAt: { [Op.is]: null },
    },
    order: [['id', 'DESC']],
  });

  if (!record) {
    const err = new Error('請先寄送驗證碼至信箱');
    err.code = 'CODE_NOT_FOUND';
    err.status = 400;
    throw err;
  }

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    await record.update({ consumedAt: new Date() });
    const err = new Error('驗證碼已過期，請重新寄送');
    err.code = 'CODE_EXPIRED';
    err.status = 400;
    throw err;
  }

  if (record.attemptCount >= MAX_ATTEMPTS) {
    await record.update({ consumedAt: new Date() });
    const err = new Error('驗證碼錯誤次數過多，請重新寄送');
    err.code = 'TOO_MANY_ATTEMPTS';
    err.status = 400;
    throw err;
  }

  const expected = record.codeHash;
  const actual = hashCode(trimmedCode);
  let match = false;
  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(actual, 'hex');
    match =
      expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch (_) {
    match = false;
  }

  if (!match) {
    await record.update({ attemptCount: record.attemptCount + 1 });
    const remaining = MAX_ATTEMPTS - (record.attemptCount + 1);
    const err = new Error(
      remaining > 0 ? `驗證碼錯誤，還可再試 ${remaining} 次` : '驗證碼錯誤次數過多，請重新寄送',
    );
    err.code = 'CODE_MISMATCH';
    err.status = 400;
    throw err;
  }

  await record.update({ consumedAt: new Date() });

  const token = jwt.sign(
    {
      purpose: TOKEN_PURPOSE,
      email: normalized,
    },
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
  if (!isEmailVerificationEnforced()) return true;

  const normalized = normalizeEmail(email);
  if (!normalized) {
    const err = new Error('缺少電子郵件');
    err.code = 'EMAIL_REQUIRED';
    err.status = 400;
    throw err;
  }

  if (!token || !String(token).trim()) {
    const err = new Error('請先完成信箱驗證碼驗證後再申請護照');
    err.code = 'EMAIL_VERIFICATION_REQUIRED';
    err.status = 400;
    throw err;
  }

  let payload;
  try {
    payload = jwt.verify(String(token).trim(), getJwtSecret());
  } catch (_) {
    const err = new Error('信箱驗證已過期或無效，請重新驗證');
    err.code = 'EMAIL_VERIFICATION_INVALID';
    err.status = 400;
    throw err;
  }

  if (payload.purpose !== TOKEN_PURPOSE || normalizeEmail(payload.email) !== normalized) {
    const err = new Error('信箱驗證與目前填寫的電子郵件不符，請重新驗證');
    err.code = 'EMAIL_VERIFICATION_MISMATCH';
    err.status = 400;
    throw err;
  }

  return true;
}

module.exports = {
  CODE_TTL_MS,
  TOKEN_TTL_SEC,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  TOKEN_PURPOSE,
  normalizeEmail,
  isValidEmailFormat,
  isEmailVerificationEnforced,
  createAndSendCode,
  invalidateActiveCodes,
  verifyCode,
  assertEmailVerifiedToken,
};
