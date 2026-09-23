'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../../middlewares/auth', () => {
  const authMiddleware = (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!role) return res.status(401).json({ error: 'unauthenticated' });
    req.user = { id: 1, role, name: 'tester' };
    req.requestId = 'test-ops-req';
    next();
  };

  const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要系統管理員身分' });
    }
    return next();
  };

  return { authMiddleware, requireAdmin };
});

const mockStart = jest.fn();
const mockHealth = jest.fn();
const mockJob = jest.fn();

jest.mock('../../services/opsScriptsService', () => ({
  getBackupHealthSnapshot: (...args) => mockHealth(...args),
  getBackupJobStatus: (...args) => mockJob(...args),
  startBackupJob: (...args) => mockStart(...args),
}));

const adminOpsScriptsRouter = require('../../routes/adminOpsScriptsRouter');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/ops-scripts', adminOpsScriptsRouter);
  return app;
}

describe('adminOpsScriptsRouter auth', () => {
  beforeEach(() => {
    mockHealth.mockReset();
    mockJob.mockReset();
    mockStart.mockReset();
    mockHealth.mockReturnValue({ ok: true, code: 'OK' });
    mockJob.mockReturnValue({ status: 'idle' });
    mockStart.mockReturnValue({ status: 'running' });
  });

  it('rejects unauthenticated requests', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/ops-scripts/backup/health');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin roles', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/ops-scripts/backup/health')
      .set('x-user-role', 'teacher');
    expect(res.status).toBe(403);
  });

  it('allows admin to read backup health', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/ops-scripts/backup/health')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.health.ok).toBe(true);
  });

  it('allows admin to start backup job', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/ops-scripts/backup/run')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(202);
    expect(mockStart).toHaveBeenCalled();
    expect(res.body.data.status).toBe('running');
  });

  it('maps service conflict to 409', async () => {
    const err = new Error('備份作業執行中');
    err.status = 409;
    err.code = 'BACKUP_JOB_RUNNING';
    mockStart.mockImplementation(() => {
      throw err;
    });
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/ops-scripts/backup/run')
      .set('x-user-role', 'admin');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BACKUP_JOB_RUNNING');
  });
});
