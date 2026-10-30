// routes/surveySettingsRouter.js
const express = require('express');
const router = express.Router();
const { SurveySettings, sequelize } = require('../models');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const auditLogService = require('../services/auditLogService');
const surveySettingsSyncService = require('../services/surveySettingsSyncService');

const surveySettingsAuth = [authMiddleware, requirePermission(P.CAN_MANAGE_SURVEY_SETTINGS)];
router.use((req, res, next) => {
  res.setHeader('X-EEARS-Deprecated', 'true');
  next();
});

router.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  return res.status(410).json({
    success: false,
    code: 'SURVEY_SETTINGS_READ_ONLY',
    message: '舊版問卷設定已停止寫入。請到問卷規則調整啟用、必填與開放時間。',
  });
});

function validateSurveySettingsUpdateBody(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['請求 body 無效'];
  if (body.isEnabled !== undefined && typeof body.isEnabled !== 'boolean') {
    errors.push('isEnabled 必須為布林');
  }
  if (body.isRequired !== undefined && typeof body.isRequired !== 'boolean') {
    errors.push('isRequired 必須為布林');
  }
  for (const key of ['startDate', 'endDate']) {
    if (body[key] === undefined) continue;
    if (body[key] === null) continue;
    const t = new Date(body[key]);
    if (Number.isNaN(t.getTime())) errors.push(`${key} 不是有效日期`);
  }
  return errors;
}

// 取得所有問卷設定
router.get('/', ...surveySettingsAuth, async (req, res, next) => {
  try {
    const settings = await SurveySettings.findAll({
      order: [['surveyName', 'ASC']]
    });
    
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// 診斷：legacy survey_settings 與 survey_rules 對齊情形（過渡期檢查用）
router.get('/sync-diagnostic', ...surveySettingsAuth, async (req, res, next) => {
  try {
    const report = await surveySettingsSyncService.getLegacySurveyRuleSyncReport();
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// 取得特定問卷設定
router.get('/:surveyId', ...surveySettingsAuth, async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const setting = await SurveySettings.findOne({
      where: { surveyId }
    });
    
    if (!setting) {
      return res.status(404).json({ error: '找不到指定的問卷設定' });
    }
    
    res.json(setting);
  } catch (err) {
    next(err);
  }
});

// 更新問卷設定（legacy 寫入 + 同步 survey_rules，失敗則整筆 rollback）
router.put('/:surveyId', ...surveySettingsAuth, async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const body = req.body || {};
    const valErrs = validateSurveySettingsUpdateBody(body);
    if (valErrs.length) {
      return res.status(400).json({ error: '驗證失敗', details: valErrs });
    }

    const { isEnabled, startDate, endDate, isRequired, notes } = body;

    let beforeAudit;
    const { setting } = await sequelize.transaction(async (transaction) => {
      const row = await SurveySettings.findOne({
        where: { surveyId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!row) {
        const e = new Error('not_found');
        e.statusCode = 404;
        throw e;
      }

      beforeAudit = {
        isEnabled: row.isEnabled,
        startDate: row.startDate,
        endDate: row.endDate,
        isRequired: row.isRequired,
        notes: row.notes,
      };

      await row.update(
        {
          isEnabled: isEnabled !== undefined ? isEnabled : row.isEnabled,
          startDate: startDate !== undefined ? startDate : row.startDate,
          endDate: endDate !== undefined ? endDate : row.endDate,
          isRequired: isRequired !== undefined ? isRequired : row.isRequired,
          notes: notes !== undefined ? notes : row.notes,
        },
        { transaction }
      );
      await row.reload({ transaction });

      await surveySettingsSyncService.syncLegacySettingToSurveyRule(row, {
        actorId: req.user && req.user.id,
        transaction,
        source: 'api_put',
      });

      return { setting: row };
    });

    auditLogService.logAuditAsync({
      module: 'survey_settings',
      action: 'update',
      entityType: 'SurveySettings',
      entityId: setting.surveyId,
      targetSummary: `surveyId=${setting.surveyId}`,
      beforeData: beforeAudit,
      afterData: {
        isEnabled: setting.isEnabled,
        startDate: setting.startDate,
        endDate: setting.endDate,
        isRequired: setting.isRequired,
        notes: setting.notes,
      },
      req,
    });

    res.json({
      message: '問卷設定已更新，並已同步正式問卷規則',
      setting,
    });
  } catch (err) {
    if (err.statusCode === 404 || err.message === 'not_found') {
      return res.status(404).json({ error: '找不到指定的問卷設定' });
    }
    next(err);
  }
});

// 切換問卷啟用狀態（legacy + survey_rules 同步）
router.patch('/:surveyId/toggle', ...surveySettingsAuth, async (req, res, next) => {
  try {
    const { surveyId } = req.params;

    let beforeEnabled;
    const { setting } = await sequelize.transaction(async (transaction) => {
      const row = await SurveySettings.findOne({
        where: { surveyId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!row) {
        const e = new Error('not_found');
        e.statusCode = 404;
        throw e;
      }

      beforeEnabled = row.isEnabled;
      await row.update({ isEnabled: !row.isEnabled }, { transaction });
      await row.reload({ transaction });

      await surveySettingsSyncService.syncLegacySettingToSurveyRule(row, {
        actorId: req.user && req.user.id,
        transaction,
        source: 'api_patch_toggle',
      });

      return { setting: row };
    });

    auditLogService.logAuditAsync({
      module: 'survey_settings',
      action: 'toggle',
      entityType: 'SurveySettings',
      entityId: setting.surveyId,
      targetSummary: `surveyId=${setting.surveyId}`,
      beforeData: { isEnabled: beforeEnabled },
      afterData: { isEnabled: setting.isEnabled },
      req,
    });

    res.json({
      message: `問卷已${setting.isEnabled ? '啟用' : '停用'}，並已同步正式問卷規則`,
      isEnabled: setting.isEnabled,
    });
  } catch (err) {
    if (err.statusCode === 404 || err.message === 'not_found') {
      return res.status(404).json({ error: '找不到指定的問卷設定' });
    }
    next(err);
  }
});

// 初始化/同步問卷設定（管理員專用；legacy + survey_rules 同一 transaction）
router.post('/initialize', ...surveySettingsAuth, async (req, res, next) => {
  try {
    const { force = false } = req.body;

    const results = await sequelize.transaction(async (transaction) => {
      if (!force) {
        const existingSettings = await SurveySettings.findAll({ transaction });
        if (existingSettings.length > 0) {
          const e = new Error('already_initialized');
          e.statusCode = 400;
          throw e;
        }
      }

      const defaultSettings = [
        {
          surveyId: 'english_table_feedback_114_1',
          surveyName: 'English Table 問卷 (114-1)',
          description: '收集學生於 English Table 活動中的學習與口語表現經驗',
          relatedEventTypes: ['English Table'],
          isEnabled: true,
          isRequired: true,
          notes: '預設啟用，預約 English Table 活動前必須填寫',
        },
        {
          surveyId: 'english_club_feedback_114_1',
          surveyName: 'English Club 問卷 (114-1)',
          description: '收集學生對 English Club 活動的滿意度與英語學習成效之回饋',
          relatedEventTypes: ['English Club'],
          isEnabled: true,
          isRequired: true,
          notes: '預設啟用，預約 English Club 活動前必須填寫',
        },
      ];

      const out = [];

      for (const setting of defaultSettings) {
        let existing = await SurveySettings.findOne({
          where: { surveyId: setting.surveyId },
          transaction,
        });

        if (!existing) {
          const allSettings = await SurveySettings.findAll({ transaction });
          existing = allSettings.find((s) => {
            if (!s.relatedEventTypes) return false;
            const relatedTypes = Array.isArray(s.relatedEventTypes)
              ? s.relatedEventTypes
              : typeof s.relatedEventTypes === 'string'
                ? JSON.parse(s.relatedEventTypes)
                : [];
            return relatedTypes.includes(setting.relatedEventTypes[0]);
          });
        }

        if (existing) {
          await existing.update(
            {
              surveyId: setting.surveyId,
              surveyName: setting.surveyName,
              description: setting.description,
              relatedEventTypes: setting.relatedEventTypes,
              isEnabled: force ? setting.isEnabled : existing.isEnabled,
              isRequired: setting.isRequired,
              notes: setting.notes,
            },
            { transaction }
          );
          await existing.reload({ transaction });
          await surveySettingsSyncService.syncLegacySettingToSurveyRule(existing, {
            actorId: req.user && req.user.id,
            transaction,
            source: 'api_initialize',
          });
          out.push({ action: 'updated', setting: existing });
        } else {
          const created = await SurveySettings.create(setting, { transaction });
          await surveySettingsSyncService.syncLegacySettingToSurveyRule(created, {
            actorId: req.user && req.user.id,
            transaction,
            source: 'api_initialize',
          });
          out.push({ action: 'created', setting: created });
        }
      }

      return out;
    });

    auditLogService.logAuditAsync({
      module: 'survey_settings',
      action: 'initialize',
      entityType: 'SurveySettingsInit',
      entityId: 'initialize',
      targetSummary: `force=${force ? 'true' : 'false'}`,
      beforeData: null,
      afterData: {
        force,
        resultsCount: results.length,
      },
      req,
    });

    res.json({
      message: force ? '問卷設定已重新初始化，並已同步正式問卷規則' : '問卷設定初始化完成，並已同步正式問卷規則',
      results,
      settings: results.map((r) => r.setting),
    });
  } catch (err) {
    if (err.message === 'already_initialized') {
      return res.status(400).json({
        error: '問卷設定已經初始化，如需重新初始化請使用 force=true 參數',
        hint: '可以在請求 body 中添加 { "force": true } 來強制重新初始化',
      });
    }
    next(err);
  }
});

// 新增問卷設定（legacy + 可對應時同步 survey_rules）
router.post('/', ...surveySettingsAuth, async (req, res, next) => {
  try {
    const {
      surveyId,
      surveyName,
      description,
      relatedEventTypes,
      isEnabled = true,
      startDate,
      endDate,
      isRequired = true,
      notes,
    } = req.body || {};

    if (!surveyId || !surveyName) {
      return res.status(400).json({ error: 'surveyId 和 surveyName 為必填欄位' });
    }

    const setting = await sequelize.transaction(async (transaction) => {
      const dup = await SurveySettings.findOne({ where: { surveyId }, transaction });
      if (dup) {
        const e = new Error('duplicate');
        e.statusCode = 400;
        throw e;
      }

      const row = await SurveySettings.create(
        {
          surveyId,
          surveyName,
          description,
          relatedEventTypes,
          isEnabled,
          startDate,
          endDate,
          isRequired,
          notes,
        },
        { transaction }
      );

      await surveySettingsSyncService.syncLegacySettingToSurveyRule(row, {
        actorId: req.user && req.user.id,
        transaction,
        source: 'api_post_create',
      });

      return row;
    });

    auditLogService.logAuditAsync({
      module: 'survey_settings',
      action: 'create',
      entityType: 'SurveySettings',
      entityId: setting.surveyId,
      targetSummary: `surveyId=${setting.surveyId}`,
      beforeData: null,
      afterData: {
        surveyName: setting.surveyName,
        isEnabled: setting.isEnabled,
        startDate: setting.startDate,
        endDate: setting.endDate,
        isRequired: setting.isRequired,
      },
      req,
    });

    res.status(201).json({
      message: '問卷設定已建立，並已同步正式問卷規則（若該筆有對應產品化問卷）',
      setting,
    });
  } catch (err) {
    if (err.message === 'duplicate') {
      return res.status(400).json({ error: '該問卷ID已存在' });
    }
    next(err);
  }
});

// 刪除問卷設定
router.delete('/:surveyId', ...surveySettingsAuth, async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    
    const setting = await SurveySettings.findOne({
      where: { surveyId }
    });
    
    if (!setting) {
      return res.status(404).json({ error: '找不到指定的問卷設定' });
    }
    
    const before = {
      surveyId: setting.surveyId,
      isEnabled: setting.isEnabled,
      isRequired: setting.isRequired,
      startDate: setting.startDate,
      endDate: setting.endDate,
    };

    await setting.destroy();

    auditLogService.logAuditAsync({
      module: 'survey_settings',
      action: 'delete',
      entityType: 'SurveySettings',
      entityId: setting.surveyId,
      targetSummary: `surveyId=${setting.surveyId}`,
      beforeData: before,
      afterData: null,
      req,
    });
    
    res.json({
      message: '問卷設定已刪除'
    });
  } catch (err) {
    next(err);
  }
});

// 取得問卷啟用狀態（公開API，用於前端檢查）
router.get('/:surveyId/status', async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    
    const setting = await SurveySettings.findOne({
      where: { surveyId },
      attributes: ['isEnabled', 'isRequired', 'startDate', 'endDate']
    });
    
    if (!setting) {
      return res.json({
        isEnabled: false,
        isRequired: false,
        message: '問卷設定不存在'
      });
    }
    
    // 檢查時間範圍
    const now = new Date();
    let isInTimeRange = true;
    
    if (setting.startDate && new Date(setting.startDate) > now) {
      isInTimeRange = false;
    }
    
    if (setting.endDate && new Date(setting.endDate) < now) {
      isInTimeRange = false;
    }
    
    res.json({
      isEnabled: setting.isEnabled && isInTimeRange,
      isRequired: setting.isRequired,
      startDate: setting.startDate,
      endDate: setting.endDate,
      isInTimeRange
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
