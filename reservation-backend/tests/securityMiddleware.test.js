const express = require('express');
const request = require('supertest');
const { errorHandler } = require('../middlewares/errorHandler');
const {
  createSecurityHeadersMiddleware,
  createGlobalRateLimitMiddleware,
  getRequestBodyLimit,
} = require('../config/httpSecurity');

function buildTestApp(options = {}) {
  const app = express();
  app.use(createSecurityHeadersMiddleware());
  const limit = options.bodyLimit || '100b';
  app.use(express.json({ limit }));
  if (options.rateLimit) {
    if (options.rateLimitEnabled !== false) {
      process.env.GLOBAL_RATE_LIMIT_ENABLED = 'true';
    }
    process.env.GLOBAL_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.GLOBAL_RATE_LIMIT_MAX = String(options.rateLimitMax ?? 2);
    app.use('/api', createGlobalRateLimitMiddleware());
  }
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/admin/learning-journey-v3/semesters/1/b2-report', (req, res) => res.json({ ok: true }));
  app.get('/api/english-learning-passport/me', (req, res) => res.json({ ok: true }));
  app.post('/api/echo', (req, res) => res.json({ ok: true, body: req.body }));
  app.get('/api/error', () => {
    throw new Error('simulated failure');
  });
  app.use(errorHandler);
  return app;
}

describe('security middleware', () => {
  const prevEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it('creates global rate limit middleware without ValidationError', () => {
    process.env.GLOBAL_RATE_LIMIT_ENABLED = 'true';
    expect(() => createGlobalRateLimitMiddleware()).not.toThrow();
    const middleware = createGlobalRateLimitMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('sets helmet-related headers such as X-Content-Type-Options', async () => {
    const app = buildTestApp();
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('returns 413 for oversized JSON body', async () => {
    const app = buildTestApp({ bodyLimit: '50b' });
    const big = { data: 'x'.repeat(200) };
    const res = await request(app).post('/api/echo').send(big);
    expect(res.status).toBe(413);
  });

  it('returns 429 with RATE_LIMIT_EXCEEDED when over threshold', async () => {
    const app = buildTestApp({ rateLimit: true, rateLimitMax: 2 });
    await request(app).post('/api/echo').send({ n: 1 });
    await request(app).post('/api/echo').send({ n: 2 });
    const res = await request(app).post('/api/echo').send({ n: 3 });
    expect(res.body).toMatchObject({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: '請求次數過多，請稍後再試。',
    });
  });

  it('does not rate-limit /api/health when other routes are limited', async () => {
    const app = buildTestApp({ rateLimit: true, rateLimitMax: 1 });
    await request(app).post('/api/echo').send({ a: 1 });
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
    }
  });

  it('does not rate-limit /api/admin/* when public routes are limited', async () => {
    const app = buildTestApp({ rateLimit: true, rateLimitMax: 1 });
    await request(app).post('/api/echo').send({ a: 1 });
    const blocked = await request(app).post('/api/echo').send({ a: 2 });
    expect(blocked.status).toBe(429);
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get('/api/admin/learning-journey-v3/semesters/1/b2-report');
      expect(res.status).toBe(200);
    }
  });

  it('does not rate-limit /api/english-learning-passport/* when public routes are limited', async () => {
    const app = buildTestApp({ rateLimit: true, rateLimitMax: 1 });
    await request(app).post('/api/echo').send({ a: 1 });
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get('/api/english-learning-passport/me');
      expect(res.status).toBe(200);
    }
  });

  it('skips global rate limit when GLOBAL_RATE_LIMIT_ENABLED=false', async () => {
    process.env.GLOBAL_RATE_LIMIT_ENABLED = 'false';
    const app = buildTestApp({ rateLimit: true, rateLimitMax: 1, rateLimitEnabled: false });
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/echo').send({ n: i });
      expect(res.status).toBe(200);
    }
  });

  it('does not expose stack in production error responses', async () => {
    const app = buildTestApp();
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const res = await request(app).get('/api/error');
    process.env.NODE_ENV = prev;
    expect(res.status).toBe(500);
    expect(res.body.stack).toBeUndefined();
    expect(res.body.originalError).toBeUndefined();
  });

  it('uses REQUEST_BODY_LIMIT from env via getRequestBodyLimit', () => {
    process.env.REQUEST_BODY_LIMIT = '2mb';
    expect(getRequestBodyLimit()).toBe('2mb');
    delete process.env.REQUEST_BODY_LIMIT;
    expect(getRequestBodyLimit()).toBe('1mb');
  });
});
