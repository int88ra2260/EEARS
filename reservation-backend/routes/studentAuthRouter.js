const express = require('express');
const {
  registerAccount,
  loginAccount,
  loginWithCampusSso,
  refreshCampusProfile,
  completeCampusEmailSetup,
  changeNotificationEmail,
  changePassword,
  toPublicAccount,
  signStudentToken,
  normalizeStudentId,
} = require('../services/studentAuthService');
const studentAccountEmailVerificationService = require('../services/studentAccountEmailVerificationService');
const studentPasswordResetService = require('../services/studentPasswordResetService');
const emailLogService = require('../services/emailLogService');
const auditLogService = require('../services/auditLogService');
const {
  studentOperator,
  logStudentSecurity,
  logStudentLoginSuccess,
  logStudentLoginFailure,
  recordStudentLoginError,
} = require('../services/studentAuthAudit');
const logger = require('../utils/logger');
const { studentAuthMiddleware } = require('../middlewares/studentAuth');
const { createSimpleRateLimit } = require('../middlewares/publicAccessGuard');
const { validateStudentId } = require('../utils/validators');
const nsysuSsoClient = require('../services/nsysuSsoClient');

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

const RESET_SENT_MESSAGE = '若此學號已有可登入的帳號，驗證碼已寄到註冊信箱。請到信箱查收，也看一下垃圾信件匣。';

const passwordResetSendRateLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: '重設密碼請求過多，請稍後再試',
  keyFn: (req, ip) => {
    const studentId = normalizeStudentId(req.body?.studentId);
    return studentId ? `student-reset-send:${studentId}` : `student-reset-send-ip:${ip}`;
  },
});

const passwordResetConfirmRateLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: '重設密碼嘗試次數過多，請稍後再試',
  keyFn: (req, ip) => {
    const studentId = normalizeStudentId(req.body?.studentId);
    return studentId ? `student-reset-confirm:${studentId}` : `student-reset-confirm-ip:${ip}`;
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
  if (error.code === 'SSO_UNAVAILABLE') {
    return res.status(503).json({
      success: false,
      code: 'SSO_UNAVAILABLE',
      message: error.message || '單一入口暫時無法連線，請稍後再試',
    });
  }
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
  if (error.redirectUrl) {
    body.redirectUrl = error.redirectUrl;
  }
  if (error.setupToken) {
    body.setupToken = error.setupToken;
    body.studentId = error.studentId;
    body.name = error.name;
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
  if (nsysuSsoClient.isEnabled()) {
    return res.status(400).json({
      success: false,
      code: 'CAMPUS_SSO_LOGIN',
      message: '請用單一入口的學號與密碼登入，不必另外建立帳號。',
    });
  }
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
      logStudentSecurity(req, {
        action: 'student_account_pending',
        studentId,
        channel: 'password',
        reasonCode: 'STUDENT_IDENTITY_PENDING',
      });
      return res.status(202).json({
        success: true,
        pending: true,
        code: 'STUDENT_IDENTITY_PENDING',
        message: '這個學號還沒有名冊資料。申請已送出，確認完成前不會建立帳號，也不會佔用這個信箱。',
      });
    }
    logStudentSecurity(req, {
      action: 'student_account_registered',
      account,
      channel: 'password',
      reasonCode: 'SUCCESS',
    });
    return res.status(201).json({
      success: true,
      token: signStudentToken(account),
      student: toPublicAccount(account),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

const loginRateLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: '登入嘗試次數過多，請稍後再試',
});

router.get('/login-options', (req, res) => {
  res.json({
    success: true,
    campusSso: nsysuSsoClient.isEnabled(),
  });
});

router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { studentId, password } = req.body || {};
    const channel = nsysuSsoClient.isEnabled() ? 'campus_sso' : 'password';
    const account = channel === 'campus_sso'
      ? await loginWithCampusSso({ studentId, password })
      : await loginAccount({ studentId, password });
    logStudentLoginSuccess(req, account, channel);
    return res.json({
      success: true,
      token: signStudentToken(account),
      student: toPublicAccount(account),
    });
  } catch (error) {
    recordStudentLoginError(req, error);
    return sendError(res, error);
  }
});

async function deliverPasswordResetCode(req, prepared) {
  await emailLogService.sendEmailWithLog(
    'studentAccountPasswordReset',
    {
      email: prepared.email,
      code: prepared.code,
      studentId: prepared.studentId,
      expiresInMinutes: Math.floor(prepared.expiresInSec / 60),
    },
    {
      requestId: req.requestId || `student-reset:${Date.now()}`,
      relatedEntityType: 'StudentAccount',
      relatedEntityId: prepared.studentAccountId,
    },
  );
}

router.post('/password-reset/send', passwordResetSendRateLimit, async (req, res) => {
  if (nsysuSsoClient.isEnabled()) {
    return res.status(400).json({
      success: false,
      code: 'CAMPUS_PASSWORD_MANAGED',
      message: '登入密碼由單一入口管理，請到單一入口重設。',
      redirectUrl: 'https://sso.nsysu.edu.tw',
    });
  }
  try {
    const studentId = normalizeStudentId(req.body?.studentId);
    if (!studentId) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_STUDENT_ID',
        message: '請輸入學號',
      });
    }
    if (!validateStudentId(studentId)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_STUDENT_ID',
        message: '學號格式不正確',
      });
    }
    const prepared = await studentPasswordResetService.prepareResetByStudentId(studentId);
    if (prepared) {
      try {
        await deliverPasswordResetCode(req, prepared);
      } catch (mailErr) {
        logger.error('寄送學生密碼重設驗證碼失敗', mailErr);
        try {
          await studentPasswordResetService.invalidateActiveResetCodes(prepared.studentAccountId);
        } catch (_) { /* ignore */ }
      }
    }
    return res.json({ success: true, message: RESET_SENT_MESSAGE });
  } catch (error) {
    if ((error.status || 500) >= 500) logger.error('建立學生密碼重設驗證碼失敗', error);
    return sendError(res, error);
  }
});

router.post('/password-reset/confirm', passwordResetConfirmRateLimit, async (req, res) => {
  if (nsysuSsoClient.isEnabled()) {
    return res.status(400).json({
      success: false,
      code: 'CAMPUS_PASSWORD_MANAGED',
      message: '登入密碼由單一入口管理，請到單一入口重設。',
      redirectUrl: 'https://sso.nsysu.edu.tw',
    });
  }
  try {
    const { studentId, code, newPassword, newPasswordConfirm } = req.body || {};
    if (!newPassword || newPassword !== newPasswordConfirm) {
      return res.status(400).json({
        success: false,
        code: 'PASSWORD_MISMATCH',
        message: '兩次輸入的新密碼不一致',
      });
    }
    const account = await studentPasswordResetService.confirmReset({
      studentId,
      code,
      newPassword,
    });
    const operator = studentOperator(account);
    auditLogService.logAuditAsync({
      module: 'accounts',
      action: 'student_password_reset_completed',
      entityType: 'StudentAccount',
      entityId: account.id,
      targetSummary: `studentAccountId=${account.id}`,
      afterData: { channel: 'email', studentId: account.studentId || studentId },
      operatorId: operator.operatorId,
      operatorRole: operator.operatorRole,
      operatorName: operator.operatorName,
      req,
    });
    return res.json({ success: true, message: '密碼已更新，請用新密碼登入' });
  } catch (error) {
    if (error?.code && error.code !== 'PASSWORD_MISMATCH') {
      logStudentSecurity(req, {
        action: 'student_password_reset_failed',
        studentId: req.body?.studentId,
        status: 'failed',
        errorMessage: error.code,
        channel: 'email',
        reasonCode: error.code,
      });
    }
    return sendError(res, error);
  }
});

router.get('/me', studentAuthMiddleware, (req, res) => {
  res.json({ success: true, student: toPublicAccount(req.studentAccount) });
});

router.post('/campus-email', loginRateLimit, async (req, res) => {
  try {
    const account = await completeCampusEmailSetup({
      setupToken: req.body?.setupToken,
      email: req.body?.email,
      emailVerificationToken: req.body?.emailVerificationToken,
    });
    logStudentLoginSuccess(req, account, 'campus_email_setup');
    return res.json({
      success: true,
      token: signStudentToken(account),
      student: toPublicAccount(account),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/campus-profile', studentAuthMiddleware, async (req, res) => {
  const profile = req.studentAccount?.campusProfile || null;
  return res.json({ success: true, profile });
});

const campusProfileRateLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: '讀取學籍次數過多，請稍後再試',
  keyFn: (req, ip) => {
    const studentId = String(req.studentAccount?.studentId || '').trim().toUpperCase();
    return studentId ? `campus-profile:${studentId}` : `campus-profile-ip:${ip}`;
  },
});

router.post('/campus-profile', studentAuthMiddleware, campusProfileRateLimit, async (req, res) => {
  try {
    const profile = await refreshCampusProfile({
      studentId: req.studentAccount.studentId,
      password: req.body?.password,
    });
    logStudentSecurity(req, {
      action: 'student_campus_profile_refreshed',
      account: req.studentAccount,
      channel: 'campus_sso',
      reasonCode: 'SUCCESS',
    });
    return res.json({ success: true, profile });
  } catch (error) {
    if (error?.code === 'INVALID_CREDENTIALS' || error?.code === 'LOGIN_COOLDOWN') {
      logStudentLoginFailure(
        req,
        req.studentAccount?.studentId,
        error.code,
        req.studentAccount?.id,
        'student_campus_profile_failed',
      );
    }
    return sendError(res, error);
  }
});

router.post('/email', studentAuthMiddleware, async (req, res) => {
  try {
    const previousEmail = req.studentAccount.email;
    const account = await changeNotificationEmail({
      accountId: req.studentAccount.id,
      email: req.body?.email,
      emailVerificationToken: req.body?.emailVerificationToken,
    });
    if (String(previousEmail || '').toLowerCase() !== String(account.email || '').toLowerCase()) {
      logStudentSecurity(req, {
        action: 'student_email_changed',
        account,
        channel: 'email',
        reasonCode: 'SUCCESS',
        beforeData: { email: previousEmail },
        afterExtra: { email: account.email },
      });
    }
    return res.json({
      success: true,
      token: signStudentToken(account),
      student: toPublicAccount(account),
    });
  } catch (error) {
    return sendError(res, error);
  }
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
    logStudentSecurity(req, {
      action: 'student_password_changed',
      account: req.studentAccount,
      channel: 'password',
      reasonCode: 'SUCCESS',
    });
    return res.json({ success: true, message: '密碼已更新' });
  } catch (error) {
    if (error?.code === 'INVALID_PASSWORD') {
      logStudentSecurity(req, {
        action: 'student_password_change_failed',
        account: req.studentAccount,
        status: 'failed',
        errorMessage: error.code,
        channel: 'password',
        reasonCode: error.code,
      });
    }
    return sendError(res, error);
  }
});

module.exports = router;
