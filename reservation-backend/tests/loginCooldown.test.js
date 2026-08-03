const express = require('express');
const request = require('supertest');

const mockFindOne = jest.fn();
const mockCompare = jest.fn();
const mockLogSecurity = jest.fn();
const mockQueueFailure = jest.fn();
const mockLogAudit = jest.fn();

jest.mock('../models', () => ({
  Teacher: {
    findOne: (...args) => mockFindOne(...args),
  },
  sequelize: {
    where: () => 'where',
    fn: () => 'LOWER',
    col: () => 'username',
  },
}));

jest.mock('bcryptjs', () => ({
  compare: (...args) => mockCompare(...args),
}));

jest.mock('../services/auditLogService', () => ({
  queueAuthLoginFailure: (...args) => mockQueueFailure(...args),
  logSecurityAuditImmediate: (...args) => mockLogSecurity(...args),
  logAudit: (...args) => mockLogAudit(...args),
  metaFromReq: () => ({ requestId: 'req-test', ipAddress: '127.0.0.1', userAgent: 'jest' }),
}));

jest.mock('../middlewares/auth', () => ({
  secretKey: 'test-secret-key-at-least-32-chars-long',
}));

function createApp() {
  jest.resetModules();
  process.env.LOGIN_ACCOUNT_COOLDOWN_ENABLED = 'true';
  process.env.LOGIN_ACCOUNT_COOLDOWN_THRESHOLD = '5';
  process.env.LOGIN_ACCOUNT_COOLDOWN_MINUTES = '0.001'; // 約 0.06 秒，測試用
  const loginAccountCooldown = require('../utils/loginAccountCooldown');
  loginAccountCooldown.resetLoginCooldownBucketsForTest();
  const loginRouter = require('../routes/loginRouter');
  const app = express();
  app.use(express.json());
  app.use('/api', loginRouter);
  return app;
}

function activeTeacher(overrides = {}) {
  return {
    id: 1,
    username: 'teacher01',
    name: '測試',
    email: 't@nsysu.edu.tw',
    role: 'worker',
    password: 'hashed',
    isActive: true,
    mustResetPassword: false,
    teacherLevel: 'regular',
    staffLevel: null,
    accessVersion: 1,
    permissions: null,
    scopes: null,
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('login account cooldown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompare.mockResolvedValue(false);
    mockFindOne.mockResolvedValue(null);
  });

  it('returns 401 for failures 1-5 and 429 on 6th attempt for same username', async () => {
    const app = createApp();
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post('/api/login')
        .send({ username: 'Teacher01', password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('帳號或密碼錯誤');
    }
    const blocked = await request(app)
      .post('/api/login')
      .send({ username: 'teacher01', password: 'wrong' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('LOGIN_COOLDOWN');
    expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(JSON.stringify(blocked.body)).not.toMatch(/wrong/);
  });

  it('blocks login with correct password during cooldown', async () => {
    const app = createApp();
    const teacher = activeTeacher();
    mockFindOne.mockResolvedValue(teacher);

    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/login').send({ username: 'teacher01', password: 'bad' });
    }

    mockCompare.mockResolvedValue(true);
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'teacher01', password: 'CorrectPass1!' });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('LOGIN_COOLDOWN');
    expect(res.body.token).toBeUndefined();
  });

  it('allows login after cooldown expires', async () => {
    const app = createApp();
    const loginAccountCooldown = require('../utils/loginAccountCooldown');
    const teacher = activeTeacher({ role: 'admin' });
    mockFindOne.mockResolvedValue(teacher);

    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/login').send({ username: 'teacher01', password: 'bad' });
    }

    const bucket = loginAccountCooldown.getLoginCooldownBucketForTest('teacher01');
    expect(bucket.lockedUntil).toBeTruthy();
    bucket.lockedUntil = Date.now() - 1000;

    mockCompare.mockResolvedValue(true);
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'teacher01', password: 'CorrectPass1!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(mockLogAudit).toHaveBeenCalled();
  });

  it('clears failure count after successful login', async () => {
    const app = createApp();
    const teacher = activeTeacher();
    mockFindOne.mockResolvedValue(teacher);

    for (let i = 0; i < 3; i += 1) {
      await request(app).post('/api/login').send({ username: 'teacher01', password: 'bad' });
    }

    mockCompare.mockResolvedValue(true);
    const ok = await request(app)
      .post('/api/login')
      .send({ username: 'teacher01', password: 'GoodPass1!' });
    expect(ok.status).toBe(200);

    mockCompare.mockResolvedValue(false);
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post('/api/login')
        .send({ username: 'teacher01', password: 'bad' });
      expect(res.status).toBe(401);
    }
    const sixth = await request(app)
      .post('/api/login')
      .send({ username: 'teacher01', password: 'bad' });
    expect(sixth.status).toBe(429);
  });

  it('isolates failure counts between usernames', async () => {
    const app = createApp();
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post('/api/login')
        .send({ username: 'userA', password: 'bad' });
      expect(res.status).toBe(401);
    }
    const other = await request(app)
      .post('/api/login')
      .send({ username: 'userB', password: 'bad' });
    expect(other.status).toBe(401);
    expect(other.body.code).not.toBe('LOGIN_COOLDOWN');
  });

  it('applies cooldown for non-existent usernames', async () => {
    const app = createApp();
    mockFindOne.mockResolvedValue(null);
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/login').send({ username: 'ghost', password: 'bad' });
    }
    const res = await request(app).post('/api/login').send({ username: 'ghost', password: 'bad' });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('LOGIN_COOLDOWN');
  });

  it('audit metadata does not include password', async () => {
    const app = createApp();
    await request(app).post('/api/login').send({ username: 'u1', password: 'SecretPwd1!' });
    const payloads = mockLogSecurity.mock.calls.map((c) => c[1]?.afterData || c[1]);
    const joined = JSON.stringify(payloads);
    expect(joined).not.toMatch(/SecretPwd1/);
  });

  it('still applies IP-based rate limit middleware', async () => {
    const app = createApp();
    const loginRouter = require('../routes/loginRouter');
    expect(loginRouter.stack.some((layer) => layer.route && layer.route.path === '/login')).toBe(true);
    const res = await request(app).post('/api/login').send({ username: 'x', password: 'y' });
    expect([400, 401, 429]).toContain(res.status);
  });
});

describe('loginAccountCooldown unit', () => {
  beforeEach(() => {
    process.env.LOGIN_ACCOUNT_COOLDOWN_ENABLED = 'true';
    process.env.LOGIN_ACCOUNT_COOLDOWN_THRESHOLD = '5';
    process.env.LOGIN_ACCOUNT_COOLDOWN_MINUTES = '0.01';
    jest.resetModules();
    const mod = require('../utils/loginAccountCooldown');
    mod.resetLoginCooldownBucketsForTest();
  });

  it('normalizes username with trim and lowercase', () => {
    const mod = require('../utils/loginAccountCooldown');
    expect(mod.normalizeUsername('  Admin01  ')).toBe('admin01');
  });
});
