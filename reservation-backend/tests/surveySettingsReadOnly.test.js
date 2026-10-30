'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../middlewares/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  P: { CAN_MANAGE_SURVEY_SETTINGS: 'can_manage_survey_settings' },
}));

jest.mock('../models', () => ({
  SurveySettings: { findAll: jest.fn(), findOne: jest.fn() },
  sequelize: { transaction: jest.fn() },
}));

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: jest.fn(),
}));

jest.mock('../services/surveySettingsSyncService', () => ({
  syncLegacySettingToSurveyRule: jest.fn(),
  getLegacySurveyRuleSyncReport: jest.fn(),
}));

const surveySettingsRouter = require('../routes/surveySettingsRouter');
const { syncLegacySettingToSurveyRule } = require('../services/surveySettingsSyncService');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/survey-settings', surveySettingsRouter);
  return app;
}

describe('legacy survey settings writes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['put', 'patch', 'post', 'delete'])('%s 回 410 且不寫入規則', async (method) => {
    const res = await request(createApp())[method]('/api/admin/survey-settings/english_table_feedback_114_1')
      .send({ isEnabled: false, isRequired: false });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('SURVEY_SETTINGS_READ_ONLY');
    expect(syncLegacySettingToSurveyRule).not.toHaveBeenCalled();
  });
});
