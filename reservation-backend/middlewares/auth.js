// middlewares/auth.js — JWT 驗證 + 統一權限中心（相容舊匯出名稱）
const jwt = require('jsonwebtoken');
const { createAPIError, logError } = require('../utils/errorMessages');
const {
  buildAccessProfile,
  attachAccessProfile,
  resolveEffectiveAccessSources,
  getAccessProfileReadMode,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessEventType,
  canAccessSurvey,
  isDeputyManagerUser,
  isBestepLeadUser,
} = require('../auth/accessProfile');
const { P } = require('../auth/permissions');
const { Teacher } = require('../models');
const logger = require('../utils/logger');
const { secretKey } = require('../config/jwtSecret');
const auditLogService = require('../services/auditLogService');
const { enforceDemoAccount, applyDemoResponseGuard, isDemoUser } = require('./demoAccountGuard');

/** 權限拒絕時寫入稽核（避免洗版：僅高風險 permission） */
const AUDIT_ON_DENIED_PERMISSIONS = new Set([
  P.CAN_MANAGE_ACCOUNTS,
  P.CAN_MANAGE_SETTINGS,
  P.CAN_VIEW_AUDIT_LOGS,
  P.CAN_VIEW_INTERNAL_DIAGNOSTICS,
  P.CAN_MANAGE_ENGLISH_TEST_TRACKING,
]);

function buildAuthLogContext(req) {
  const method = req?.method || 'UNKNOWN';
  const path = req?.originalUrl || req?.url || 'unknown-path';
  const ip = req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown-ip';
  const ua = req?.get?.('user-agent') || req?.headers?.['user-agent'] || 'unknown-ua';
  const area = String(path).startsWith('/api/admin') ? 'admin' : 'public';
  return `${method} ${path} - area=${area} - ip=${ip} - ua=${ua}`;
}

function sendForbidden(res, message) {
  const apiError = createAPIError('INSUFFICIENT_PERMISSIONS', 403, message || undefined);
  return res.status(403).json({
    ...apiError,
    code: 'INSUFFICIENT_PERMISSIONS',
    success: false,
  });
}

function sendPasswordResetRequired(res) {
  return res.status(403).json({
    success: false,
    code: 'PASSWORD_RESET_REQUIRED',
    message: 'Password reset is required before accessing this resource.',
  });
}

function normalizePath(path) {
  return String(path || '')
    .split('?')[0]
    .replace(/\/+$/, '');
}

function isPasswordResetExemptPath(req) {
  const method = String(req?.method || '').toUpperCase();
  const path = normalizePath(req?.originalUrl || req?.url);
  const allowlist = [
    { method: 'POST', path: '/api/teachers/change-password' },
  ];
  return allowlist.some((rule) => rule.method === method && rule.path === path);
}

function enforcePasswordResetMiddleware(req, res, next) {
  if (req.user?.mustResetPassword === true && !isPasswordResetExemptPath(req)) {
    return sendPasswordResetRequired(res);
  }
  return next();
}

function sendStaleToken(req, res, latestAccessVersion, tokenVersion) {
  try {
    const u = req.user || {};
    auditLogService.logSecurityAuditImmediate(req, {
      module: 'auth',
      action: 'access_profile_stale',
      entityType: 'Teacher',
      entityId: u.id != null ? String(u.id) : 'unknown',
      targetSummary: u.user || u.username || (u.id != null ? String(u.id) : ''),
      afterData: {
        teacherId: u.id != null ? u.id : null,
        username: u.user || u.username || null,
        jwtAccessVersion: tokenVersion != null ? Number(tokenVersion) : null,
        dbAccessVersion: latestAccessVersion != null ? Number(latestAccessVersion) : null,
        path: String(req.originalUrl || req.url || ''),
        method: String(req.method || ''),
        requestId: req.requestId || null,
      },
      status: 'failed',
      errorMessage: 'ACCESS_PROFILE_STALE',
      operatorId: u.id != null ? u.id : null,
      operatorRole: u.role || null,
      operatorName: u.name || u.user || null,
    });
  } catch (_) {
    /* 稽核失敗不阻擋回應 */
  }
  return res.status(401).json({
    code: 'ACCESS_PROFILE_STALE',
    error: '權限資料已更新，請重新登入',
    message: 'Access profile changed, please login again',
    actionHint: 'relogin',
    latestAccessVersion: latestAccessVersion != null ? Number(latestAccessVersion) : null,
  });
}

function sendAccountDisabled(req, res) {
  try {
    const u = req.user || {};
    auditLogService.logSecurityAuditImmediate(req, {
      module: 'auth',
      action: 'account_disabled_access_attempt',
      entityType: 'Teacher',
      entityId: u.id != null ? String(u.id) : 'unknown',
      targetSummary: u.user || u.username || (u.id != null ? String(u.id) : ''),
      afterData: {
        teacherId: u.id != null ? u.id : null,
        username: u.user || u.username || null,
        path: String(req.originalUrl || req.url || ''),
        method: String(req.method || ''),
        requestId: req.requestId || null,
      },
      status: 'failed',
      errorMessage: 'ACCOUNT_DISABLED',
      operatorId: u.id != null ? u.id : null,
      operatorRole: u.role || null,
      operatorName: u.name || u.user || null,
    });
  } catch (_) {
    /* ignore */
  }
  return res.status(401).json({
    code: 'ACCOUNT_DISABLED',
    error: '此帳號已停用，請聯絡管理員',
    message: 'Account is disabled; contact an administrator.',
    actionHint: 'relogin',
  });
}

function parseCsvSet(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function isEnabled(name, defaultValue = false) {
  const val = process.env[name];
  if (val == null || val === '') return defaultValue;
  return String(val).toLowerCase() === 'true' || String(val) === '1';
}

let warnedProdAccessVersionDisabled = false;

/**
 * production：一律視為啟用 accessVersion 強制檢查（ACCESS_VERSION_CHECK_ENABLED=false 僅會被忽略並警告）。
 * development / test：僅當 ACCESS_VERSION_CHECK_ENABLED=true 時啟用。
 */
function isAccessVersionCheckEnabled() {
  if (process.env.NODE_ENV === 'production') {
    if (String(process.env.ACCESS_VERSION_CHECK_ENABLED || '').toLowerCase() === 'false') {
      if (!warnedProdAccessVersionDisabled) {
        warnedProdAccessVersionDisabled = true;
        // eslint-disable-next-line no-console
        console.warn(
          '[EEARS][auth] ACCESS_VERSION_CHECK_ENABLED=false is ignored in production; access version enforcement remains on.'
        );
      }
    }
    return true;
  }
  return isEnabled('ACCESS_VERSION_CHECK_ENABLED', false);
}

function shouldEnforceStaleForRequest(req, user) {
  if (!isAccessVersionCheckEnabled()) return false;
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  const roles = parseCsvSet(process.env.ACCESS_VERSION_ENFORCE_ROLES || '');
  const prefixes = parseCsvSet(process.env.ACCESS_VERSION_ENFORCE_PATH_PREFIXES || '/api/admin');
  const path = String(req?.originalUrl || req?.url || '');
  const role = String(user?.role || '');

  const roleMatch = roles.size ? roles.has(role) : false;
  const pathMatch = Array.from(prefixes).some((p) => path.startsWith(p));
  return roleMatch || pathMatch;
}

/**
 * 單次 DB 讀取：帳號是否存在、是否啟用、accessVersion 是否與 JWT 一致。
 * @returns {{ kind: 'missing'|'inactive'|'active', mismatch: boolean, tokenVersion: number|null, dbVersion: number|null }}
 */
async function assessTeacherSecurityGate(user, req, mode = 'auth') {
  if (!user || !user.id) {
    return { kind: 'missing', mismatch: false, tokenVersion: null, dbVersion: null };
  }
  const t = await Teacher.findByPk(user.id, { attributes: ['id', 'isActive', 'accessVersion'] });
  if (!t) {
    return { kind: 'missing', mismatch: false, tokenVersion: null, dbVersion: null };
  }
  if (!t.isActive) {
    return { kind: 'inactive', mismatch: false, tokenVersion: null, dbVersion: null };
  }
  const tokenVersion = Number(user.accessVersion || 0);
  const dbVersion = Number(t.accessVersion || 1);
  const mismatch = tokenVersion !== dbVersion;

  if (mismatch) {
    const payload = {
      type: 'access_version_mismatch',
      mode,
      method: req?.method || 'UNKNOWN',
      path: req?.originalUrl || req?.url || '',
      requestId: req?.requestId || null,
      userId: user.id,
      role: user.role || null,
      tokenVersion,
      dbVersion,
      enforceEligible: shouldEnforceStaleForRequest(req, user),
      readMode: getAccessProfileReadMode(),
    };
    logger.warn('access version mismatch detected');
    console.log(JSON.stringify(payload));
  }

  return { kind: 'active', mismatch, tokenVersion, dbVersion };
}

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logError('TOKEN_MISSING', null, `${buildAuthLogContext(req)} - Authorization header missing`);
      const apiError = createAPIError('TOKEN_MISSING', 401);
      return res.status(401).json(apiError);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      logError('TOKEN_MISSING', null, `${buildAuthLogContext(req)} - Token format error`);
      const apiError = createAPIError('TOKEN_INVALID', 401);
      return res.status(401).json(apiError);
    }

    jwt.verify(token, secretKey, async (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          logError('TOKEN_EXPIRED', err, `Token expired at ${err.expiredAt}`);
          const apiError = createAPIError('TOKEN_EXPIRED', 401);
          return res.status(401).json(apiError);
        }
        if (err.name === 'JsonWebTokenError') {
          logError('TOKEN_INVALID', err, 'Invalid token format');
          const apiError = createAPIError('TOKEN_INVALID', 401);
          return res.status(401).json(apiError);
        }
        logError('TOKEN_INVALID', err, 'Token verification failed');
        const apiError = createAPIError('TOKEN_INVALID', 401);
        return res.status(401).json(apiError);
      }
      req.user = decoded;
      let gate;
      try {
        gate = await assessTeacherSecurityGate(decoded, req, 'auth');
      } catch (e) {
        logError('TOKEN_INVALID', e, 'assessTeacherSecurityGate(authMiddleware)');
        const apiError = createAPIError('TOKEN_INVALID', 401);
        return res.status(401).json(apiError);
      }
      if (gate.kind === 'missing') {
        const apiError = createAPIError('TOKEN_INVALID', 401);
        return res.status(401).json(apiError);
      }
      if (gate.kind === 'inactive') {
        return sendAccountDisabled(req, res);
      }
      try {
        req.user = await resolveEffectiveAccessSources(req.user);
        if (req.user && req.user.__effectiveSource === 'json_fallback') {
          console.log(JSON.stringify({
            type: 'access_profile_json_fallback_used',
            userId: req.user.id,
            role: req.user.role || null,
            teacherLevel: req.user.teacherLevel || null,
            path: req.originalUrl || req.url || '',
            requestId: req.requestId || null,
          }));
        }
      } catch (e) {
        logError('INSUFFICIENT_PERMISSIONS', e, 'resolveEffectiveAccessSources(authMiddleware)');
      }
      attachAccessProfile(req);
      try {
        if (gate.mismatch) {
          req.accessVersionMismatch = { token: gate.tokenVersion, current: gate.dbVersion, mode: 'observe' };
          if (shouldEnforceStaleForRequest(req, req.user)) {
            return sendStaleToken(req, res, gate.dbVersion, gate.tokenVersion);
          }
        }
      } catch (e) {
        logError('TOKEN_INVALID', e, 'accessVersion check failed');
      }
      if (enforceDemoAccount(req, res)) return undefined;
      return enforcePasswordResetMiddleware(req, res, next);
    });
  } catch (error) {
    logError('TOKEN_INVALID', error, 'Authentication middleware error');
    const apiError = createAPIError('TOKEN_INVALID', 401);
    res.status(401).json(apiError);
  }
}

/** 後登入後附加 accessProfile（不依賴 JWT 時勿用） */
function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next();
    const token = authHeader.split(' ')[1];
    if (!token) return next();
    jwt.verify(token, secretKey, async (err, decoded) => {
      if (!err && decoded) {
        let gate;
        try {
          gate = await assessTeacherSecurityGate(decoded, req, 'optional');
        } catch (e) {
          logError('TOKEN_INVALID', e, 'assessTeacherSecurityGate(optionalAuthMiddleware)');
          return next();
        }
        if (gate.kind === 'missing' || gate.kind === 'inactive') {
          return next();
        }
        req.user = decoded;
        try {
          req.user = await resolveEffectiveAccessSources(req.user);
        } catch (e) {
          logError('INSUFFICIENT_PERMISSIONS', e, 'resolveEffectiveAccessSources(optionalAuthMiddleware)');
        }
        attachAccessProfile(req);
        if (gate.mismatch) {
          req.accessVersionMismatch = { token: gate.tokenVersion, current: gate.dbVersion, mode: 'observe' };
        }
        if (isDemoUser(req)) {
          applyDemoResponseGuard(req, res);
        }
      }
      next();
    });
  } catch (_) {
    next();
  }
}

/**
 * @param {string} permission
 * @param {string} [message]
 */
function requirePermission(permission, message) {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return sendForbidden(res, message || '權限不足');
      }
      if (!hasPermission(req.user, permission)) {
        logError(
          'INSUFFICIENT_PERMISSIONS',
          null,
          `Missing permission: ${permission} user=${req.user.role}/${req.user.teacherLevel || ''}`
        );
        if (AUDIT_ON_DENIED_PERMISSIONS.has(permission)) {
          try {
            const u = req.user || {};
            const prof = req.accessProfile || buildAccessProfile(u);
            auditLogService.logSecurityAuditImmediate(req, {
              module: 'auth',
              action: 'permission_denied',
              entityType: 'Teacher',
              entityId: u.id != null ? String(u.id) : 'unknown',
              targetSummary: String(req.originalUrl || req.url || '').slice(0, 500),
              afterData: {
                requiredPermission: permission,
                role: u.role || null,
                teacherLevel: u.teacherLevel || null,
                path: String(req.originalUrl || req.url || ''),
                method: String(req.method || ''),
                permissionSummary: Array.from(prof.permissionSet || []).slice(0, 80),
              },
              status: 'failed',
              errorMessage: 'PERMISSION_DENIED',
              operatorId: u.id != null ? u.id : null,
              operatorRole: u.role || null,
              operatorName: u.name || u.user || null,
            });
          } catch (_) {
            /* ignore */
          }
        }
        return sendForbidden(res, message || '權限不足');
      }
      next();
    } catch (error) {
      logError('INSUFFICIENT_PERMISSIONS', error, 'requirePermission');
      return sendForbidden(res, message || '權限不足');
    }
  };
}

function requireAnyPermission(permissions, message) {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return sendForbidden(res, message || '權限不足');
      }
      if (!hasAnyPermission(req.user, permissions)) {
        logError('INSUFFICIENT_PERMISSIONS', null, `Missing any of: ${permissions.join(',')}`);
        return sendForbidden(res, message || '權限不足');
      }
      next();
    } catch (error) {
      logError('INSUFFICIENT_PERMISSIONS', error, 'requireAnyPermission');
      return sendForbidden(res, message || '權限不足');
    }
  };
}

function requireAllPermissions(permissions, message) {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return sendForbidden(res, message || '權限不足');
      }
      if (!hasAllPermissions(req.user, permissions)) {
        logError('INSUFFICIENT_PERMISSIONS', null, `Missing all required: ${permissions.join(',')}`);
        return sendForbidden(res, message || '權限不足');
      }
      next();
    } catch (error) {
      logError('INSUFFICIENT_PERMISSIONS', error, 'requireAllPermissions');
      return sendForbidden(res, message || '權限不足');
    }
  };
}

/** 僅系統角色 admin（不含執行長） */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return sendForbidden(res, '需要系統管理員身分');
  }
  next();
}

/** admin 或執行長（舊 adminMiddleware 語意） */
function requireAdminRights(req, res, next) {
  const profile = req.accessProfile || buildAccessProfile(req.user);
  if (!profile.hasAdminRights) {
    return sendForbidden(res, '需要管理權限（管理員或執行長）');
  }
  next();
}

/** 語意化別名：網域管理權（admin 或 executive） */
function adminOrExecutiveMiddleware(req, res, next) {
  return requireAdminRights(req, res, next);
}

/**
 * 網域管理權：admin、executive、或行政副理。
 * 仍須搭配 requirePermission；勿用於副理未授權之端點（如班級刪除）。
 */
function adminExecutiveOrDeputyMiddleware(req, res, next) {
  if (!req.user || !req.user.role) {
    return sendForbidden(res, '權限不足');
  }
  if (req.user.role === 'admin') return next();
  const profile = req.accessProfile || buildAccessProfile(req.user);
  if (profile.hasAdminRights) return next();
  if (isDeputyManagerUser(req.user)) return next();
  return sendForbidden(res, '需要管理權限（管理員、執行長或副理）');
}

/**
 * 培力英檢網域：admin、executive、副理、或培力英檢行政。
 * 仍須搭配 requirePermission。
 */
function englishTestDomainMiddleware(req, res, next) {
  if (!req.user || !req.user.role) {
    return sendForbidden(res, '權限不足');
  }
  if (req.user.role === 'admin') return next();
  const profile = req.accessProfile || buildAccessProfile(req.user);
  if (profile.hasAdminRights) return next();
  if (isDeputyManagerUser(req.user)) return next();
  if (isBestepLeadUser(req.user)) return next();
  return sendForbidden(res, '需要培力英檢管理權限（管理員、執行長、副理或培力英檢行政）');
}

function adminOrTeacherMiddleware(req, res, next) {
  const user = req.user || {};
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return next();
  if (role === 'teacher') return next();
  return sendForbidden(res, '需要管理員或教師身分');
}

/** 語意化別名：系統管理員限定（admin only） */
function adminOnlyMiddleware(req, res, next) {
  return requireAdmin(req, res, next);
}

function requireTeacher(req, res, next) {
  try {
    if (!req.user || !req.user.role) {
      return sendForbidden(res, '權限不足');
    }
    if (req.user.role !== 'admin' && req.user.role !== 'teacher' && req.user.role !== 'office_staff') {
      return sendForbidden(res, '需要教師或管理員身分');
    }
    next();
  } catch (error) {
    logError('INSUFFICIENT_PERMISSIONS', error, 'requireTeacher');
    return sendForbidden(res, '權限不足');
  }
}

/**
 * 系統級權限：僅限 role==='admin'（executive 也不可）
 * @param {string} permission
 * @param {string} [message]
 */
function requireSystemPermission(permission, message) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return sendForbidden(res, message || '僅限系統管理員');
    }
    return requirePermission(permission, message)(req, res, next);
  };
}

/**
 * 由 query/body/param 讀取 eventType 並檢查
 * @param {string} source - 'query'|'body'|'params'
 * @param {string} key - 欄位名，預設 eventType
 */
function requireEventTypeAccess(source = 'query', key = 'eventType') {
  return (req, res, next) => {
    const bag = source === 'body' ? req.body : source === 'params' ? req.params : req.query;
    const eventType = bag && bag[key];
    if (!canAccessEventType(req.user, eventType)) {
      return sendForbidden(res, '無權限存取此活動類型');
    }
    next();
  };
}

/**
 * 從 params 讀取 surveyId
 */
function requireSurveyAccess(paramKey = 'surveyId') {
  return (req, res, next) => {
    const surveyId = req.params[paramKey];
    if (!canAccessSurvey(req.user, surveyId)) {
      return sendForbidden(res, '無權限存取此問卷');
    }
    next();
  };
}

function hasScope(profile, scope) {
  const scopes = profile?.finalScopes || [];
  return scopes.includes('all') || scopes.includes(scope);
}

function requireScope(scope, message) {
  return (req, res, next) => {
    const profile = req.accessProfile || buildAccessProfile(req.user);
    if (!hasScope(profile, scope)) {
      return sendForbidden(res, message || `缺少範圍權限：${scope}`);
    }
    next();
  };
}

function requireAnyScope(scopes, message) {
  return (req, res, next) => {
    const profile = req.accessProfile || buildAccessProfile(req.user);
    const ok = (scopes || []).some((s) => hasScope(profile, s));
    if (!ok) return sendForbidden(res, message || '缺少範圍權限');
    next();
  };
}

function requirePermissionAndScope(permission, scopes, message) {
  return (req, res, next) => {
    if (!hasPermission(req.user, permission)) {
      return sendForbidden(res, message || '權限不足');
    }
    const profile = req.accessProfile || buildAccessProfile(req.user);
    const ok = (scopes || []).some((s) => hasScope(profile, s));
    if (!ok) return sendForbidden(res, message || '缺少範圍權限');
    next();
  };
}

function requireEventAccess(getEventTypeFromReq) {
  return async (req, res, next) => {
    try {
      const eventType = typeof getEventTypeFromReq === 'function' ? await getEventTypeFromReq(req) : undefined;
      if (!canAccessEventType(req.user, eventType)) {
        return sendForbidden(res, '無權限存取此活動類型');
      }
      next();
    } catch (error) {
      logError('INSUFFICIENT_PERMISSIONS', error, 'requireEventAccess');
      return sendForbidden(res, '無權限存取此活動類型');
    }
  };
}

function requireSurveyAccessBy(getSurveyIdFromReq, message) {
  return (req, res, next) => {
    const surveyId = typeof getSurveyIdFromReq === 'function' ? getSurveyIdFromReq(req) : req.params.surveyId;
    if (!canAccessSurvey(req.user, surveyId)) {
      return sendForbidden(res, message || '無權限存取此問卷');
    }
    next();
  };
}

function requirePermissionAndEventAccess(permission, getEventTypeFromReq, message) {
  return async (req, res, next) => {
    try {
      if (!hasPermission(req.user, permission)) {
        return sendForbidden(res, message || '權限不足');
      }
      const eventType = typeof getEventTypeFromReq === 'function' ? await getEventTypeFromReq(req) : undefined;
      if (!canAccessEventType(req.user, eventType)) {
        return sendForbidden(res, message || '無權限存取此活動類型');
      }
      next();
    } catch (error) {
      logError('INSUFFICIENT_PERMISSIONS', error, 'requirePermissionAndEventAccess');
      return sendForbidden(res, message || '權限不足');
    }
  };
}

// --- 相容層：舊名稱，內部改用權限中心 ---

function adminMiddleware(req, res, next) {
  // backward-compatible alias: adminMiddleware === adminOrExecutiveMiddleware
  return adminOrExecutiveMiddleware(req, res, next);
}

function workerMiddleware(req, res, next) {
  try {
    if (!req.user || !req.user.role) {
      logError('INSUFFICIENT_PERMISSIONS', null, 'User role not found in request');
      return sendForbidden(res, '權限不足');
    }
    const { role } = req.user;
    if (role !== 'admin' && role !== 'worker' && role !== 'teacher' && role !== 'office_staff') {
      logError('INSUFFICIENT_PERMISSIONS', null, `User role '${role}' is not admin, worker, teacher or office_staff`);
      return sendForbidden(res, '權限不足');
    }
    next();
  } catch (error) {
    logError('INSUFFICIENT_PERMISSIONS', error, 'Worker middleware error');
    return sendForbidden(res, '權限不足');
  }
}

function workerOnlyMiddleware(req, res, next) {
  try {
    if (!req.user || !req.user.role) {
      return sendForbidden(res, '權限不足');
    }
    if (req.user.role !== 'worker') {
      return sendForbidden(res, '僅限工讀生帳號');
    }
    next();
  } catch (error) {
    logError('INSUFFICIENT_PERMISSIONS', error, 'Worker-only middleware error');
    return sendForbidden(res, '權限不足');
  }
}

function teacherMiddleware(req, res, next) {
  return requireTeacher(req, res, next);
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  attachAccessProfile,
  buildAccessProfile,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireSystemPermission,
  requireAdmin,
  requireAdminRights,
  adminOnlyMiddleware,
  adminOrExecutiveMiddleware,
  adminExecutiveOrDeputyMiddleware,
  englishTestDomainMiddleware,
  adminOrTeacherMiddleware,
  requireTeacher,
  requireScope,
  requireAnyScope,
  requirePermissionAndScope,
  requireEventTypeAccess,
  requireEventAccess,
  requirePermissionAndEventAccess,
  requireSurveyAccess,
  requireSurveyAccessBy,
  adminMiddleware,
  workerMiddleware,
  workerOnlyMiddleware,
  teacherMiddleware,
  canViewEventType: canAccessEventType,
  canViewSurvey: canAccessSurvey,
  canAccessEventType,
  canAccessSurvey,
  secretKey,
  getAccessProfileReadMode,
  shouldEnforceStaleForRequest,
  isAccessVersionCheckEnabled,
  enforcePasswordResetMiddleware,
  P,
};
