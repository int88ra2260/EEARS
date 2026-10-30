const auditLogService = require('./auditLogService');
const loginAccountCooldown = require('../utils/loginAccountCooldown');
const { maskStudentId } = require('../utils/piiMask');

const CREDENTIAL_FAILURES = new Set([
  'INVALID_CREDENTIALS',
  'STUDENT_ACCOUNT_INACTIVE',
  'STUDENT_ACCOUNT_PENDING',
  'CAMPUS_STUDENT_INACTIVE',
]);

function studentOperator(account) {
  if (!account || account.id == null) {
    return { operatorId: null, operatorRole: null, operatorName: null };
  }
  const operatorId = Number(account.id);
  const maskedId = maskStudentId(account.studentId);
  const name = account.name ? String(account.name).trim() : '';
  return {
    operatorId: Number.isInteger(operatorId) && operatorId > 0 ? operatorId : null,
    operatorRole: 'student',
    operatorName: name && maskedId ? `${name}（${maskedId}）` : (name || maskedId || null),
  };
}

function loginMeta(req, studentId, extra = {}) {
  const meta = auditLogService.metaFromReq(req);
  return {
    studentIdMasked: maskStudentId(studentId) || null,
    studentIdHash: loginAccountCooldown.usernameHashForAudit(studentId),
    channel: extra.channel || null,
    reasonCode: extra.reasonCode || null,
    requestId: meta.requestId || null,
  };
}

function logStudentSecurity(req, {
  action,
  account = null,
  studentId = null,
  status = 'success',
  errorMessage = null,
  channel = null,
  reasonCode = null,
  beforeData = null,
  afterExtra = null,
}) {
  if (!action) return;
  const operator = studentOperator(account);
  const resolvedStudentId = studentId || account?.studentId || null;
  auditLogService.logSecurityAuditImmediate(req, {
    module: 'accounts',
    action,
    entityType: 'StudentAccount',
    entityId: account?.id != null ? account.id : 'unresolved',
    targetSummary: maskStudentId(resolvedStudentId) || action,
    status,
    errorMessage,
    beforeData,
    afterData: {
      ...loginMeta(req, resolvedStudentId, { channel, reasonCode }),
      ...(afterExtra && typeof afterExtra === 'object' ? afterExtra : {}),
    },
    operatorId: operator.operatorId,
    operatorRole: operator.operatorRole,
    operatorName: operator.operatorName,
  });
}

function logStudentLoginSuccess(req, account, channel) {
  logStudentSecurity(req, {
    action: 'student_login_success',
    account,
    status: 'success',
    channel,
    reasonCode: 'SUCCESS',
  });
}

function logStudentLoginFailure(req, studentId, code, accountId = null, actionOverride = null) {
  const reason = String(code || 'UNKNOWN').slice(0, 64);
  if (reason === 'MISSING_CREDENTIALS') return;
  if (CREDENTIAL_FAILURES.has(reason)) {
    auditLogService.queueAuthLoginFailure(
      req,
      maskStudentId(studentId) || 'unknown',
      accountId,
      reason,
      { namespace: 'student', entityType: 'StudentAccount' },
    );
  }
  logStudentSecurity(req, {
    action: actionOverride || (reason === 'LOGIN_COOLDOWN' ? 'student_login_blocked' : 'student_login_failed'),
    account: accountId != null ? { id: accountId, studentId } : null,
    studentId,
    status: 'failed',
    errorMessage: reason,
    reasonCode: reason,
  });
}

function recordStudentLoginError(req, error) {
  const code = error?.code || 'STUDENT_AUTH_ERROR';
  if (code === 'MISSING_CREDENTIALS') return;
  const studentId = error?.studentId || req.body?.studentId;
  if (code === 'CAMPUS_EMAIL_REQUIRED') {
    logStudentSecurity(req, {
      action: 'student_login_needs_email',
      studentId,
      status: 'success',
      channel: 'campus_sso',
      reasonCode: code,
    });
    return;
  }
  logStudentLoginFailure(req, studentId, code);
}

module.exports = {
  studentOperator,
  logStudentSecurity,
  logStudentLoginSuccess,
  logStudentLoginFailure,
  recordStudentLoginError,
};
