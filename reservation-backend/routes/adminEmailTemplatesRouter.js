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
