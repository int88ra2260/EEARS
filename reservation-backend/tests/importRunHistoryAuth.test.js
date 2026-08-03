const request = require('supertest');
const express = require('express');

const PERM = {
  CAN_IMPORT_BESTEP: 'can_import_bestep',
  CAN_MANAGE_ENGLISH_TEST_TRACKING: 'can_manage_english_test_tracking',
  CAN_VIEW_ENGLISH_TEST_TRACKING: 'can_view_english_test_tracking',
  CAN_MANAGE_CLASSES: 'can_manage_classes',
  CAN_VIEW_CLASSES: 'can_view_classes',
  CAN_VIEW_EVENTS_ADMIN: 'can_view_events_admin',
  CAN_MANAGE_EVENTS: 'can_manage_events',
  CAN_VIEW_SURVEYS: 'can_view_surveys',
  CAN_EXPORT_SURVEYS: 'can_export_surveys',
};

jest.mock('../middlewares/auth', () => ({
  authMiddleware: (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    if (authHeader === 'Bearer admin-token') {
      req.user = { id: 1, role: 'admin', permissions: [] };
      return next();
    }
    if (authHeader === 'Bearer worker-token') {
      req.user = { id: 2, role: 'worker', permissions: ['can_view_events_admin'] };
      return next();
    }
    if (authHeader === 'Bearer teacher-token') {
      req.user = { id: 3, role: 'teacher', permissions: ['can_view_classes'] };
      return next();
    }
    if (authHeader === 'Bearer no-perm-token') {
      req.user = { id: 4, role: 'teacher', permissions: [] };
      return next();
    }
    return res.status(401).json({ error: '缺少或無效的認證令牌' });
  },
  requireAnyPermission: (permissions, message) => (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    const userPerms = new Set(req.user?.permissions || []);
    const allowed = permissions.some((p) => userPerms.has(p));
    if (!allowed) {
      return res.status(403).json({ error: message || '權限不足' });
    }
    return next();
  },
  P: PERM,
}));

jest.mock('../controllers/importRunHistoryController', () => ({
  getImportRuns: (_req, res) => res.status(200).json({ success: true, data: { items: [] } }),
  getImportRunDetail: (req, res) =>
    res.status(200).json({
      success: true,
      data: { source: req.params.source, sourceId: req.params.sourceId },
    }),
  deleteImportRun: (_req, res) => res.status(200).json({ success: true, data: {} }),
}));

const router = require('../routes/importRunHistoryRouter');

function createApp() {
  const app = express();
  app.use('/api/admin/import-runs', router);
  return app;
}

describe('importRunHistoryRouter permission policy', () => {
  it('未登入 GET /api/admin/import-runs → 401', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/import-runs');
    expect(res.status).toBe(401);
  });

  it('admin token → 200', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/import-runs')
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(200);
  });

  it('worker token 且有 CAN_VIEW_EVENTS_ADMIN → 200', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/import-runs')
      .set('Authorization', 'Bearer worker-token');
    expect(res.status).toBe(200);
  });

  it('teacher token 且有清單內 permission → 200', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/import-runs')
      .set('Authorization', 'Bearer teacher-token');
    expect(res.status).toBe(200);
  });

  it('無清單 permissions 的 token → 403', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/import-runs')
      .set('Authorization', 'Bearer no-perm-token');
    expect(res.status).toBe(403);
  });

  it('DELETE 需 BESTEP 匯入或 LJ 管理權限', async () => {
    const app = createApp();
    const denied = await request(app)
      .delete('/api/admin/import-runs/audit_log/1')
      .set('Authorization', 'Bearer no-perm-token');
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .delete('/api/admin/import-runs/audit_log/1')
      .set('Authorization', 'Bearer admin-token');
    expect(ok.status).toBe(200);
  });

  it('detail endpoint 套用相同權限（無權限 403；有權限 200）', async () => {
    const app = createApp();
    const denied = await request(app)
      .get('/api/admin/import-runs/job_run/123')
      .set('Authorization', 'Bearer no-perm-token');
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .get('/api/admin/import-runs/job_run/123')
      .set('Authorization', 'Bearer worker-token');
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual(expect.objectContaining({ success: true }));
  });
});

