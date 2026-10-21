const express = require('express');
const {
  registerAccount,
  loginAccount,
  changePassword,
  toPublicAccount,
  signStudentToken,
} = require('../services/studentAuthService');
const { studentAuthMiddleware } = require('../middlewares/studentAuth');

const router = express.Router();

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
  return res.status(status).json(body);
}

router.post('/register', async (req, res) => {
  try {
    const { studentId, name, email, password, passwordConfirm } = req.body || {};
    if (!password || password !== passwordConfirm) {
      return res.status(400).json({
        success: false,
        code: 'PASSWORD_MISMATCH',
        message: '兩次輸入的密碼不一致',
      });
    }
    const account = await registerAccount({ studentId, name, email, password });
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
