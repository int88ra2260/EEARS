const express = require('express');
const request = require('supertest');

jest.mock('../../middlewares/auth', () => {
  const P = {
    CAN_VIEW_SURVEYS: 'can_view_surveys',
    CAN_MANAGE_SURVEYS: 'can_manage_surveys',
    CAN_EXPORT_SURVEYS: 'can_export_surveys',
    CAN_EXPORT_SURVEY_RESPONSES: 'can_export_survey_responses',
    CAN_VIEW_SURVEY_RESPONSES: 'can_view_survey_responses',
    CAN_VIEW_SURVEY_ANALYTICS: 'can_view_survey_analytics',
    CAN_PUBLISH_SURVEYS: 'can_publish_surveys',
  };

  const authMiddleware = (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!role) return res.status(401).json({ error: 'unauthenticated' });
    req.user = { id: 1, role };
    next();
  };

  const requirePermission = (permission) => (req, res, next) => {
    const allow = String(req.headers['x-allow-permissions'] || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!allow.includes(permission)) {
      return res.status(403).json({ error: 'forbidden', permission });
    }
    return next();
  };

  const requireAnyPermission = (permissions) => (req, res, next) => {
    const allow = String(req.headers['x-allow-permissions'] || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!permissions.some((permission) => allow.includes(permission))) {
      return res.status(403).json({ error: 'forbidden', permissions });
    }
    return next();
  };

  return {
    authMiddleware,
    requirePermission,
    requireAnyPermission,
    requireSurveyAccess: () => (_req, _res, next) => next(),
    P,
  };
});

jest.mock('../../services/surveyModuleService', () => ({
  getPublicStatusPayload: jest.fn().mockResolvedValue({ ok: true, code: null, currentSemester: '114-2' }),
  getPublishedSurveyPackage: jest.fn().mockResolvedValue({
    config: { title: 'survey' },
    source: 'db',
    versionNumber: 1,
    surveyKey: 'english_table_feedback_114_1',
  }),
  submitPublicResponse: jest.fn().mockResolvedValue({ success: true }),
  listSurveysAdmin: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/surveyEnabledListService', () => ({
  listEnabledActivitySurveys: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../models', () => ({
  EnglishTableSurveyResponse: { findOne: jest.fn().mockResolvedValue(null), findAll: jest.fn().mockResolvedValue([]) },
  EnglishClubSurveyResponse: { findOne: jest.fn().mockResolvedValue(null), findAll: jest.fn().mockResolvedValue([]) },
  SurveySettings: { findAll: jest.fn().mockResolvedValue([]) },
  Survey: { findByPk: jest.fn().mockResolvedValue(null) },
  SurveyRule: { findOne: jest.fn().mockResolvedValue(null) },
  SurveyVersion: { findByPk: jest.fn().mockResolvedValue(null) },
}));

const surveyRouter = require('../../routes/surveyRouter');
const surveyProductAdminRouter = require('../../routes/surveyProductAdminRouter');
const { authMiddleware, requirePermission, P } = require('../../middlewares/auth');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/surveys', surveyRouter);
  app.use('/api/admin/surveys', surveyProductAdminRouter);
  app.use('/api/admin/surveys', authMiddleware, requirePermission(P.CAN_VIEW_SURVEYS), surveyRouter);
  return app;
}

describe('admin survey API auth boundary', () => {
  it('unauthenticated request to /api/admin/surveys/enabled returns 401', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/surveys/enabled');
    expect(res.status).toBe(401);
  });

  it('unauthorized role request to /api/admin/surveys/enabled returns 403', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/surveys/enabled')
      .set('x-user-role', 'student')
      .set('x-allow-permissions', '');
    expect(res.status).toBe(403);
  });

  it('admin request to /api/admin/surveys/enabled passes auth layer', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/surveys/enabled')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_VIEW_SURVEYS);
    expect([200, 404]).toContain(res.status);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('public survey route /api/surveys/enabled remains accessible', async () => {
    const app = createApp();
    const res = await request(app).get('/api/surveys/enabled');
    expect(res.status).toBe(200);
  });
});

