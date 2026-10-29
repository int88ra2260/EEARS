const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { StudentAccount } = require('../models');
const { secretKey } = require('../config/jwtSecret');
const {
  validateStudentId,
  validateName,
  validateEmail,
} = require('../utils/validators');
const { assertEmailVerifiedToken } = require('./studentAccountEmailVerificationService');
const { findOfficialIdentity } = require('./studentIdentityRosterService');
const { compactPersonName, normalizePersonName } = require('../utils/personName');
const {
  savePendingReview,
  findPendingByStudentId,
  replacePending,
} = require('./studentAccountReviewService');
const loginAccountCooldown = require('../utils/loginAccountCooldown');

const TOKEN_TYP = 'student';
const TOKEN_EXPIRES_IN = '12h';
const BCRYPT_ROUNDS = 12;

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeStudentId(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return compactPersonName(value);
}

function cooldownKey(studentId) {
  return `student:${normalizeStudentId(studentId)}`;
}

function toPublicAccount(account) {
  return {
    id: account.id,
    studentId: account.studentId,
    name: account.name,
    email: account.email,
    status: account.status,
    ssoLinked: Boolean(account.ssoProvider && account.ssoSubject),
    ssoProvider: account.ssoProvider || null,
  };
}

function signStudentToken(account) {
  return jwt.sign({
    typ: TOKEN_TYP,
    id: account.id,
    studentId: account.studentId,
    name: account.name,
    email: account.email,
  }, secretKey, { expiresIn: TOKEN_EXPIRES_IN });
}

function assertLocalPassword(password) {
  const value = String(password || '');
  if (value.length < 8 || value.length > 72) {
    throw httpError(400, 'INVALID_PASSWORD', '密碼需為 8 到 72 個字元');
  }
}

function assertProfile({ studentId, name, email }) {
  if (!validateStudentId(studentId)) {
    throw httpError(400, 'INVALID_STUDENT_ID', '學號格式不正確');
  }
  if (!validateName(name)) {
    throw httpError(400, 'INVALID_NAME', '姓名只能包含中文、英文與空格');
  }
  if (!email || email.length > 100 || !validateEmail(email)) {
    throw httpError(400, 'INVALID_EMAIL', '請輸入有效的電子郵件');
  }
}

async function registerAccount({ studentId, name, email, password, emailVerificationToken }) {
  const normalized = {
    studentId: normalizeStudentId(studentId),
    name: normalizeName(name),
    email: normalizeEmail(email),
  };
  assertProfile(normalized);
  assertEmailVerifiedToken({ token: emailVerificationToken, email: normalized.email });
  assertLocalPassword(password);
  if (normalizeStudentId(password) === normalized.studentId || password === normalized.email) {
    throw httpError(400, 'INVALID_PASSWORD', '密碼不能與學號或信箱相同');
  }

  const existing = await StudentAccount.findOne({
    where: {
      [Op.or]: [
        { studentId: normalized.studentId },
        { email: normalized.email },
      ],
    },
  });
  if (existing) {
    if (existing.studentId === normalized.studentId) {
      throw httpError(409, 'STUDENT_ACCOUNT_EXISTS', '此學號已建立帳號，請直接登入');
    }
    throw httpError(409, 'STUDENT_EMAIL_EXISTS', '此信箱已建立帳號，請直接登入');
  }

  const identity = await findOfficialIdentity(normalized.studentId);
  if (identity.conflict) {
    throw httpError(409, 'STUDENT_IDENTITY_CONFLICT', '這個學號的名冊姓名不一致，請聯絡英語中心');
  }
  if (identity.covered && identity.name !== normalizePersonName(normalized.name)) {
    throw httpError(400, 'STUDENT_IDENTITY_MISMATCH', '學號與姓名不符，請核對後再試');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  if (!identity.covered) {
    await savePendingReview({ ...normalized, passwordHash });
    return { pending: true };
  }
  const now = new Date();
  try {
    const account = await StudentAccount.create({
      ...normalized,
      passwordHash,
      status: 'active',
      passwordChangedAt: now,
    });
    await replacePending({ studentId: normalized.studentId, email: normalized.email });
    return account;
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw httpError(409, 'STUDENT_ACCOUNT_EXISTS', '此學號或信箱已建立帳號，請直接登入');
    }
    throw error;
  }
}

async function loginAccount({ studentId, password }) {
  const normalizedId = normalizeStudentId(studentId);
  const key = cooldownKey(normalizedId);
  const cooldown = loginAccountCooldown.checkLoginCooldown(key);
  if (cooldown.blocked) {
    const err = httpError(429, 'LOGIN_COOLDOWN', '登入失敗次數過多，請稍後再試');
    err.retryAfterSeconds = cooldown.retryAfterSeconds;
    throw err;
  }
  if (!normalizedId || !password) {
    throw httpError(400, 'MISSING_CREDENTIALS', '請輸入學號與密碼');
  }

  const account = await StudentAccount.findOne({ where: { studentId: normalizedId } });
  const hash = account && account.passwordHash;
  const passwordOk = hash ? await bcrypt.compare(String(password), hash) : false;
  if (!account || account.status !== 'active' || !passwordOk) {
    if (!account) {
      const pending = await findPendingByStudentId(normalizedId);
      const pendingOk = pending && pending.passwordHash
        ? await bcrypt.compare(String(password), pending.passwordHash)
        : false;
      if (pendingOk) {
        throw httpError(403, 'STUDENT_ACCOUNT_PENDING', '這個學號尚在確認，確認完成前無法登入');
      }
    }
    loginAccountCooldown.recordLoginFailure(key);
    throw httpError(401, 'INVALID_CREDENTIALS', '學號或密碼錯誤');
  }

  loginAccountCooldown.clearLoginCooldown(key);
  await account.update({ lastLoginAt: new Date() });
  return account;
}

async function changePassword({ accountId, currentPassword, newPassword }) {
  const account = await StudentAccount.findByPk(accountId);
  if (!account || account.status !== 'active') {
    throw httpError(401, 'STUDENT_AUTH_REQUIRED', '請重新登入');
  }
  if (!account.passwordHash) {
    throw httpError(400, 'PASSWORD_LOGIN_UNAVAILABLE', '此帳號目前無法在這裡變更密碼，請聯絡英語中心');
  }
  const matches = await bcrypt.compare(String(currentPassword || ''), account.passwordHash);
  if (!matches) {
    throw httpError(400, 'INVALID_PASSWORD', '目前密碼不正確');
  }
  return replaceLocalPassword(account, newPassword);
}

async function replaceLocalPassword(account, newPassword) {
  if (!account || account.status !== 'active' || !account.passwordHash) {
    throw httpError(400, 'PASSWORD_LOGIN_UNAVAILABLE', '此帳號目前無法在這裡重設密碼');
  }
  assertLocalPassword(newPassword);
  if (normalizeStudentId(newPassword) === account.studentId || newPassword === account.email) {
    throw httpError(400, 'INVALID_PASSWORD', '密碼不能與學號或信箱相同');
  }
  const same = await bcrypt.compare(String(newPassword), account.passwordHash);
  if (same) {
    throw httpError(400, 'INVALID_PASSWORD', '新密碼不能與目前密碼相同');
  }
  const passwordChangedAt = new Date();
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await account.update({ passwordHash, passwordChangedAt });
  loginAccountCooldown.clearLoginCooldown(cooldownKey(account.studentId));
  return account;
}

async function findActiveBySso(provider, subject) {
  const ssoProvider = String(provider || '').trim();
  const ssoSubject = String(subject || '').trim();
  if (!ssoProvider || !ssoSubject) return null;
  return StudentAccount.findOne({
    where: { ssoProvider, ssoSubject, status: 'active' },
  });
}

module.exports = {
  TOKEN_TYP,
  normalizeStudentId,
  normalizeEmail,
  normalizeName,
  toPublicAccount,
  signStudentToken,
  registerAccount,
  loginAccount,
  changePassword,
  replaceLocalPassword,
  findActiveBySso,
};
