const express = require('express');
const request = require('supertest');

const TOKENS = {
  ADMIN: 'admin-token',
  EXECUTIVE: 'exec-token',
  CHECKIN_ONLY: 'checkin-token',
  RECORD: 'record-token',
  MANAGE: 'manage-token',
};

jest.mock('../middlewares/auth', () => {
  const P = {
    CAN_MANAGE_BLACKLIST: 'can_manage_blacklist',
    CAN_MANAGE_VIOLATIONS: 'can_manage_violations',
    CAN_RECORD_VIOLATIONS: 'can_record_violations',
    CAN_CHECKIN_STUDENTS: 'can_checkin_students',
  };

  function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return res.status(401).json({ error: '缺少或無效的認證令牌' });
    }

    if (token === TOKENS.ADMIN) {
      req.user = { id: 1, role: 'admin', permissions: [P.CAN_MANAGE_BLACKLIST] };
      return next();
    }
    if (token === TOKENS.EXECUTIVE) {
      req.user = { id: 2, role: 'teacher', teacherLevel: 'executive', permissions: [] };
      return next();
    }
    if (token === TOKENS.CHECKIN_ONLY) {
      req.user = { id: 3, role: 'worker', permissions: [P.CAN_CHECKIN_STUDENTS] };
      return next();
    }
    if (token === TOKENS.RECORD) {
      req.user = { id: 4, role: 'teacher', permissions: [P.CAN_RECORD_VIOLATIONS] };
      return next();
    }
    if (token === TOKENS.MANAGE) {
      req.user = { id: 5, role: 'teacher', permissions: [P.CAN_MANAGE_VIOLATIONS] };
      return next();
    }
    return res.status(401).json({ error: '缺少或無效的認證令牌' });
  }

  function hasPermission(user, permission) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return Array.isArray(user.permissions) && user.permissions.includes(permission);
  }

  function requireSystemPermission(permission, message) {
    return (req, res, next) => {
      if (!req.user || req.user.role !== 'admin' || !hasPermission(req.user, permission)) {
        return res.status(403).json({ error: message || '僅限系統管理員' });
      }
      return next();
    };
  }

  function requirePermission(permission, message) {
    return (req, res, next) => {
      if (!req.user || !hasPermission(req.user, permission)) {
        return res.status(403).json({ error: message || '權限不足' });
      }
      return next();
    };
  }

  return {
    authMiddleware,
    requirePermission,
    requireSystemPermission,
    hasPermission,
    P,
  };
});

const mockTx = { commit: jest.fn(), rollback: jest.fn() };

const mockEventFindByPk = jest.fn();
const mockReservationFindByPk = jest.fn();
const mockUserFindOne = jest.fn();
const mockBlackListRecordCreate = jest.fn();
const mockBlackListRecordFindOne = jest.fn();

jest.mock('../models', () => ({
  User: { findOne: (...args) => mockUserFindOne(...args) },
  BlackListRecord: {
    create: (...args) => mockBlackListRecordCreate(...args),
    findOne: (...args) => mockBlackListRecordFindOne(...args),
  },
  Reservation: { findByPk: (...args) => mockReservationFindByPk(...args), findAll: jest.fn().mockResolvedValue([]) },
  Event: { findByPk: (...args) => mockEventFindByPk(...args) },
  EventViolation: { findOne: jest.fn().mockResolvedValue(null) },
  sequelize: { transaction: jest.fn().mockResolvedValue(mockTx) },
}));

jest.mock('../services/accessControl/eventScopeGuard', () => ({
  assertCanAccessEvent: jest.fn(),
}));

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: jest.fn(),
}));

function makeUser() {
  return {
    id: 10,
    studentId: 'S001',
    name: 'Test User',
    email: 'test@example.com',
    violationCount: 0,
    isBlacklisted: false,
    blacklistUntil: null,
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function makeEvent() {
  return {
    id: 88,
    eventType: 'English Table',
    name: 'ET Event',
    date: '2026-06-01',
  };
}

function makeBlacklistRecord(user) {
  return {
    id: 99,
    User: user,
    destroy: jest.fn().mockResolvedValue(undefined),
  };
}

function createApp() {
  const router = require('../routes/blacklistRouter');
  const app = express();
  app.use(express.json());
  app.use('/api/blacklist', router);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err.message || 'server_error' });
  });
  return app;
}

describe('blacklistRouter auth policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.commit.mockClear();
    mockTx.rollback.mockClear();
    mockEventFindByPk.mockResolvedValue(makeEvent());
    mockReservationFindByPk.mockResolvedValue(null);
    mockBlackListRecordCreate.mockResolvedValue({ id: 1 });
    mockUserFindOne.mockResolvedValue(makeUser());
    mockBlackListRecordFindOne.mockResolvedValue(makeBlacklistRecord(makeUser()));
  });

  describe('DELETE /api/blacklist/:recordId', () => {
    it('未登入 → 401', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/blacklist/99');
      expect(res.status).toBe(401);
    });

    it('admin → 200', async () => {
      const user = makeUser();
      mockBlackListRecordFindOne.mockResolvedValue(makeBlacklistRecord(user));
      const app = createApp();
      const res = await request(app)
        .delete('/api/blacklist/99')
        .set('Authorization', `Bearer ${TOKENS.ADMIN}`);
      expect(res.status).toBe(200);
    });

    it('executive → 403', async () => {
      const app = createApp();
      const res = await request(app)
        .delete('/api/blacklist/99')
        .set('Authorization', `Bearer ${TOKENS.EXECUTIVE}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/blacklist/recordViolation', () => {
    const body = { eventId: 88, studentId: 'S001', reason: 'test' };

    it('只有 CAN_CHECKIN_STUDENTS → 403', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/blacklist/recordViolation')
        .set('Authorization', `Bearer ${TOKENS.CHECKIN_ONLY}`)
        .send(body);
      expect(res.status).toBe(403);
    });

    it('CAN_RECORD_VIOLATIONS → 200', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/blacklist/recordViolation')
        .set('Authorization', `Bearer ${TOKENS.RECORD}`)
        .send(body);
      expect(res.status).toBe(200);
    });

    it('CAN_MANAGE_VIOLATIONS → 200', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/blacklist/recordViolation')
        .set('Authorization', `Bearer ${TOKENS.MANAGE}`)
        .send(body);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/blacklist/batchRecordViolations', () => {
    const body = {
      eventId: 88,
      violations: [{ studentId: 'S001', reason: 'batch test' }],
    };

    it('只有 CAN_CHECKIN_STUDENTS → 403', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/blacklist/batchRecordViolations')
        .set('Authorization', `Bearer ${TOKENS.CHECKIN_ONLY}`)
        .send(body);
      expect(res.status).toBe(403);
    });

    it('CAN_RECORD_VIOLATIONS → 200', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/blacklist/batchRecordViolations')
        .set('Authorization', `Bearer ${TOKENS.RECORD}`)
        .send(body);
      expect(res.status).toBe(200);
    });

    it('CAN_MANAGE_VIOLATIONS → 200', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/blacklist/batchRecordViolations')
        .set('Authorization', `Bearer ${TOKENS.MANAGE}`)
        .send(body);
      expect(res.status).toBe(200);
    });
  });
});

