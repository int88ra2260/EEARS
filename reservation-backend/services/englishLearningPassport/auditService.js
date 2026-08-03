'use strict';

const { EnglishLearningAuditLog } = require('../../models');
const auditLogService = require('../auditLogService');
const { sanitizeForAudit } = require('../../utils/logSanitizer');

function metaFromReq(req) {
  if (!req) return { ipAddress: null, userAgent: null };
  const fwd = req.headers && req.headers['x-forwarded-for'];
  const ip =
    (typeof fwd === 'string' && fwd.split(',')[0].trim()) ||
    req.ip ||
    (req.socket && req.socket.remoteAddress) ||
    null;
  const ua = req.headers && req.headers['user-agent'];
  return {
    ipAddress: ip,
    userAgent: typeof ua === 'string' ? ua.slice(0, 500) : null,
  };
}

function actorFromReq(req, studentContext) {
  if (req && req.user) {
    return {
      actorId: String(req.user.id != null ? req.user.id : 'admin'),
      actorRole: req.user.role || 'admin',
    };
  }
  if (studentContext) {
    return {
      actorId: studentContext.studentId,
      actorRole: 'student',
    };
  }
  return { actorId: null, actorRole: null };
}

async function logElpAudit({
  req,
  studentContext,
  action,
  targetType,
  targetId,
  before = null,
  after = null,
}) {
  const { actorId, actorRole } = actorFromReq(req, studentContext);
  const { ipAddress, userAgent } = metaFromReq(req);
  const beforeJson = before ? sanitizeForAudit(before) : null;
  const afterJson = after ? sanitizeForAudit(after) : null;

  await EnglishLearningAuditLog.create({
    actorId,
    actorRole,
    action,
    targetType,
    targetId: String(targetId),
    beforeJson,
    afterJson,
    ipAddress,
    userAgent,
  });

  auditLogService.logAuditAsync({
    module: 'english_learning_passport',
    action,
    entityType: targetType,
    entityId: String(targetId),
    targetSummary: `${action} ${targetType}#${targetId}`,
    beforeData: beforeJson,
    afterData: afterJson,
    req,
  });
}

module.exports = {
  logElpAudit,
};
