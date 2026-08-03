const request = require('supertest');
const express = require('express');

jest.mock('../middlewares/auth', () => ({
  authMiddleware: (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    if (authHeader === 'Bearer admin-token') {
      req.user = { id: 1, role: 'admin' };
      return next();
    }
    if (authHeader === 'Bearer exec-token') {
      req.user = { id: 2, role: 'teacher', teacherLevel: 'executive' };
      return next();
    }
    if (authHeader === 'Bearer teacher-token') {
      req.user = { id: 3, role: 'teacher', teacherLevel: 'regular', name: 'Regular Teacher' };
      return next();
    }
    if (authHeader === 'Bearer et-manager-token') {
      req.user = { id: 4, role: 'teacher', teacherLevel: 'et_manager', name: 'ET Manager' };
      return next();
    }
    return res.status(401).json({ error: '缺少或無效的認證令牌' });
  },
  requirePermission: (_permission) => (_req, _res, next) => next(),
  requireSystemPermission: (_permission, message) => (req, res, next) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: message || '僅限系統管理員' });
    }
    return next();
  },
  P: {
    CAN_VIEW_ANALYTICS: 'can_view_analytics',
  },
}));

jest.mock('../services/analyticsService', () => ({
  getAdminOverview: jest.fn().mockResolvedValue({ ok: true, source: 'admin_overview' }),
  getReservationOverview: jest.fn().mockResolvedValue({ ok: true, source: 'reservation_overview' }),
  getReservationActivityTrends: jest.fn().mockResolvedValue([{ ok: true }]),
  getReservationClassRankings: jest.fn().mockResolvedValue([]),
  getReservationEventsAttendanceTrend: jest.fn().mockResolvedValue([]),
  getReservationCapacityBreakdown: jest.fn().mockResolvedValue({
    semester: '114-1',
    range: null,
    items: [],
    summary: { reservedCount: 0, capacity: 0, utilizationRate: 0 },
    byEventType: [],
    byEvent: [],
  }),
}));

jest.mock('../services/riskDetectionService', () => ({
  getHighRisksForSemester: jest.fn().mockResolvedValue([]),
  predictStudentRisk: jest.fn().mockResolvedValue({}),
}));

jest.mock('../services/trendAnalysisService', () => ({
  getOverviewTrends: jest.fn().mockResolvedValue({ ok: true, source: 'overview_trends' }),
  getStudentTrends: jest.fn().mockResolvedValue({ ok: true, source: 'student_trends' }),
  getClassTrends: jest.fn().mockResolvedValue({ ok: true, source: 'class_trends' }),
}));

jest.mock('../services/teacherEvaluationService', () => ({
  getTeacherDashboard: jest.fn().mockResolvedValue({ ok: true, source: 'teacher_dashboard' }),
}));

jest.mock('../services/studentProfileService', () => ({
  getStudentProfile: jest.fn().mockResolvedValue({ ok: true, source: 'student_profile' }),
}));

jest.mock('../services/classEvaluationService', () => ({
  getClassEvaluation: jest.fn().mockResolvedValue({ ok: true, source: 'class_evaluation' }),
}));

jest.mock('../services/accessControl/classScopeGuard', () => ({
  assertCanAccessClass: jest.fn().mockResolvedValue(true),
  sendClassScopeDenied: (res, _err) => res.status(403).json({ error: 'CLASS_SCOPE_DENIED' }),
}));

jest.mock('../services/accessControl/studentScopeGuard', () => ({
  assertCanAccessStudent: jest.fn().mockResolvedValue(true),
  sendStudentScopeDenied: (res, _err) => res.status(403).json({ error: 'STUDENT_SCOPE_DENIED' }),
}));

jest.mock('../models', () => ({
  Class: { findByPk: jest.fn().mockResolvedValue({ id: 1 }) },
}));

const analyticsRouter = require('../routes/analyticsRouter');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', analyticsRouter);
  return app;
}

describe('Analytics admin-only API policy', () => {
  test('admin token → GET /api/analytics/overview should be 200', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/analytics/overview?semester=114-1')
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(200);
  });

  test('executive teacher token → GET /api/analytics/overview should be 200', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/analytics/overview?semester=114-1')
      .set('Authorization', 'Bearer exec-token');
    expect(res.status).toBe(200);
  });

  test('executive teacher token → GET /api/analytics/risk should be 200', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/analytics/risk?semester=114-1')
      .set('Authorization', 'Bearer exec-token');
    expect(res.status).toBe(200);
  });

  test('executive teacher token → GET /api/analytics/trends/overview should be 200', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/analytics/trends/overview?fromSemester=114-1&toSemester=114-2')
      .set('Authorization', 'Bearer exec-token');
    expect(res.status).toBe(200);
  });

  test('et_manager teacher token → GET /api/analytics/trends/overview should be 403', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/analytics/trends/overview?fromSemester=114-1&toSemester=114-2')
      .set('Authorization', 'Bearer et-manager-token');
    expect(res.status).toBe(403);
  });

  test('regular teacher token → GET /api/analytics/teachers/3/dashboard should be 200', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/analytics/teachers/3/dashboard?semester=114-1')
      .set('Authorization', 'Bearer teacher-token');
    expect(res.status).toBe(200);
  });

  test('regular teacher token → GET /api/analytics/trends/overview should be 403', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/analytics/trends/overview?fromSemester=114-1&toSemester=114-2')
      .set('Authorization', 'Bearer teacher-token');
    expect(res.status).toBe(403);
  });

  test('executive teacher token → GET /api/analytics/trends?kind=reservation should be 403', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/analytics/trends?kind=reservation&semester=114-1')
      .set('Authorization', 'Bearer exec-token');
    expect(res.status).toBe(403);
  });

  test('non admin-only endpoint unaffected: teacher dashboard scope still applies', async () => {
    const app = createApp();

    const forbidden = await request(app)
      .get('/api/analytics/teachers/999/dashboard?semester=114-1')
      .set('Authorization', 'Bearer teacher-token');
    expect(forbidden.status).toBe(403);

    const okSelf = await request(app)
      .get('/api/analytics/teachers/3/dashboard?semester=114-1')
      .set('Authorization', 'Bearer teacher-token');
    expect(okSelf.status).toBe(200);
  });
});

