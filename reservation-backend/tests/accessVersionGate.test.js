const request = require('supertest');
const express = require('express');

const mockFindByPk = jest.fn();
const mockResolveEffective = jest.fn(async (u) => u);

jest.mock('../models', () => ({
  Teacher: {
    findByPk: (...args) => mockFindByPk(...args),
  },
}));

jest.mock('../auth/accessProfile', () => ({
  buildAccessProfile: jest.fn(() => ({ hasAdminRights: true, finalScopes: ['all'], permissionSet: new Set() })),
  attachAccessProfile: jest.fn((req) => {
    req.accessProfile = { hasAdminRights: true, finalScopes: ['all'], permissionSet: new Set() };
    return req.accessProfile;
  }),
  resolveEffectiveAccessSources: (...args) => mockResolveEffective(...args),
  getAccessProfileReadMode: jest.fn(() => 'json_only'),
  hasPermission: jest.fn(() => true),
  hasAnyPermission: jest.fn(() => true),
  hasAllPermissions: jest.fn(() => true),
  canAccessEventType: jest.fn(() => true),
  canAccessSurvey: jest.fn(() => true),
}));

const jwt = require('jsonwebtoken');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');

describe('accessVersion gate middleware', () => {
  const oldEnv = { ...process.env };
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...oldEnv };
    app = express();
    app.use(express.json());
    app.get('/api/admin/protected', authMiddleware, (req, res) => {
      res.json({ ok: true, mismatch: req.accessVersionMismatch || null });
    });
    app.get('/api/public/probe', optionalAuthMiddleware, (req, res) => {
      res.json({ ok: true, mismatch: req.accessVersionMismatch || null, hasUser: !!req.user });
    });
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  function mockJwt(decoded) {
    jest.spyOn(jwt, 'verify').mockImplementation((_token, _secret, cb) => cb(null, decoded));
  }

  it('新 token 版本一致會通過', async () => {
    process.env.ACCESS_VERSION_CHECK_ENABLED = 'true';
    mockJwt({ id: 1, role: 'admin', accessVersion: 3 });
    mockFindByPk.mockResolvedValue({ id: 1, isActive: true, accessVersion: 3 });

    const res = await request(app).get('/api/admin/protected').set('Authorization', 'Bearer ok');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.mismatch).toBeNull();
  });

  it('舊 token 在 observe 模式僅記錄不攔截', async () => {
    process.env.ACCESS_VERSION_CHECK_ENABLED = 'true';
    process.env.ACCESS_VERSION_ENFORCE_PATH_PREFIXES = '/api/some-other-prefix';
    mockJwt({ id: 1, role: 'admin', accessVersion: 1 });
    mockFindByPk.mockResolvedValue({ id: 1, isActive: true, accessVersion: 2 });

    const res = await request(app).get('/api/admin/protected').set('Authorization', 'Bearer old');
    expect(res.status).toBe(200);
  });

  it('無 accessVersion token 在 observe 模式不攔截', async () => {
    process.env.ACCESS_VERSION_CHECK_ENABLED = 'true';
    process.env.ACCESS_VERSION_ENFORCE_PATH_PREFIXES = '/api/some-other-prefix';
    mockJwt({ id: 1, role: 'admin' });
    mockFindByPk.mockResolvedValue({ id: 1, isActive: true, accessVersion: 2 });

    const res = await request(app).get('/api/admin/protected').set('Authorization', 'Bearer legacy-observe');
    expect(res.status).toBe(200);
  });

  it('舊 token 在 enforce 模式會被攔截', async () => {
    process.env.ACCESS_VERSION_CHECK_ENABLED = 'true';
    process.env.ACCESS_VERSION_ENFORCE_PATH_PREFIXES = '/api/admin';
    mockJwt({ id: 1, role: 'admin', accessVersion: 1 });
    mockFindByPk.mockResolvedValue({ id: 1, isActive: true, accessVersion: 2 });

    const res = await request(app).get('/api/admin/protected').set('Authorization', 'Bearer stale');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ACCESS_PROFILE_STALE');
  });

  it('無 accessVersion token 在 enforce 模式視為 stale', async () => {
    process.env.ACCESS_VERSION_CHECK_ENABLED = 'true';
    process.env.ACCESS_VERSION_ENFORCE_PATH_PREFIXES = '/api/admin';
    mockJwt({ id: 1, role: 'admin' });
    mockFindByPk.mockResolvedValue({ id: 1, isActive: true, accessVersion: 2 });

    const res = await request(app).get('/api/admin/protected').set('Authorization', 'Bearer legacy');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ACCESS_PROFILE_STALE');
  });

  it('optionalAuthMiddleware 在公開流程不誤傷', async () => {
    process.env.ACCESS_VERSION_CHECK_ENABLED = 'true';
    process.env.ACCESS_VERSION_ENFORCE_PATH_PREFIXES = '/api/admin';
    mockJwt({ id: 1, role: 'teacher', accessVersion: 1 });
    mockFindByPk.mockResolvedValue({ id: 1, isActive: true, accessVersion: 2 });

    const res = await request(app).get('/api/public/probe').set('Authorization', 'Bearer stale');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.hasUser).toBe(true);
    expect(res.body.mismatch).toBeTruthy();
  });

  it('停用帳號會被 auth middleware 擋下 ACCOUNT_DISABLED', async () => {
    process.env.ACCESS_VERSION_CHECK_ENABLED = 'true';
    mockJwt({ id: 1, role: 'admin', accessVersion: 2 });
    mockFindByPk.mockResolvedValue({ id: 1, isActive: false, accessVersion: 2 });

    const res = await request(app).get('/api/admin/protected').set('Authorization', 'Bearer disabled');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });
});

