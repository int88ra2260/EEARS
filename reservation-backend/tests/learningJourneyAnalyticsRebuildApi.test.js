'use strict';

const {
  shouldRunAsync,
  startAnalyticsRebuildJob,
  runAnalyticsRebuildSync,
} = require('../services/learningJourney/analytics/analyticRebuildJobService');

jest.mock('../services/learningJourney/analytics/analyticRebuildJobService', () => ({
  shouldRunAsync: jest.fn(),
  startAnalyticsRebuildJob: jest.fn(),
  runAnalyticsRebuildSync: jest.fn(),
}));

jest.mock('../services/learningJourney/analytics/timelineReadService', () => ({
  getStudentTimeline: jest.fn(),
  resolveLatestSnapshotVersion: jest.fn(),
}));

jest.mock('../services/learningJourney/analytics/analyticsSummaryService', () => ({
  getAnalyticsSummary: jest.fn(),
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

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/learning-journey-v3', router);
  return app;
}

const authUser = {
  id: 1,
  user: 'admin',
  permissions: ['CAN_MANAGE_ENGLISH_TEST_TRACKING', 'CAN_VIEW_ENGLISH_TEST_TRACKING'],
};

describe('learning journey analytics rebuild API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 202 for async global rebuild', async () => {
    shouldRunAsync.mockReturnValue(true);
    startAnalyticsRebuildJob.mockResolvedValue({
      alreadyRunning: false,
      run: { id: 99 },
      async: true,
    });

    const res = await request(makeApp())
      .post('/api/admin/learning-journey-v3/analytics/rebuild')
      .set('x-test-user', JSON.stringify(authUser))
      .send({ scope: 'global', confirm: true });

    expect(res.status).toBe(202);
    expect(res.body.async).toBe(true);
    expect(res.body.data.operationRunId).toBe(99);
    expect(startAnalyticsRebuildJob).toHaveBeenCalled();
  });

  it('returns 409 when rebuild already running', async () => {
    shouldRunAsync.mockReturnValue(true);
    startAnalyticsRebuildJob.mockResolvedValue({
      alreadyRunning: true,
      run: { id: 12 },
    });

    const res = await request(makeApp())
      .post('/api/admin/learning-journey-v3/analytics/rebuild')
      .set('x-test-user', JSON.stringify(authUser))
      .send({ scope: 'global' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 for small sync rebuild', async () => {
    shouldRunAsync.mockReturnValue(false);
    runAnalyticsRebuildSync.mockResolvedValue({
      snapshotVersion: 'snap-1',
      analyticStudentCount: 1,
      analyticExamCount: 2,
    });

    const res = await request(makeApp())
      .post('/api/admin/learning-journey-v3/analytics/rebuild')
      .set('x-test-user', JSON.stringify(authUser))
      .send({ scope: 'manual', studentIds: ['S001'] });

    expect(res.status).toBe(200);
    expect(res.body.data.analyticStudentCount).toBe(1);
    expect(runAnalyticsRebuildSync).toHaveBeenCalled();
  });
});
