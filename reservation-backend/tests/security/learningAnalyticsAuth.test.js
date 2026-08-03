'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../../middlewares/auth', () => {
  const P = {
    CAN_VIEW_LEARNING_ANALYTICS: 'can_view_learning_analytics',
    CAN_EXPORT_LEARNING_ANALYTICS: 'can_export_learning_analytics',
    CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS: 'can_manage_learning_analytics_settings',
    CAN_MANAGE_ENGLISH_TEST_TRACKING: 'can_manage_english_test_tracking',
    CAN_RUN_LEARNING_ANALYTICS_MODEL: 'can_run_learning_analytics_model',
  };

  const authMiddleware = (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!role) return res.status(401).json({ error: 'unauthenticated' });
    req.user = { id: 1, role };
    req.requestId = 'test-req';
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

  return { authMiddleware, requirePermission, P };
});

jest.mock('../../controllers/learningAnalyticsController', () => ({
  getMeta: (_req, res) => res.json({ success: true, data: { ok: true } }),
  getOverview: (_req, res) => res.json({ success: true, data: { ok: true } }),
  getCohorts: (_req, res) => res.json({ success: true, data: { ok: true } }),
  getResources: (_req, res) => res.json({ success: true, data: { ok: true } }),
  getSkills: (_req, res) => res.json({ success: true, data: { ok: true } }),
  getRawData: (_req, res) => res.json({ success: true, data: { ok: true } }),
  getExport: (_req, res) => res.status(200).send('xlsx'),
  requireStudentScope: (_req, _res, next) => next(),
  getStudentJourney: (_req, res) => res.json({ success: true, data: { ok: true } }),
  getSettings: (_req, res) => res.json({ success: true, data: { ok: true } }),
  putResourceSkillProfiles: (_req, res) => res.json({ success: true, data: { ok: true } }),
  postResetResourceSkillProfile: (_req, res) => res.json({ success: true, data: { ok: true } }),
  putFilterReferences: (_req, res) => res.json({ success: true, data: { ok: true } }),
  putLvaConfig: (_req, res) => res.json({ success: true, data: { ok: true } }),
  postResetLvaConfig: (_req, res) => res.json({ success: true, data: { ok: true } }),
  getInsights: (_req, res) => res.json({ success: true, data: { ok: true } }),
  getStudentRecommendations: (_req, res) => res.json({ success: true, data: { ok: true } }),
  listModelRuns: (_req, res) => res.json({ success: true, data: { ok: true } }),
  getModelRun: (_req, res) => res.json({ success: true, data: { ok: true } }),
  postModelRun: (_req, res) => res.json({ success: true, data: { ok: true } }),
  postPruneSnapshots: (_req, res) => res.json({ success: true, data: { ok: true } }),
}));

const learningAnalyticsRouter = require('../../routes/learningAnalyticsRouter');
const { P } = require('../../middlewares/auth');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/learning-analytics', learningAnalyticsRouter);
  return app;
}

describe('learning analytics API auth boundary', () => {
  it('unauthenticated overview returns 401', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/learning-analytics/overview');
    expect(res.status).toBe(401);
  });

  it('authenticated without permission returns 403', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/learning-analytics/overview')
      .set('x-user-role', 'teacher')
      .set('x-allow-permissions', '');
    expect(res.status).toBe(403);
    expect(res.body.permission).toBe(P.CAN_VIEW_LEARNING_ANALYTICS);
  });

  it('authorized overview returns 200', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/learning-analytics/overview')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_VIEW_LEARNING_ANALYTICS);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('export requires export permission', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/learning-analytics/export?format=xlsx&dataset=students')
      .set('x-user-role', 'teacher')
      .set('x-allow-permissions', P.CAN_VIEW_LEARNING_ANALYTICS);
    expect(res.status).toBe(403);
    expect(res.body.permission).toBe(P.CAN_EXPORT_LEARNING_ANALYTICS);
  });

  it('authorized export returns 200', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/learning-analytics/export?format=xlsx&dataset=students')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_EXPORT_LEARNING_ANALYTICS);
    expect(res.status).toBe(200);
  });

  it('snapshot prune requires manage learning journey permission', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/learning-analytics/snapshots/prune')
      .send({ dryRun: true })
      .set('x-user-role', 'teacher')
      .set('x-allow-permissions', P.CAN_VIEW_LEARNING_ANALYTICS);
    expect(res.status).toBe(403);
    expect(res.body.permission).toBe(P.CAN_MANAGE_ENGLISH_TEST_TRACKING);
  });

  it('authorized snapshot prune dry-run returns 200', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/learning-analytics/snapshots/prune')
      .send({ dryRun: true })
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_MANAGE_ENGLISH_TEST_TRACKING);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('settings requires manage settings permission', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/learning-analytics/settings')
      .set('x-user-role', 'teacher')
      .set('x-allow-permissions', P.CAN_VIEW_LEARNING_ANALYTICS);
    expect(res.status).toBe(403);
    expect(res.body.permission).toBe(P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS);
  });

  it('authorized settings returns 200', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/learning-analytics/settings')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('resource skill profile update requires manage settings permission', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/admin/learning-analytics/settings/resource-skill-profiles')
      .send({ profiles: [{ resourceKey: 'GE', weights: { listening: 0.2 } }] })
      .set('x-user-role', 'teacher')
      .set('x-allow-permissions', P.CAN_VIEW_LEARNING_ANALYTICS);
    expect(res.status).toBe(403);
    expect(res.body.permission).toBe(P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS);
  });

  it('authorized resource skill profile update returns 200', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/admin/learning-analytics/settings/resource-skill-profiles')
      .send({ profiles: [{ resourceKey: 'GE', weights: { listening: 0.2 } }] })
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('model run create requires run permission', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/learning-analytics/model-runs')
      .send({ filters: {} })
      .set('x-user-role', 'teacher')
      .set('x-allow-permissions', P.CAN_VIEW_LEARNING_ANALYTICS);
    expect(res.status).toBe(403);
    expect(res.body.permission).toBe(P.CAN_RUN_LEARNING_ANALYTICS_MODEL);
  });

  it('authorized model run create returns 200', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/learning-analytics/model-runs')
      .send({ filters: {} })
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_RUN_LEARNING_ANALYTICS_MODEL);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
