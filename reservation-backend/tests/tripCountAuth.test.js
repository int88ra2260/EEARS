const express = require('express');
const request = require('supertest');

jest.mock('../middlewares/auth', () => {
  function authMiddleware(req, res, next) {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token === 'admin-token') {
      req.user = { id: 7, role: 'admin' };
      return next();
    }
    if (token === 'staff-token') {
      req.user = { id: 8, role: 'teacher', permissions: [] };
      return next();
    }
    return res.status(401).json({ error: '缺少或無效的認證令牌' });
  }

  function requirePermission() {
    return (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: '缺少或無效的認證令牌' });
      if (req.user.role !== 'admin') return res.status(403).json({ error: '沒有使用旅遊分帳的權限' });
      return next();
    };
  }

  return {
    authMiddleware,
    requirePermission,
    P: { CAN_USE_TRIP_COUNT: 'can_use_trip_count' },
  };
});

jest.mock('../services/tripCountService', () => ({
  listTrips: jest.fn(async () => []),
}));

const tripCountRouter = require('../routes/tripCountRouter');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/trip-counts', tripCountRouter);
  return app;
}

describe('trip count auth', () => {
  test('未登入回 401', async () => {
    const res = await request(createApp()).get('/api/admin/trip-counts');
    expect(res.status).toBe(401);
  });

  test('沒有權限回 403', async () => {
    const res = await request(createApp())
      .get('/api/admin/trip-counts')
      .set('Authorization', 'Bearer staff-token');
    expect(res.status).toBe(403);
  });

  test('管理員可以讀取自己的旅程清單', async () => {
    const res = await request(createApp())
      .get('/api/admin/trip-counts')
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });
});
