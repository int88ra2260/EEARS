// routes/loginRouter.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { secretKey } = require('../middlewares/auth');
const { Teacher, sequelize } = require('../models');
const auditLogService = require('../services/auditLogService');
const logger = require('../utils/logger');
const loginAccountCooldown = require('../utils/loginAccountCooldown');

/** 記憶體 IP 限流（無新套件）：僅限制 POST 頻率，不鎖帳號、不洩漏帳號是否存在 */
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS_PER_WINDOW = 45;
const loginIpBuckets = new Map();

const HIGH_PRIVILEGE_LOGIN_ROLES = new Set(['admin']);

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim();
  }
  if (req.ip) return String(req.ip);
  return req.socket?.remoteAddress || 'unknown';
}

function pruneLoginBuckets() {
  if (loginIpBuckets.size < 5000) return;
  const now = Date.now();
  for (const [ip, b] of loginIpBuckets) {
    if (now > b.resetAt) loginIpBuckets.delete(ip);
  }
}

function checkLoginRateLimit(req) {
  pruneLoginBuckets();
  const ip = clientIp(req);
  const now = Date.now();
  let b = loginIpBuckets.get(ip);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + LOGIN_RATE_WINDOW_MS };
    loginIpBuckets.set(ip, b);
  }
  if (b.count >= LOGIN_MAX_ATTEMPTS_PER_WINDOW) {
    return false;
  }
  b.count += 1;
  return true;
}

function buildLoginSecurityMeta(req, username, extra = {}) {
  const meta = auditLogService.metaFromReq(req);
  return {
    usernameMasked: loginAccountCooldown.maskUsernameForAudit(username),
    usernameHash: loginAccountCooldown.usernameHashForAudit(username),
    requestId: meta.requestId || null,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent ? String(meta.userAgent).slice(0, 200) : null,
    ...extra,
  };
}

function logLoginSecurity(req, action, opts = {}) {
  auditLogService.logSecurityAuditImmediate(req, {
    module: 'auth',
    action,
    entityType: 'Teacher',
    entityId: opts.entityId != null ? String(opts.entityId) : 'login',
    targetSummary: opts.targetSummary || action,
    status: opts.status || 'success',
    errorMessage: opts.errorMessage || null,
    afterData: buildLoginSecurityMeta(req, opts.username || '', opts.afterData || {}),
    operatorId: opts.operatorId != null ? opts.operatorId : null,
    operatorRole: opts.operatorRole || null,
    operatorName: opts.operatorName || null,
  });
}

function respondLoginCooldown(res, retryAfterSeconds) {
  return res.status(429).json({
    success: false,
    code: 'LOGIN_COOLDOWN',
    message: '登入失敗次數過多，請稍後再試。',
    retryAfterSeconds: retryAfterSeconds || 1800,
    error: '登入失敗次數過多，請稍後再試。',
  });
}

function handleFailedLogin(req, res, username, reasonCode, teacherId = null) {
  auditLogService.queueAuthLoginFailure(req, username, teacherId, reasonCode);

  logLoginSecurity(req, 'login_failed', {
    username,
    entityId: teacherId != null ? teacherId : 'unresolved',
    status: 'failed',
    errorMessage: reasonCode,
    afterData: { reasonCode },
  });

  const failureResult = loginAccountCooldown.recordLoginFailure(username);

  if (failureResult.triggered) {
    logLoginSecurity(req, 'login_cooldown_triggered', {
      username,
      entityId: teacherId != null ? teacherId : 'unresolved',
      status: 'failed',
      errorMessage: 'COOLDOWN',
      afterData: {
        reasonCode: 'COOLDOWN',
        failureCount: failureResult.failureCount,
        retryAfterSeconds: failureResult.retryAfterSeconds,
      },
    });
  }

  return res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
}

// POST /api/login
router.post('/login', (req, res, next) => {
  if (!checkLoginRateLimit(req)) {
    return res.status(429).json({ error: '登入嘗試過於頻繁，請稍後再試。' });
  }
  next();
}, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: '缺少帳號或密碼' });
    }

    const normalizedUsername = loginAccountCooldown.normalizeUsername(username);
    const cooldownCheck = loginAccountCooldown.checkLoginCooldown(username);
    if (cooldownCheck.blocked) {
      logLoginSecurity(req, 'login_blocked_by_cooldown', {
        username,
        entityId: 'cooldown',
        status: 'failed',
        errorMessage: 'COOLDOWN',
        afterData: {
          reasonCode: 'COOLDOWN',
          retryAfterSeconds: cooldownCheck.retryAfterSeconds,
        },
      });
      return respondLoginCooldown(res, cooldownCheck.retryAfterSeconds);
    }

    const teacher = await Teacher.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('username')),
        normalizedUsername
      ),
    });

    if (!teacher) {
      return handleFailedLogin(req, res, username, 'USER_NOT_FOUND');
    }
    if (!teacher.isActive) {
      return handleFailedLogin(req, res, username, 'ACCOUNT_DISABLED', teacher.id);
    }

    const isValidPassword = await bcrypt.compare(password, teacher.password);
    if (!isValidPassword) {
      return handleFailedLogin(req, res, username, 'PASSWORD_INVALID', teacher.id);
    }

    loginAccountCooldown.clearLoginCooldown(username);

    const payload = {
      id: teacher.id,
      role: teacher.role,
      user: teacher.username,
      name: teacher.name,
      mustResetPassword: teacher.mustResetPassword,
      teacherLevel: teacher.teacherLevel || 'regular',
      staffLevel: teacher.staffLevel || null,
      accessVersion: teacher.accessVersion || 1,
      permissions: teacher.permissions || null,
      scopes: Array.isArray(teacher.scopes) ? teacher.scopes : null,
    };

    const token = jwt.sign(payload, secretKey, { expiresIn: '4h' });

    await teacher.update({ lastLoginAt: new Date() });

    const successMeta = buildLoginSecurityMeta(req, username, {
      reasonCode: 'SUCCESS',
      role: teacher.role,
    });

    auditLogService.logAudit({
      module: 'auth',
      action: 'login_success',
      entityType: 'Teacher',
      entityId: String(teacher.id),
      targetSummary: loginAccountCooldown.maskUsernameForAudit(username),
      afterData: successMeta,
      operatorId: teacher.id,
      operatorRole: teacher.role,
      operatorName: teacher.name,
      req,
      immediate: true,
    });

    if (HIGH_PRIVILEGE_LOGIN_ROLES.has(teacher.role)) {
      logLoginSecurity(req, 'login_success_admin', {
        username,
        entityId: teacher.id,
        operatorId: teacher.id,
        operatorRole: teacher.role,
        operatorName: teacher.name,
        afterData: { reasonCode: 'SUCCESS', role: teacher.role },
      });
    }

    return res.json({
      message: '登入成功',
      token,
      role: teacher.role,
      teacherLevel: teacher.teacherLevel || 'regular',
      staffLevel: teacher.staffLevel || null,
      mustResetPassword: teacher.mustResetPassword,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        username: teacher.username,
        email: teacher.email,
        role: teacher.role,
        teacherLevel: teacher.teacherLevel || 'regular',
        staffLevel: teacher.staffLevel || null,
        accessVersion: teacher.accessVersion || 1,
        permissions: teacher.permissions || null,
        scopes: Array.isArray(teacher.scopes) ? teacher.scopes : null,
      },
    });
  } catch (error) {
    logger.error('登入錯誤', error);
    return res.status(500).json({ success: false, error: '登入過程中發生錯誤' });
  }
});

module.exports = router;
