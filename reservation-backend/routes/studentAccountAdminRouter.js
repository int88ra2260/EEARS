const express = require('express');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const emailLogService = require('../services/emailLogService');
const auditLogService = require('../services/auditLogService');
const logger = require('../utils/logger');
const {
  lookupStudentAccount,
  prepareResetByAccountId,
  invalidateActiveResetCodes,
} = require('../services/studentPasswordResetService');

const router = express.Router();
const reviewAuth = [authMiddleware, requirePermission(P.CAN_MANAGE_ACCOUNTS)];

function sendError(res, error) {
  const status = error.status || 500;
  if (status >= 500) {
    return res.status(500).json({
      success: false,
      code: 'STUDENT_ACCOUNT_ADMIN_ERROR',
      message: '暫時無法處理學生帳號',
    });
  }
  const body = {
    success: false,
    code: error.code || 'STUDENT_ACCOUNT_ADMIN_ERROR',
    message: error.message || '請求失敗',
  };
  if (error.retryAfterSec) body.retryAfterSec = error.retryAfterSec;
  return res.status(status).json(body);
}

router.get('/lookup', ...reviewAuth, async (req, res) => {
  try {
    const result = await lookupStudentAccount(req.query.studentId);
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/password-reset', ...reviewAuth, async (req, res) => {
  let prepared;
  try {
    prepared = await prepareResetByAccountId(req.params.id);
  } catch (error) {
    return sendError(res, error);
  }

  try {
    await emailLogService.sendEmailWithLog(
      'studentAccountPasswordReset',
      {
        email: prepared.email,
        code: prepared.code,
        studentId: prepared.studentId,
        expiresInMinutes: Math.floor(prepared.expiresInSec / 60),
      },
      {
        requestId: req.requestId || `student-reset-admin:${Date.now()}`,
        relatedEntityType: 'StudentAccount',
        relatedEntityId: prepared.studentAccountId,
      },
    );
  } catch (error) {
    try {
      await invalidateActiveResetCodes(prepared.studentAccountId);
    } catch (_) { /* ignore */ }
    logger.error('寄送學生密碼重設驗證碼失敗', error);
    return res.status(503).json({
      success: false,
      code: 'EMAIL_SEND_FAILED',
      message: '重設信寄送失敗，請稍後再試',
    });
  }

  auditLogService.logAuditAsync({
    module: 'accounts',
    action: 'student_password_reset_email',
    entityType: 'StudentAccount',
    entityId: prepared.studentAccountId,
    targetSummary: `studentAccountId=${prepared.studentAccountId}`,
    afterData: { channel: 'email' },
    req,
  });
  return res.json({ success: true, message: '已寄出密碼重設信' });
});

module.exports = router;
