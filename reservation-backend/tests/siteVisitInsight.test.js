const request = require('supertest');
const express = require('express');

const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockFindAll = jest.fn();

jest.mock('../middlewares/auth', () => ({
  authMiddleware: (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!role) return res.status(401).json({ error: 'unauthenticated' });
    req.user = { id: 1, role };
    next();
  },
}));

jest.mock('../auth/accessProfile', () => ({
  buildAccessProfile: (user) => ({
    isAdmin: user?.role === 'admin',
    hasAdminRights: user?.role === 'admin',
  }),
}));

jest.mock('../models/SiteVisitBucket', () => ({
  findOne: (...args) => mockFindOne(...args),
  create: (...args) => mockCreate(...args),
  findAll: (...args) => mockFindAll(...args),
}));

const statsRouter = require('../routes/statsRouter');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/stats', statsRouter);
  return app;
}

describe('site visit insights', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 1 });
    mockFindAll.mockResolvedValue([]);
  });

  it('counts an announcement visit without storing identity', async () => {
    const res = await request(createApp())
      .post('/api/stats/visit-insights')
      .send({ events: [{ type: 'intent', key: 'announcements' }, { type: 'visit_hour' }] });

    expect(res.status).toBe(204);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      bucketType: 'intent',
      bucketKey: 'announcements',
      visitCount: 1,
    }));
    const hourCall = mockCreate.mock.calls.find((call) => call[0].bucketType === 'visit_hour');
    expect(hourCall[0].bucketKey).toMatch(/^\d{1,2}$/);
  });

  it('rejects a burst of events', async () => {
    const res = await request(createApp())
      .post('/api/stats/visit-insights')
      .send({ events: [1, 2, 3, 4, 5] });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('requires a center admin to read the summary', async () => {
    const denied = await request(createApp()).get('/api/stats/visit-insights');
    expect(denied.status).toBe(401);

    mockFindAll.mockResolvedValue([
      { get: () => ({ bucketType: 'intent', bucketKey: 'reserve', visitCount: 4, statDate: '2026-11-23' }) },
    ]);
    const allowed = await request(createApp())
      .get('/api/stats/visit-insights?days=7')
      .set('x-user-role', 'admin');

    expect(allowed.status).toBe(200);
    expect(allowed.body.intents.reserve).toBe(4);
    expect(allowed.body.intents.announcements).toBe(0);
  });
});
