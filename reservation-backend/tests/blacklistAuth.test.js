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
const mockReservationFindAll = jest.fn();
const mockUserFindOne = jest.fn();
const mockBuildEventScopeWhere = jest.fn(() => ({}));
const mockBlackListRecordCreate = jest.fn();
const mockBlackListRecordFindOne = jest.fn();
const mockBlackListRecordCount = jest.fn();

jest.mock('../models', () => ({
  User: { findOne: (...args) => mockUserFindOne(...args) },
  BlackListRecord: {
    create: (...args) => mockBlackListRecordCreate(...args),
    findOne: (...args) => mockBlackListRecordFindOne(...args),
    count: (...args) => mockBlackListRecordCount(...args),
  },
  Reservation: {
    findByPk: (...args) => mockReservationFindByPk(...args),
    findAll: (...args) => mockReservationFindAll(...args),
  },
  Event: { findByPk: (...args) => mockEventFindByPk(...args) },
  EventViolation: {
    findOne: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
  },
  sequelize: { transaction: jest.fn().mockResolvedValue(mockTx) },
}));

jest.mock('../services/accessControl/eventScopeGuard', () => ({
  assertCanAccessEvent: jest.fn(),
  buildEventScopeWhere: (...args) => mockBuildEventScopeWhere(...args),
}));

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: jest.fn(),
}));

jest.mock('../utils/emailQueue', () => ({
  enqueue: jest.fn().mockResolvedValue('job'),
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
    recordedAt: new Date(),
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
    mockBlackListRecordCount.mockResolvedValue(1);
    mockUserFindOne.mockResolvedValue(makeUser());
    mockBlackListRecordFindOne.mockResolvedValue(makeBlacklistRecord(makeUser()));
    mockReservationFindAll.mockResolvedValue([]);
    mockBuildEventScopeWhere.mockReset();
    mockBuildEventScopeWhere.mockReturnValue({});
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

  describe('GET /api/blacklist/semester-reservations', () => {
    const { getCurrentSemester, SEMESTER_RANGES } = require('../utils/semesterConstants');

    function dateInCurrentSemester() {
      const semester = getCurrentSemester();
      const range = SEMESTER_RANGES[semester];
      return range ? range.start : '2026-11-01';
    }

    function reservationRow(id, date, checkinStatus) {
      return {
        id,
        checkinStatus,
        eventId: id + 100,
        studentId: 'S001',
        Event: {
          id: id + 100,
          name: `活動 ${id}`,
          date,
          startTime: '10:00:00',
          endTime: '11:00:00',
          eventType: 'english_table',
        },
      };
    }

    it('未登入 → 401', async () => {
      const app = createApp();
      const res = await request(app).get('/api/blacklist/semester-reservations');
      expect(res.status).toBe(401);
    });

    it('只有 CAN_CHECKIN_STUDENTS → 403', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/blacklist/semester-reservations')
        .query({ studentId: 'S001', name: 'Test User' })
        .set('Authorization', `Bearer ${TOKENS.CHECKIN_ONLY}`);
      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('PERMISSION_DENIED');
    });

    it('只有 CAN_RECORD_VIOLATIONS → 403', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/blacklist/semester-reservations')
        .query({ studentId: 'S001', name: 'Test User' })
        .set('Authorization', `Bearer ${TOKENS.RECORD}`);
      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('PERMISSION_DENIED');
    });

    it('缺少學號或姓名 → 400', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/blacklist/semester-reservations')
        .query({ studentId: 'S001' })
        .set('Authorization', `Bearer ${TOKENS.MANAGE}`);
      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('MISSING_IDENTIFIER');
    });

    it('找不到學生 → 404', async () => {
      mockUserFindOne.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app)
        .get('/api/blacklist/semester-reservations')
        .query({ studentId: 'S001', name: 'Test User' })
        .set('Authorization', `Bearer ${TOKENS.MANAGE}`);
      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('USER_NOT_FOUND');
    });

    it('姓名與學號不符 → 409', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/blacklist/semester-reservations')
        .query({ studentId: 'S001', name: '別人' })
        .set('Authorization', `Bearer ${TOKENS.MANAGE}`);
      expect(res.status).toBe(409);
      expect(res.body.errorCode).toBe('NAME_MISMATCH');
    });

    it('沒有活動範圍 → 403', async () => {
      mockBuildEventScopeWhere.mockReturnValue(null);
      const app = createApp();
      const res = await request(app)
        .get('/api/blacklist/semester-reservations')
        .query({ studentId: 'S001', name: 'Test User' })
        .set('Authorization', `Bearer ${TOKENS.MANAGE}`);
      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('MISSING_EVENT_CONTEXT');
    });

    it('CAN_MANAGE_VIOLATIONS 只回當學期預約，已登記者不可再選', async () => {
      const inRange = dateInCurrentSemester();
      mockReservationFindAll.mockResolvedValue([
        reservationRow(1, inRange, '未簽到'),
        reservationRow(2, inRange, '已登記違規'),
        reservationRow(3, '2000-03-01', '未簽到'),
      ]);
      const app = createApp();
      const res = await request(app)
        .get('/api/blacklist/semester-reservations')
        .query({ studentId: 'S001', name: 'Test User' })
        .set('Authorization', `Bearer ${TOKENS.MANAGE}`);
      expect(res.status).toBe(200);
      expect(res.body.semester).toBe(getCurrentSemester());
      expect(res.body.reservations.map((row) => row.reservationId)).toEqual([1, 2]);
      expect(res.body.reservations[0].selectable).toBe(true);
      expect(res.body.reservations[1].selectable).toBe(false);
      expect(res.body.reservations[0].eventId).toBe(101);
    });

    it('依活動範圍過濾查詢', async () => {
      mockBuildEventScopeWhere.mockReturnValue({ eventType: ['english_table'] });
      const app = createApp();
      await request(app)
        .get('/api/blacklist/semester-reservations')
        .query({ studentId: 'S001', name: 'Test User' })
        .set('Authorization', `Bearer ${TOKENS.MANAGE}`);
      const query = mockReservationFindAll.mock.calls[0][0];
      expect(query.include[0].where).toEqual({ eventType: ['english_table'] });
    });
  });
});

