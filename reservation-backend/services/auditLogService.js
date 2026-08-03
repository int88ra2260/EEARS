const { AuditLog } = require('../models');
const logger = require('../utils/logger');
const { sanitizeForAudit } = require('../utils/logSanitizer');

/**
 * 遞迴移除／遮罩敏感欄位，避免寫入 audit JSON
 */
// sanitizeForAudit 已移到共用 util（避免 audit/email 行為不一致）

function diffShallow(before, after) {
  if (!before || !after) return null;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = {};
  for (const k of keys) {
    const b = JSON.stringify(before[k]);
    const a = JSON.stringify(after[k]);
    if (b !== a) changed[k] = { before: before[k], after: after[k] };
  }
  return Object.keys(changed).length ? changed : null;
}

function operatorFromReq(req) {
  if (!req || !req.user) {
    return { operatorId: null, operatorRole: null, operatorName: null };
  }
  const u = req.user;
  return {
    operatorId: u.id != null ? u.id : null,
    operatorRole: u.role || null,
    operatorName: u.name || u.user || null,
  };
}

function metaFromReq(req) {
  if (!req) {
    return { requestId: null, ipAddress: null, userAgent: null };
  }
  const fwd = req.headers && req.headers['x-forwarded-for'];
  const ip =
    (typeof fwd === 'string' && fwd.split(',')[0].trim()) ||
    req.ip ||
    (req.socket && req.socket.remoteAddress) ||
    null;
  const ua = req.headers && req.headers['user-agent'];
  return {
    requestId: req.requestId || null,
    traceId: req.traceId || req.headers?.['x-trace-id'] || null,
    ipAddress: ip,
    userAgent: typeof ua === 'string' ? ua.slice(0, 500) : null,
  };
}

function parseEnvInt(name, defaultVal) {
  const v = process.env[name];
  if (v == null || v === '') return defaultVal;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : defaultVal;
}

/** 登入失敗聚合間隔（毫秒）；0＝不聚合，每筆立即寫入（舊行為） */
const LOGIN_FAILURE_AGGREGATE_MS = parseEnvInt('AUDIT_LOGIN_FAILURE_AGGREGATE_MS', 5000);

// —— 一般稽核：bulkCreate 緩衝（降低高頻寫入壓力）——
const pending = [];
let flushTimer = null;
let flushing = false;

async function flushAuditNow() {
  if (flushing) return;
  const batch = pending.splice(0, pending.length);
  if (!batch.length) return;
  flushing = true;
  try {
    await AuditLog.bulkCreate(batch, { validate: false });
  } catch (e) {
    logger.error('auditLog bulkCreate 失敗', e);
  } finally {
    flushing = false;
    if (pending.length) scheduleAuditFlush();
  }
}

function scheduleAuditFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushAuditNow().catch(() => {});
  }, 2000);
  if (flushTimer.unref) flushTimer.unref();
}

// —— 登入失敗：時間窗內合併為單筆（減少 brute-force 刷表）——
const loginFailureBuckets = new Map();
let loginFlushTimer = null;

function scheduleLoginFailureFlush() {
  if (LOGIN_FAILURE_AGGREGATE_MS <= 0) return;
  if (loginFlushTimer) return;
  loginFlushTimer = setTimeout(() => {
    loginFlushTimer = null;
    flushLoginFailureBuckets().catch(() => {});
  }, LOGIN_FAILURE_AGGREGATE_MS);
  if (loginFlushTimer.unref) loginFlushTimer.unref();
}

async function flushLoginFailureBuckets() {
  if (!loginFailureBuckets.size) return;
  const entries = [...loginFailureBuckets.entries()];
  loginFailureBuckets.clear();
  for (const [, bucket] of entries) {
    const { count, samples, lastReq, minuteKey, ip, reasons } = bucket;
    const entityId = `login_failure:${ip}:${minuteKey}`.slice(0, 64);
    await logAudit({
      module: 'auth',
      action: 'login_failure',
      entityType: 'AuditAggregate',
      entityId,
      targetSummary: `aggregate count=${count} window=${minuteKey}`,
      afterData: {
        aggregate: true,
        count,
        sampleUsernames: samples,
        ip,
        reasons: reasons && typeof reasons === 'object' ? reasons : {},
      },
      status: 'failed',
      errorMessage: 'login_failure_aggregate',
      req: lastReq,
      immediate: true,
    });
  }
}

/**
 * 登入失敗稽核（高頻時改為時間窗摘要）
 * @param {import('express').Request} req
 * @param {string} username
 * @param {number|string|null|undefined} teacherId 帳號存在但密碼錯誤時帶入，便於 entityId 收斂
 * @param {'USER_NOT_FOUND'|'PASSWORD_INVALID'|'ACCOUNT_DISABLED'|undefined} [reason]
 */
function queueAuthLoginFailure(req, username, teacherId, reason) {
  const r = reason && String(reason).trim() ? String(reason).trim().slice(0, 64) : 'UNKNOWN';

  if (LOGIN_FAILURE_AGGREGATE_MS <= 0) {
    const entityId =
      teacherId != null && teacherId !== undefined ? String(teacherId) : 'unresolved';
    logAudit({
      module: 'auth',
      action: 'login_failure',
      entityType: 'Teacher',
      entityId,
      targetSummary: `username=${String(username).slice(0, 64)}`,
      status: 'failed',
      errorMessage: r,
      afterData: { reason: r },
      req,
      immediate: true,
    });
    return;
  }

  const meta = metaFromReq(req);
  const ip = meta.ipAddress || 'unknown';
  const minuteKey = Math.floor(Date.now() / 60000);
  const mapKey = `${ip}:${minuteKey}`;

  let b = loginFailureBuckets.get(mapKey);
  if (!b) {
    b = { count: 0, samples: [], lastReq: req, minuteKey, ip, reasons: {} };
    loginFailureBuckets.set(mapKey, b);
  }
  b.count += 1;
  b.reasons[r] = (b.reasons[r] || 0) + 1;
  if (username && b.samples.length < 8) {
    b.samples.push(String(username).slice(0, 64));
  }
  b.lastReq = req;
  scheduleLoginFailureFlush();
}

/**
 * 帳號安全／治理事件（立即寫入；不含 token／密碼）
 * @param {import('express').Request} req
 * @param {object} opts
 */
function logSecurityAuditImmediate(req, opts = {}) {
  const mod = opts.module || 'auth';
  const {
    action,
    entityType = 'Teacher',
    entityId = 'unknown',
    targetSummary = null,
    beforeData = null,
    afterData = null,
    status = 'success',
    errorMessage = null,
    operatorId = null,
    operatorRole = null,
    operatorName = null,
  } = opts;
  if (!action) return;
  logAudit({
    module: mod,
    action,
    entityType,
    entityId: entityId != null ? String(entityId).slice(0, 64) : 'unknown',
    targetSummary,
    beforeData: beforeData ? sanitizeForAudit(beforeData) : null,
    afterData: afterData ? sanitizeForAudit(afterData) : null,
    status,
    errorMessage,
    req,
    operatorId,
    operatorRole,
    operatorName,
    immediate: true,
  });
}

function buildAuditRow(payload) {
  const {
    module: mod,
    action,
    entityType = undefined,
    entityId = undefined,
    targetSummary = null,
    beforeData = null,
    afterData = null,
    changedFields = null,
    status = 'success',
    errorMessage = null,
    req = null,
    operatorId: opId,
    operatorRole: opRole,
    operatorName: opName,
    requestId: explicitRequestId = null,
    traceId: explicitTraceId = null,
    changeReason = null,
  } = payload;

  const op = req ? operatorFromReq(req) : {};
  const meta = metaFromReq(req);
  const requestId = explicitRequestId || meta.requestId;
  const traceId = explicitTraceId || meta.traceId;

  return {
    row: {
      module: String(mod).slice(0, 80),
      entityType: entityType != null ? String(entityType).slice(0, 80) : null,
      entityId: entityId != null ? String(entityId).slice(0, 64) : null,
      action: String(action).slice(0, 64),
      operatorId: opId != null ? opId : op.operatorId,
      operatorRole:
        opRole != null ? String(opRole).slice(0, 32) : op.operatorRole ? String(op.operatorRole).slice(0, 32) : null,
      operatorName:
        opName != null ? String(opName).slice(0, 255) : op.operatorName ? String(op.operatorName).slice(0, 255) : null,
      targetSummary: targetSummary != null ? String(targetSummary).slice(0, 500) : null,
      beforeData: beforeData ? sanitizeForAudit(beforeData) : null,
      afterData: afterData ? sanitizeForAudit(afterData) : null,
      changedFields: (changedFields || diffShallow(beforeData, afterData))
        ? sanitizeForAudit(changedFields || diffShallow(beforeData, afterData))
        : null,
      requestId: String(requestId).slice(0, 64),
      traceId: traceId != null ? String(traceId).slice(0, 64) : null,
      changeReason: changeReason != null ? String(changeReason).slice(0, 255) : null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      status,
      errorMessage: errorMessage ? String(errorMessage).slice(0, 2000) : null,
      createdAt: new Date(),
    },
    requestId,
    mod,
    action,
    entityType,
    entityId,
  };
}

/**
 * 寫入稽核紀錄；失敗只打 error log，不拋出、不影響主流程。
 * @param {object} payload
 * @param {boolean} [payload.immediate] 為 true 時直接 insert，不經 bulk 緩衝
 */
async function logAudit(payload) {
  const { immediate = false, ...rest } = payload;
  const built = buildAuditRow(rest);
  const { mod, action, entityType, entityId, requestId, row } = built;

  if (!mod || !action) {
    logger.warn('auditLogService：缺少 module 或 action，跳過寫入', { mod, action });
    return;
  }
  if (!requestId) {
    logger.warn('auditLogService：缺少 requestId，跳過寫入', { mod, action });
    return;
  }
  if (entityType === undefined || entityId === undefined) {
    logger.warn('auditLogService：缺少 entityType 或 entityId，跳過寫入', { mod, action, entityType, entityId });
    return;
  }

  try {
    if (immediate) {
      await AuditLog.create(row);
      return;
    }
    pending.push(row);
    if (pending.length >= 100) {
      flushTimer = null;
      await flushAuditNow();
    } else {
      scheduleAuditFlush();
    }
  } catch (e) {
    logger.error('auditLog 寫入失敗', e);
  }
}

function logAuditAsync(payload) {
  setImmediate(() => {
    logAudit(payload).catch(() => {});
  });
}

function logAccessGovernanceAudit({
  action,
  entityId,
  targetSummary = null,
  beforeData,
  afterData,
  req,
  changeReason = 'access_governance_update',
}) {
  const changedFields = diffShallow(beforeData, afterData);
  logAuditAsync({
    module: 'accounts',
    action,
    entityType: 'Teacher',
    entityId,
    targetSummary,
    beforeData,
    afterData,
    changedFields,
    changeReason,
    req,
  });
}

function getAuditLogQueueStats() {
  return {
    pending: pending.length,
    flushing,
    loginFailureBuckets: loginFailureBuckets.size,
    hasScheduledFlush: Boolean(flushTimer),
    hasLoginFailureFlush: Boolean(loginFlushTimer),
  };
}

module.exports = {
  sanitizeForAudit,
  diffShallow,
  logAudit,
  logAuditAsync,
  getAuditLogQueueStats,
  queueAuthLoginFailure,
  logSecurityAuditImmediate,
  logAccessGovernanceAudit,
  operatorFromReq,
  metaFromReq,
};
