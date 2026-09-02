// tests/settings.test.js
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
    if (authHeader === 'Bearer deputy-token') {
      req.user = { id: 3, role: 'office_staff', staffLevel: 'deputy_manager' };
      return next();
    }
    return res.status(401).json({ error: '缺少或無效的認證令牌' });
  },
  requireSystemPermission: (permission, message) => (req, res, next) => {
    if (permission === 'can_manage_settings' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: message || '僅限系統管理員' });
    }
    return next();
  },
  requirePermission: (permission, message) => (req, res, next) => {
    if (permission === 'can_manage_settings') {
      if (req.user?.role === 'admin') return next();
      if (req.user?.role === 'office_staff') return next();
      return res.status(403).json({ error: message || '權限不足' });
    }
    return next();
  },
  requireAnyPermission: (permissions, message) => (req, res, next) => {
    const role = req.user?.role;
    if (role === 'admin') return next();
    if (role === 'office_staff') return next();
    return res.status(403).json({ error: message || '權限不足' });
  },
  P: {
    CAN_MANAGE_SETTINGS: 'can_manage_settings',
    CAN_MANAGE_ENGLISH_TESTS: 'can_manage_english_tests',
  }
}));

jest.mock('../models', () => ({
  Settings: {
    findOne: jest.fn(),
    findOrCreate: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
}));

const { Settings: mockSetting } = require('../models');

// 模擬測試用的 Express 應用
const app = express();
app.use(express.json());

// 引入路由
const settingsRouter = require('../routes/settingsRouter');
app.use('/api/settings', settingsRouter);

describe('Settings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PUT /api/settings/english-test-registration-enabled', () => {
    const adminToken = 'admin-token';
    const execToken = 'exec-token';

    it('管理員應該能夠更新設定', async () => {
      mockSetting.findOne.mockResolvedValue({ value: 'true', valueBool: true });
      const mockSettingInstance = { update: jest.fn() };
      mockSetting.findOrCreate.mockResolvedValue([mockSettingInstance, false]);

      const response = await request(app)
        .put('/api/settings/english-test-registration-enabled')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: false });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: '設定已更新',
        enabled: false
      });
    });

    it('executive teacher 應該被拒絕（403）', async () => {
      const response = await request(app)
        .put('/api/settings/english-test-registration-enabled')
        .set('Authorization', `Bearer ${execToken}`)
        .send({ enabled: true });

      expect(response.status).toBe(403);
      expect(response.body.error).toBeTruthy();
    });

    it('deputy_manager 應可更新英檢報名開關', async () => {
      mockSetting.findOne.mockResolvedValue({ value: 'true', valueBool: true });
      const mockSettingInstance = { update: jest.fn() };
      mockSetting.findOrCreate.mockResolvedValue([mockSettingInstance, false]);

      const response = await request(app)
        .put('/api/settings/english-test-registration-enabled')
        .set('Authorization', 'Bearer deputy-token')
        .send({ enabled: false });

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(false);
    });
  });
});


