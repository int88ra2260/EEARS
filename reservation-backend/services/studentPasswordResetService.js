const crypto = require('crypto');
const { Op } = require('sequelize');
const { StudentAccount, StudentAccountPasswordReset } = require('../models');
const { validateStudentId } = require('../utils/validators');
const { normalizeStudentId, replaceLocalPassword } = require('./studentAuthService');
const { findPendingByStudentId } = require('./studentAccountReviewService');

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function genericCodeError() {
  return httpError(400, 'RESET_CODE_INVALID', '驗證碼錯誤或已失效，請重新寄送');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
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

function isResettable(account) {
  return Boolean(account && account.status === 'active' && account.passwordHash);
}

function toAdminAccount(account) {
  return {
    id: account.id,
    studentId: account.studentId,
    name: account.name,
    email: account.email,
    status: account.status,
    lastLoginAt: account.lastLoginAt || null,
    passwordChangedAt: account.passwordChangedAt || null,
    hasLocalPassword: Boolean(account.passwordHash),
  };
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function parsePage(value) {
  const page = Number.parseInt(value, 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, 10000);
}

function parsePageSize(value) {
  const size = Number.parseInt(value, 10);
  if (!Number.isFinite(size) || size < 1) return 50;
  return Math.min(size, 100);
}

async function invalidateActiveResetCodes(studentAccountId) {
  const id = Number(studentAccountId);
  if (!Number.isFinite(id)) return;
  await StudentAccountPasswordReset.update(
    { consumedAt: new Date() },
    {
      where: {
        studentAccountId: id,
        consumedAt: { [Op.is]: null },
      },
    },
  );
}

async function latestActiveCode(studentAccountId) {
  return StudentAccountPasswordReset.findOne({
    where: {
      studentAccountId,
      consumedAt: { [Op.is]: null },
    },
    order: [['id', 'DESC']],
  });
}

async function issueCode(account) {
  const latest = await latestActiveCode(account.id);
  if (latest && latest.lastSentAt) {
    const elapsed = Date.now() - new Date(latest.lastSentAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        retryAfterSec: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
      };
    }
  }

  const code = generateNumericCode();
  const now = new Date();
  await invalidateActiveResetCodes(account.id);
  await StudentAccountPasswordReset.create({
    studentAccountId: account.id,
    studentId: account.studentId,
    email: normalizeEmail(account.email),
    codeHash: hashCode(code),
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    attemptCount: 0,
    consumedAt: null,
    lastSentAt: now,
  });

  return {
    ok: true,
    studentAccountId: account.id,
    studentId: account.studentId,
    email: normalizeEmail(account.email),
    code,
    expiresInSec: Math.floor(CODE_TTL_MS / 1000),
  };
}

async function prepareResetByStudentId(studentId) {
  const id = normalizeStudentId(studentId);
  if (!validateStudentId(id)) return null;
  const account = await StudentAccount.findOne({ where: { studentId: id } });
  if (!isResettable(account)) return null;
  const issued = await issueCode(account);
  if (!issued.ok) return null;
  return issued;
}

async function prepareResetByAccountId(accountId) {
  const account = await StudentAccount.findByPk(accountId);
  if (!account) {
    throw httpError(404, 'ACCOUNT_NOT_FOUND', '找不到這個學生帳號');
  }
  if (!isResettable(account)) {
    throw httpError(400, 'PASSWORD_LOGIN_UNAVAILABLE', '此帳號目前無法重設密碼');
  }
  const issued = await issueCode(account);
  if (!issued.ok) {
    const err = httpError(429, 'RESEND_COOLDOWN', `請稍候 ${issued.retryAfterSec} 秒後再寄送`);
    err.retryAfterSec = issued.retryAfterSec;
    throw err;
  }
  return issued;
}

async function confirmReset({ studentId, code, newPassword }) {
  const id = normalizeStudentId(studentId);
  const trimmedCode = String(code || '').trim();
  if (!validateStudentId(id) || !/^\d{6}$/.test(trimmedCode)) {
    throw genericCodeError();
  }

  const record = await StudentAccountPasswordReset.findOne({
    where: {
      studentId: id,
      consumedAt: { [Op.is]: null },
    },
    order: [['id', 'DESC']],
  });
  if (!record) throw genericCodeError();

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    await record.update({ consumedAt: new Date() });
    throw genericCodeError();
  }
  if (record.attemptCount >= MAX_ATTEMPTS) {
    await record.update({ consumedAt: new Date() });
    throw genericCodeError();
  }

  const expected = Buffer.from(record.codeHash, 'hex');
  const actual = Buffer.from(hashCode(trimmedCode), 'hex');
  const match = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  if (!match) {
    const nextCount = record.attemptCount + 1;
    await record.update({
      attemptCount: nextCount,
      ...(nextCount >= MAX_ATTEMPTS ? { consumedAt: new Date() } : {}),
    });
    throw genericCodeError();
  }

  const account = await StudentAccount.findOne({ where: { studentId: id } });
  const usable = isResettable(account)
    && account.id === record.studentAccountId
    && normalizeEmail(account.email) === normalizeEmail(record.email);
  if (!usable) {
    await record.update({ consumedAt: new Date() });
    throw genericCodeError();
  }

  await replaceLocalPassword(account, newPassword);
  await record.update({ consumedAt: new Date() });
  return account;
}

async function lookupStudentAccount(studentId) {
  const id = normalizeStudentId(studentId);
  if (!validateStudentId(id)) {
    throw httpError(400, 'INVALID_STUDENT_ID', '學號格式不正確');
  }

  const account = await StudentAccount.findOne({ where: { studentId: id } });
  if (account) {
    return { kind: 'account', account: toAdminAccount(account), pending: null };
  }

  const pending = await findPendingByStudentId(id);
  if (pending) {
    return {
      kind: 'pending',
      account: null,
      pending: {
        id: pending.id,
        studentId: pending.studentId,
        name: pending.name,
        email: pending.email,
        createdAt: pending.createdAt,
      },
    };
  }

  return { kind: 'none', account: null, pending: null };
}

async function listStudentAccounts({ q, page, pageSize } = {}) {
  const currentPage = parsePage(page);
  const size = parsePageSize(pageSize);
  const term = String(q || '').trim().slice(0, 100);
  const where = {};
  if (term) {
    const like = `%${escapeLike(term)}%`;
    where[Op.or] = [
      { studentId: { [Op.like]: like } },
      { name: { [Op.like]: like } },
      { email: { [Op.like]: like } },
    ];
  }

  const { rows, count } = await StudentAccount.findAndCountAll({
    where,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: size,
    offset: (currentPage - 1) * size,
  });

  return {
    accounts: rows.map((row) => ({
      ...toAdminAccount(row),
      createdAt: row.createdAt || null,
    })),
    total: count,
    page: currentPage,
    pageSize: size,
  };
}

module.exports = {
  CODE_TTL_MS,
  prepareResetByStudentId,
  prepareResetByAccountId,
  confirmReset,
  invalidateActiveResetCodes,
  lookupStudentAccount,
  listStudentAccounts,
};
