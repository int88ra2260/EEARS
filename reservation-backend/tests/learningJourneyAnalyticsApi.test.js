'use strict';

jest.mock('../services/learningJourney/analytics/timelineReadService', () => ({
  getStudentTimeline: jest.fn(),
  resolveLatestSnapshotVersion: jest.fn(),
}));

jest.mock('../services/learningJourney/analytics/analyticsSummaryService', () => ({
  getAnalyticsSummary: jest.fn(),
}));

jest.mock('../services/learningJourney/analytics/lvaAnalyticsService', () => ({
  getLvaAnalytics: jest.fn(),
}));

jest.mock('../services/learningJourney/analytics/lvaModelRunService', () => ({
  createLvaModelRun: jest.fn(),
  listLvaModelRuns: jest.fn(),
  getLvaModelRun: jest.fn(),
}));

jest.mock('../middlewares/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user']) : null;
    req.requestId = 'test-req';
    next();
  },
  requirePermission: () => (req, res, next) => next(),
  requireAnyPermission: () => (req, res, next) => next(),
  P: {
    CAN_VIEW_ENGLISH_TEST_TRACKING: 'CAN_VIEW_ENGLISH_TEST_TRACKING',
    CAN_MANAGE_ENGLISH_TEST_TRACKING: 'CAN_MANAGE_ENGLISH_TEST_TRACKING',
  },
}));

jest.mock('../services/accessControl/studentScopeGuard', () => ({
  assertCanAccessStudent: jest.fn().mockResolvedValue(),
  sendStudentScopeDenied: (res) => res.status(403).json({ success: false }),
}));

const request = require('supertest');
const express = require('express');
const router = require('../routes/learningJourneyV3Router');
const { getStudentTimeline } = require('../services/learningJourney/analytics/timelineReadService');
const { getAnalyticsSummary } = require('../services/learningJourney/analytics/analyticsSummaryService');
const { getLvaAnalytics } = require('../services/learningJourney/analytics/lvaAnalyticsService');
const {
  createLvaModelRun,
  listLvaModelRuns,
  getLvaModelRun,
} = require('../services/learningJourney/analytics/lvaModelRunService');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/learning-journey-v3', router);
  return app;
}

describe('learning journey analytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 without auth user', async () => {
    const res = await request(makeApp()).get('/api/admin/learning-journey-v3/students/S001/timeline');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns timeline payload with lane fields', async () => {
    getStudentTimeline.mockResolvedValue({
      student: { studentId: 'S001' },
      timeline: [{ eventId: '1', lane: 'exam', eventType: 'exam' }],
      meta: { snapshotVersion: 'v1', warnings: [] },
    });
    const res = await request(makeApp())
      .get('/api/admin/learning-journey-v3/students/S001/timeline')
      .set('x-test-user', JSON.stringify({ role: 'admin', permissions: [] }));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.timeline[0].lane).toBe('exam');
  });

  it('returns analytics summary payload', async () => {
    getAnalyticsSummary.mockResolvedValue({
      snapshotVersion: 'v1',
      totals: { students: 10, b2plusCount: 4, b2plusRate: 0.4 },
      distributions: { exposure: { low: 3 }, cohort: {}, examSkills: {} },
      notes: [],
    });
    const res = await request(makeApp())
      .get('/api/admin/learning-journey-v3/analytics/summary?cohort=112')
      .set('x-test-user', JSON.stringify({ role: 'admin', permissions: [] }));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totals.students).toBe(10);
    expect(getAnalyticsSummary).toHaveBeenCalledWith(expect.objectContaining({ cohort: '112' }));
  });

  it('returns LVA analytics payload', async () => {
    getLvaAnalytics.mockResolvedValue({
      contractVersion: 'lva.analytics.response.v1',
      version: 'eears-lva-2026-v1',
      snapshotVersion: 'v1',
      estimatePolicy: { causalClaimAllowed: false },
      gse: { scale: { A1: 25.5, B2: 67 } },
      adjustedGrowth: { estimateType: 'baseline_adjusted_simplified', causalClaimAllowed: false },
      resourceEffectiveness: [{ estimateType: 'descriptive', causalClaimAllowed: false }],
      cautions: ['descriptive only'],
    });
    const res = await request(makeApp())
      .get('/api/admin/learning-journey-v3/analytics/lva?department=外文')
      .set('x-test-user', JSON.stringify({ role: 'admin', permissions: [] }));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.contractVersion).toBe('lva.analytics.response.v1');
    expect(res.body.data.version).toBe('eears-lva-2026-v1');
    expect(res.body.data.estimatePolicy.causalClaimAllowed).toBe(false);
    expect(res.body.data.resourceEffectiveness[0].causalClaimAllowed).toBe(false);
    expect(getLvaAnalytics).toHaveBeenCalledWith(expect.objectContaining({ department: '外文' }));
  });

  it('creates LVA model run payload', async () => {
    createLvaModelRun.mockResolvedValue({
      modelRun: { id: 7, modelName: 'EEARS-LVA', contractVersion: 'lva.analytics.response.v1' },
      persisted: {
        resourceEffectEstimates: 2,
        learningGrowthEpisodes: 3,
        studentResourceExposures: 4,
      },
    });
    const res = await request(makeApp())
      .post('/api/admin/learning-journey-v3/analytics/lva/model-runs')
      .set('x-test-user', JSON.stringify({ role: 'admin', username: 'admin1', permissions: [] }))
      .send({ filters: { department: '外文' } });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.modelRun.id).toBe(7);
    expect(createLvaModelRun).toHaveBeenCalledWith(
      expect.objectContaining({ department: '外文' }),
      expect.objectContaining({ user: expect.objectContaining({ username: 'admin1' }) })
    );
  });

  it('lists and gets LVA model runs', async () => {
    listLvaModelRuns.mockResolvedValue({ total: 1, items: [{ id: 7 }] });
    getLvaModelRun.mockResolvedValue({ modelRun: { id: 7 }, resourceEffects: [], growthEpisodes: [] });
    const listRes = await request(makeApp())
      .get('/api/admin/learning-journey-v3/analytics/lva/model-runs')
      .set('x-test-user', JSON.stringify({ role: 'admin', permissions: [] }));
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.total).toBe(1);

    const detailRes = await request(makeApp())
      .get('/api/admin/learning-journey-v3/analytics/lva/model-runs/7')
      .set('x-test-user', JSON.stringify({ role: 'admin', permissions: [] }));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.modelRun.id).toBe(7);
    expect(getLvaModelRun).toHaveBeenCalledWith('7');
  });
});
