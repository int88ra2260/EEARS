const express = require('express');
const {
  registerAccount,
  loginAccount,
  changePassword,
  toPublicAccount,
  signStudentToken,
} = require('../services/studentAuthService');
const studentAccountEmailVerificationService = require('../services/studentAccountEmailVerificationService');
const emailLogService = require('../services/emailLogService');
const logger = require('../utils/logger');
const { studentAuthMiddleware } = require('../middlewares/studentAuth');
const { createSimpleRateLimit } = require('../middlewares/publicAccessGuard');

const router = express.Router();

const emailCodeSendRateLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: '驗證碼寄送次數過多，請稍後再試',
  keyFn: (req, ip) => {
    const email = studentAccountEmailVerificationService.normalizeEmail(req.body?.email);
    return email ? `student-otp-send:${email}` : `student-otp-send-ip:${ip}`;
  },
});

const emailCodeVerifyRateLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: '驗證碼嘗試次數過多，請稍後再試',
  keyFn: (req, ip) => {
    const email = studentAccountEmailVerificationService.normalizeEmail(req.body?.email);
    return email ? `student-otp-verify:${email}` : `student-otp-verify-ip:${ip}`;
  },
});

function sendError(res, error) {
  const status = error.status || 500;
  if (status >= 500) {
    return res.status(500).json({ success: false, code: 'STUDENT_AUTH_ERROR', message: '登入服務暫時無法使用' });
  }
  const body = {
    success: false,
    code: error.code || 'STUDENT_AUTH_ERROR',
    message: error.message || '請求失敗',
  };
  if (error.code === 'LOGIN_COOLDOWN' && error.retryAfterSeconds) {
    body.retryAfterSeconds = error.retryAfterSeconds;
  }
  if (error.retryAfterSec) {
    body.retryAfterSec = error.retryAfterSec;
  }
  return res.status(status).json(body);
}

router.post('/email-verification/send', emailCodeSendRateLimit, async (req, res) => {
  try {
    const { code, expiresInSec, email } = await studentAccountEmailVerificationService.createAndSendCode({
      email: req.body?.email,
      studentId: req.body?.studentId || null,
    });
    try {
      await emailLogService.sendEmailWithLog(
        'studentAccountEmailVerification',
        {
          email,
          code,
          expiresInMinutes: Math.floor(expiresInSec / 60),
        },
        {
          requestId: req.requestId || `student-otp:${Date.now()}`,
          relatedEntityType: 'StudentAccountEmailVerification',
          relatedEntityId: email,
        },
      );
    } catch (mailErr) {
      logger.error('寄送學生帳號信箱驗證碼失敗', mailErr);
      try {
        await studentAccountEmailVerificationService.invalidateActiveCodes(email);
      } catch (_) { /* ignore */ }
      return res.status(503).json({
        success: false,
        code: 'EMAIL_SEND_FAILED',
        message: '驗證碼寄送失敗，請稍後再試或確認信箱是否正確',
      });
    }
    return res.json({
      success: true,
      message: '驗證碼已寄至你的信箱，請於 10 分鐘內完成驗證',
      expiresInSec,
    });
  } catch (error) {
    if ((error.status || 500) >= 500) logger.error('建立學生帳號驗證碼失敗', error);
    return sendError(res, error);
  }
});

router.post('/email-verification/verify', emailCodeVerifyRateLimit, async (req, res) => {
  try {
    const result = await studentAccountEmailVerificationService.verifyCode({
      email: req.body?.email,
      code: req.body?.code,
    });
    return res.json({
      success: true,
      message: '信箱驗證成功',
      email: result.email,
      emailVerificationToken: result.emailVerificationToken,
      expiresInSec: result.expiresInSec,
    });
  } catch (error) {
    if ((error.status || 500) >= 500) logger.error('驗證學生帳號信箱失敗', error);
    return sendError(res, error);
  }
});

router.post('/register', async (req, res) => {
  try {
    const { studentId, name, email, password, passwordConfirm, emailVerificationToken } = req.body || {};
    if (!password || password !== passwordConfirm) {
      return res.status(400).json({
        success: false,
        code: 'PASSWORD_MISMATCH',
        message: '兩次輸入的密碼不一致',
      });
    }
    const account = await registerAccount({
      studentId,
      name,
      email,
      password,
      emailVerificationToken,
    });
    if (account && account.pending) {
      return res.status(202).json({
        success: true,
        pending: true,
        code: 'STUDENT_IDENTITY_PENDING',
        message: '這個學號還沒有名冊資料。申請已送出，確認完成前不會建立帳號，也不會佔用這個信箱。',
      });
    }
    return res.status(201).json({
      success: true,
      token: signStudentToken(account),
      student: toPublicAccount(account),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/login', async (req, res) => {
  try {
    const { studentId, password } = req.body || {};
    const account = await loginAccount({ studentId, password });
    return res.json({
      success: true,
      token: signStudentToken(account),
      student: toPublicAccount(account),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/me', studentAuthMiddleware, (req, res) => {
  res.json({ success: true, student: toPublicAccount(req.studentAccount) });
});

router.post('/password', studentAuthMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword, newPasswordConfirm } = req.body || {};
    if (!newPassword || newPassword !== newPasswordConfirm) {
      return res.status(400).json({
        success: false,
        code: 'PASSWORD_MISMATCH',
        message: '兩次輸入的新密碼不一致',
      });
    }
    await changePassword({
      accountId: req.studentAccount.id,
      currentPassword,
      newPassword,
    });
    return res.json({ success: true, message: '密碼已更新' });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
