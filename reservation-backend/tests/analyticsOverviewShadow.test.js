'use strict';

const request = require('supertest');
const express = require('express');

jest.mock('../middlewares/auth', () => ({
  authMiddleware: (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    if (authHeader === 'Bearer admin-token') {
      req.user = { id: 1, role: 'admin' };
      return next();
    }
    return res.status(401).json({ error: '缺少或無效的認證令牌' });
  },
  requirePermission: () => (_req, _res, next) => next(),
  requireSystemPermission: () => (req, res, next) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: '僅限系統管理員' });
    }
    return next();
  },
  P: {
    CAN_VIEW_ANALYTICS: 'can_view_analytics',
  },
}));

jest.mock('../services/analyticsService', () => ({
  getAdminOverview: jest.fn(),
  getReservationOverview: jest.fn(),
  getReservationActivityTrends: jest.fn().mockResolvedValue([]),
  getReservationClassRankings: jest.fn().mockResolvedValue([]),
  getReservationEventsAttendanceTrend: jest.fn().mockResolvedValue([]),
  getReservationCapacityBreakdown: jest.fn().mockResolvedValue({}),
}));

jest.mock('../services/riskDetectionService', () => ({
  getHighRisksForSemester: jest.fn().mockResolvedValue([]),
  predictStudentRisk: jest.fn().mockResolvedValue({}),
}));

jest.mock('../services/trendAnalysisService', () => ({
  getOverviewTrends: jest.fn().mockResolvedValue({}),
  getStudentTrends: jest.fn().mockResolvedValue({}),
  getClassTrends: jest.fn().mockResolvedValue({}),
}));

jest.mock('../services/teacherEvaluationService', () => ({
  getTeacherDashboard: jest.fn().mockResolvedValue({}),
}));

jest.mock('../services/studentProfileService', () => ({
  getStudentProfile: jest.fn().mockResolvedValue({}),
}));

jest.mock('../services/classEvaluationService', () => ({
  getClassEvaluation: jest.fn().mockResolvedValue({}),
}));

jest.mock('../services/accessControl/classScopeGuard', () => ({
  assertCanAccessClass: jest.fn().mockResolvedValue(true),
  sendClassScopeDenied: (res) => res.status(403).json({ error: 'CLASS_SCOPE_DENIED' }),
}));

jest.mock('../services/accessControl/studentScopeGuard', () => ({
  assertCanAccessStudent: jest.fn().mockResolvedValue(true),
  sendStudentScopeDenied: (res) => res.status(403).json({ error: 'STUDENT_SCOPE_DENIED' }),
}));

jest.mock('../models', () => ({
  Class: { findByPk: jest.fn().mockResolvedValue({ id: 1 }) },
}));

const analyticsService = require('../services/analyticsService');
const analyticsRouter = require('../routes/analyticsRouter');
const validator = require('../analytics-contracts/pilots/activityOpsShadowValidator');
const runtime = require('../analytics-contracts/pilots/activityOpsShadowRuntime');

function sampleOverview() {
  return {
    semester: '114-2',
    totalReservations: 4,
    totalEventCapacity: 8,
    bookingRate: 50,
    attendanceRate: 25,
    violationRate: 0,
    englishPassRate: 0,
    capacityBreakdown: {
      semester: '114-2',
      range: { startDate: '2026-02-01', endDate: '2026-07-31' },
      items: [],
      summary: { reservedCount: 0, capacity: 0, utilizationRate: 0 },
      byEventType: [],
      byEvent: [],
    },
  };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', analyticsRouter);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

async function getOverview(app, query) {
  return request(app)
    .get(`/api/analytics/overview?${query}`)
    .set('Authorization', 'Bearer admin-token');
}

describe('reservation overview shadow hook', () => {
  let validateSpy;

  beforeEach(() => {
    delete process.env.ANALYTICS_SEMANTIC_SHADOW_ENABLED;
    delete process.env.ANALYTICS_SEMANTIC_SHADOW_LOG;
    analyticsService.getReservationOverview.mockReset();
    analyticsService.getAdminOverview.mockReset();
    validateSpy = jest.spyOn(validator, 'validateActivityOpsOverview');
  });

  afterEach(() => {
    validateSpy.mockRestore();
    delete process.env.ANALYTICS_SEMANTIC_SHADOW_ENABLED;
  });

  test('E02 and E21 flag off leaves reservation and other kinds untouched', async () => {
    const reservation = sampleOverview();
    const admin = { ok: true, source: 'admin_overview' };
    analyticsService.getReservationOverview.mockResolvedValue(reservation);
    analyticsService.getAdminOverview.mockResolvedValue(admin);
    const app = createApp();

    const reservationRes = await getOverview(app, 'semester=114-2&kind=reservation');
    const adminRes = await getOverview(app, 'semester=114-2&kind=admin');

    expect(reservationRes.status).toBe(200);
    expect(reservationRes.body).toEqual(reservation);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body).toEqual(admin);
    expect(analyticsService.getReservationOverview).toHaveBeenCalledTimes(1);
    expect(analyticsService.getAdminOverview).toHaveBeenCalledTimes(1);
    expect(validateSpy).not.toHaveBeenCalled();
  });

  test('E03 E23 E24 shadow on keeps the legacy JSON and hides diagnostics', async () => {
    process.env.ANALYTICS_SEMANTIC_SHADOW_ENABLED = 'true';
    const reservation = sampleOverview();
    const snapshot = JSON.stringify(reservation);
    analyticsService.getReservationOverview.mockResolvedValue(reservation);
    const app = createApp();

    const res = await getOverview(app, 'semester=114-2&kind=reservation');

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toBe(snapshot);
    expect(res.body.pilotId).toBeUndefined();
    expect(res.body.warnings).toBeUndefined();
    expect(res.body.errors).toBeUndefined();
    expect(res.body.status).toBeUndefined();
    expect(analyticsService.getReservationOverview).toHaveBeenCalledTimes(1);
    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(reservation)).toBe(snapshot);
  });

  test('E04 a thrown validator does not change the response', async () => {
    process.env.ANALYTICS_SEMANTIC_SHADOW_ENABLED = 'true';
    const reservation = sampleOverview();
    analyticsService.getReservationOverview.mockResolvedValue(reservation);
    validateSpy.mockImplementation(() => {
      throw new Error('student B12345678');
    });
    const app = createApp();

    const res = await getOverview(app, 'semester=114-2&kind=reservation');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(reservation);
    expect(JSON.stringify(res.body)).not.toContain('B12345678');
  });

  test('controller still responds when the shadow runtime itself throws', async () => {
    process.env.ANALYTICS_SEMANTIC_SHADOW_ENABLED = 'true';
    const reservation = sampleOverview();
    analyticsService.getReservationOverview.mockResolvedValue(reservation);
    const runtimeSpy = jest.spyOn(runtime, 'runActivityOpsShadow').mockImplementation(() => {
      throw new Error('shadow boom');
    });
    const app = createApp();

    const res = await getOverview(app, 'semester=114-2&kind=RESERVATION');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(reservation);
    runtimeSpy.mockRestore();
  });

  test('E05 legacy service errors are not swallowed', async () => {
    process.env.ANALYTICS_SEMANTIC_SHADOW_ENABLED = 'true';
    analyticsService.getReservationOverview.mockRejectedValue(new Error('資料庫失敗'));
    const app = createApp();

    const res = await getOverview(app, 'semester=114-2&kind=reservation');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: '資料庫失敗' });
    expect(validateSpy).not.toHaveBeenCalled();
  });

  test('illegal semester stays 400 and does not run shadow', async () => {
    process.env.ANALYTICS_SEMANTIC_SHADOW_ENABLED = 'true';
    analyticsService.getReservationOverview.mockRejectedValue(new Error('不支援的學期'));
    const app = createApp();

    const res = await getOverview(app, 'semester=999-9&kind=reservation');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: '不支援的學期' });
    expect(validateSpy).not.toHaveBeenCalled();
  });

  test('missing semester stays 400 before any service or shadow call', async () => {
    process.env.ANALYTICS_SEMANTIC_SHADOW_ENABLED = 'true';
    const app = createApp();

    const res = await getOverview(app, 'kind=reservation');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: '請提供 query: semester' });
    expect(analyticsService.getReservationOverview).not.toHaveBeenCalled();
    expect(validateSpy).not.toHaveBeenCalled();
  });

  test('E22 unknown kind still uses the admin overview when shadow is on', async () => {
    process.env.ANALYTICS_SEMANTIC_SHADOW_ENABLED = 'true';
    const admin = { ok: true, source: 'admin_overview', kind: 'workshop' };
    analyticsService.getAdminOverview.mockResolvedValue(admin);
    const app = createApp();

    const res = await getOverview(app, 'semester=114-2&kind=workshop');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(admin);
    expect(analyticsService.getReservationOverview).not.toHaveBeenCalled();
    expect(analyticsService.getAdminOverview).toHaveBeenCalledWith('114-2');
    expect(validateSpy).not.toHaveBeenCalled();
  });

  test('null legacy result is returned unchanged', async () => {
    process.env.ANALYTICS_SEMANTIC_SHADOW_ENABLED = 'true';
    analyticsService.getReservationOverview.mockResolvedValue(null);
    const app = createApp();

    const res = await getOverview(app, 'semester=114-2&kind=reservation');

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
    expect(validateSpy).toHaveBeenCalledTimes(1);
  });

  test('production flag does not run shadow on the route', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.ANALYTICS_SEMANTIC_SHADOW_ENABLED = 'true';
    analyticsService.getReservationOverview.mockResolvedValue(sampleOverview());
    const app = createApp();
    try {
      const res = await getOverview(app, 'semester=114-2&kind=reservation');
      expect(res.status).toBe(200);
      expect(validateSpy).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previous;
      delete process.env.ANALYTICS_SEMANTIC_SHADOW_ENABLED;
    }
  });
});
