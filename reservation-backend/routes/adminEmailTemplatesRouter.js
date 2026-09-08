'use strict';

const express = require('express');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const {
  listEmailTemplates,
  getEmailTemplateDetail,
  previewEmailTemplate,
  upsertEmailTemplateOverride,
  resetEmailTemplateOverride,
  sendTestEmail,
} = require('../services/emailTemplateService');
const { getGlobalRateLimitAdminSnapshot } = require('../config/httpSecurity');
const {
  getSkipGlobalForEnglishTestEmailOtp,
  setSkipGlobalForEnglishTestEmailOtp,
} = require('../services/englishTestEmailOtpRateLimitSettings');

const router = express.Router();

router.use(authMiddleware);
router.use(requirePermission(P.CAN_MANAGE_SETTINGS));

router.get('/', async (req, res, next) => {
  try {
    const templates = await listEmailTemplates();
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
});

/**
 * 培力驗證碼 × 全站限流：開關 + 目前用量（須在 /:key 之前）
 * GET /api/admin/email-templates/rate-limit-guard
 */
router.get('/rate-limit-guard', async (req, res, next) => {
  try {
    const skipGlobalForEnglishTestEmailOtp = await getSkipGlobalForEnglishTestEmailOtp();
    const usage = getGlobalRateLimitAdminSnapshot();
    res.json({
      success: true,
      data: {
        skipGlobalForEnglishTestEmailOtp,
        usage,
        otpDedicatedLimits: {
          send: { windowMinutes: 10, max: 8, note: '依 email（無 email 則依 IP）' },
          verify: { windowMinutes: 10, max: 20, note: '依 email（無 email 則依 IP）' },
          resendCooldownSeconds: 60,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/email-templates/rate-limit-guard
 * body: { skipGlobalForEnglishTestEmailOtp: boolean }
 */
router.put('/rate-limit-guard', async (req, res, next) => {
  try {
    if (typeof req.body?.skipGlobalForEnglishTestEmailOtp !== 'boolean') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PAYLOAD',
        message: '請提供 skipGlobalForEnglishTestEmailOtp（boolean）',
      });
    }
    const skipGlobalForEnglishTestEmailOtp = await setSkipGlobalForEnglishTestEmailOtp(
      req.body.skipGlobalForEnglishTestEmailOtp
    );
    const usage = getGlobalRateLimitAdminSnapshot();
    res.json({
      success: true,
      data: {
        skipGlobalForEnglishTestEmailOtp,
        usage,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:key', async (req, res, next) => {
  try {
    const detail = await getEmailTemplateDetail(req.params.key);
    if (!detail) {
      return res.status(404).json({ success: false, code: 'EMAIL_TEMPLATE_NOT_FOUND', message: '找不到郵件模板' });
    }
    res.json({ success: true, data: detail });
  } catch (err) {
    if (err.code === 'EMAIL_TEMPLATE_NOT_FOUND') {
      return res.status(404).json({ success: false, code: err.code, message: '找不到郵件模板' });
    }
    next(err);
  }
});

router.put('/:key', async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId || null;
    const result = await upsertEmailTemplateOverride(req.params.key, req.body || {}, userId);
    const detail = await getEmailTemplateDetail(req.params.key);
    res.json({ success: true, data: detail, warnings: result.warnings || [] });
  } catch (err) {
    if (err.code === 'EMAIL_TEMPLATE_NOT_FOUND') {
      return res.status(404).json({ success: false, code: err.code, message: '找不到郵件模板' });
    }
    next(err);
  }
});

router.post('/:key/reset', async (req, res, next) => {
  try {
    await resetEmailTemplateOverride(req.params.key);
    const detail = await getEmailTemplateDetail(req.params.key);
    res.json({ success: true, data: detail });
  } catch (err) {
    if (err.code === 'EMAIL_TEMPLATE_NOT_FOUND') {
      return res.status(404).json({ success: false, code: err.code, message: '找不到郵件模板' });
    }
    next(err);
  }
});

router.post('/:key/preview', async (req, res, next) => {
  try {
    const body = req.body || {};
    const preview = await previewEmailTemplate(req.params.key, {
      subjectTemplate: body.subjectTemplate,
      bodyTemplate: body.bodyTemplate,
      data: body.data,
    });
    res.json({ success: true, data: preview });
  } catch (err) {
    if (err.code === 'EMAIL_TEMPLATE_NOT_FOUND') {
      return res.status(404).json({ success: false, code: err.code, message: '找不到郵件模板' });
    }
    next(err);
  }
});

router.post('/:key/test-send', async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await sendTestEmail(req.params.key, {
      to: body.to,
      subjectTemplate: body.subjectTemplate,
      bodyTemplate: body.bodyTemplate,
      data: body.data,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.code === 'EMAIL_TEMPLATE_NOT_FOUND') {
      return res.status(404).json({ success: false, code: err.code, message: '找不到郵件模板' });
    }
    if (err.code === 'TEST_EMAIL_TO_REQUIRED') {
      return res.status(400).json({ success: false, code: err.code, message: '請提供有效的測試收件信箱' });
    }
    if (err.message === 'EMAIL_TRANSPORT_NOT_CONFIGURED' || err.message?.includes('EMAIL_TRANSPORT')) {
      return res.status(503).json({ success: false, code: 'EMAIL_TRANSPORT_NOT_CONFIGURED', message: '郵件服務未設定，無法寄出測試信' });
    }
    next(err);
  }
});

module.exports = router;
