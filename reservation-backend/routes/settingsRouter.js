// routes/settingsRouter.js
const express = require('express');
const router = express.Router();
const { Settings } = require('../models');
const { authMiddleware, requireSystemPermission, requireAnyPermission, P } = require('../middlewares/auth');
const auditLogService = require('../services/auditLogService');
const {
  KEYS,
  isIndividualRegistrationEnabled,
  isGroupRegistrationEnabled,
  setIndividualRegistrationEnabled,
  setGroupRegistrationEnabled,
} = require('../services/registrationSettingsService');

/** 與全站一致：僅系統管理員可變更系統設定 */
const manageSettingsAuth = [authMiddleware, requireSystemPermission(P.CAN_MANAGE_SETTINGS)];
/** 培力英檢報名開關：系統管理員或具英檢管理權（含副理） */
const manageEnglishRegistrationAuth = [
  authMiddleware,
  requireAnyPermission([P.CAN_MANAGE_SETTINGS, P.CAN_MANAGE_ENGLISH_TESTS], '需要英檢管理或系統設定權限'),
];

// GET /api/settings/english-test-registration-enabled（個人報名開關）
router.get('/english-test-registration-enabled', async (req, res) => {
  try {
    const enabled = await isIndividualRegistrationEnabled();
    return res.json({ enabled });
  } catch (error) {
    console.error('取得 english_test_registration_enabled 設定失敗：', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
});

// PUT /api/settings/english-test-registration-enabled（個人報名開關）
router.put('/english-test-registration-enabled', ...manageEnglishRegistrationAuth, async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled 必須為布林值' });
    }

    const prevEt = await Settings.findOne({ where: { key: KEYS.INDIVIDUAL } });
    const beforeEt = prevEt
      ? prevEt.valueBool !== null
        ? prevEt.valueBool
        : prevEt.value === 'true'
      : null;

    await setIndividualRegistrationEnabled(enabled);

    auditLogService.logAuditAsync({
      module: 'settings',
      action: 'english_test_registration_enabled_update',
      entityType: 'Settings',
      entityId: KEYS.INDIVIDUAL,
      targetSummary: `個人報名開關: ${beforeEt} → ${enabled}`,
      beforeData: { enabled: beforeEt },
      afterData: { enabled },
      changedFields: auditLogService.diffShallow({ enabled: beforeEt }, { enabled }),
      req,
    });

    return res.json({
      message: '設定已更新',
      enabled,
    });
  } catch (error) {
    console.error('更新 english_test_registration_enabled 設定失敗：', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
});

// GET /api/settings/english-test-registration-group-enabled（團體報名／Learning Partner）
router.get('/english-test-registration-group-enabled', async (req, res) => {
  try {
    const enabled = await isGroupRegistrationEnabled();
    return res.json({ enabled });
  } catch (error) {
    console.error('取得團體報名開關設定失敗：', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
});

// PUT /api/settings/english-test-registration-group-enabled（團體報名／Learning Partner）
router.put('/english-test-registration-group-enabled', ...manageEnglishRegistrationAuth, async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled 必須為布林值' });
    }

    await setGroupRegistrationEnabled(enabled);

    return res.json({ message: '設定已更新', enabled });
  } catch (error) {
    console.error('更新團體報名開關設定失敗：', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
});

// GET /api/settings/learning-partner-enabled（與團體報名開關同步）
router.get('/learning-partner-enabled', async (req, res) => {
  try {
    const enabled = await isGroupRegistrationEnabled();
    return res.json({ enabled });
  } catch (error) {
    console.error('取得 learning_partner_enabled 設定失敗：', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
});

// PUT /api/settings/learning-partner-enabled（與團體報名開關同步）
router.put('/learning-partner-enabled', ...manageEnglishRegistrationAuth, async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled 必須為布林值' });
    }

    await setGroupRegistrationEnabled(enabled);

    return res.json({
      message: '設定已更新',
      enabled,
    });
  } catch (error) {
    console.error('更新 learning_partner_enabled 設定失敗：', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
});

// GET /api/settings/learning-partner-quota
router.get('/learning-partner-quota', async (req, res) => {
  try {
    const setting = await Settings.findOne({ where: { key: 'learning_partner_quota' } });
    const quota = setting ? parseInt(setting.value, 10) || 50 : 50;

    return res.json({ quota });
  } catch (error) {
    console.error('取得 learning_partner_quota 設定失敗：', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
});

// PUT /api/settings/learning-partner-quota
router.put('/learning-partner-quota', ...manageSettingsAuth, async (req, res) => {
  try {
    const { quota } = req.body;

    if (typeof quota !== 'number' || quota < 1) {
      return res.status(400).json({ error: 'quota 必須為正整數' });
    }

    const [setting, created] = await Settings.findOrCreate({
      where: { key: 'learning_partner_quota' },
      defaults: {
        value: quota.toString(),
        valueInt: quota,
      },
    });

    if (!created) {
      await setting.update({
        value: quota.toString(),
        valueInt: quota,
      });
    }

    return res.json({
      message: '設定已更新',
      quota,
    });
  } catch (error) {
    console.error('更新 learning_partner_quota 設定失敗：', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
});

module.exports = router;
