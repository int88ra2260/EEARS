const request = require('supertest');
const express = require('express');

const P = {
  CAN_MANAGE_EVENTS: 'can_manage_events',
  CAN_MANAGE_RESERVATIONS: 'can_manage_reservations',
};

const hasPermission = (user, permission) =>
  Boolean(user && Array.isArray(user.permissions) && user.permissions.includes(permission));

const canAccessEventType = (user, eventType) => {
  if (!user) return false;
  if (Array.isArray(user.allowedEventTypes) && user.allowedEventTypes.includes('all')) return true;
  return Array.isArray(user.allowedEventTypes) && user.allowedEventTypes.includes(eventType);
};

jest.mock('../middlewares/auth', () => ({
  authMiddleware: (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader) {
      return res.status(401).json({ error: '缺少或無效的認證令牌' });
    }
    if (authHeader === 'Bearer manage-events-et') {
      req.user = {
        role: 'teacher',
        permissions: [P.CAN_MANAGE_EVENTS, P.CAN_MANAGE_RESERVATIONS],
        allowedEventTypes: ['English Table'],
      };
    } else if (authHeader === 'Bearer no-permission') {
      req.user = {
        role: 'teacher',
        permissions: [],
        allowedEventTypes: ['English Table'],
      };
    } else if (authHeader === 'Bearer no-scope') {
      req.user = {
        role: 'teacher',
        permissions: [P.CAN_MANAGE_RESERVATIONS],
        allowedEventTypes: ['Job Talk'],
      };
    }
    next();
  },
  optionalAuthMiddleware: (req, _res, next) => {
    const authHeader = req.headers.authorization || '';
    if (authHeader === 'Bearer manage-events-et') {
      req.user = {
        role: 'teacher',
        permissions: [P.CAN_MANAGE_EVENTS],
        allowedEventTypes: ['English Table'],
      };
    } else if (authHeader === 'Bearer no-permission') {
      req.user = {
        role: 'teacher',
        permissions: [],
        allowedEventTypes: ['English Table'],
      };
    } else if (authHeader === 'Bearer no-scope') {
      req.user = {
        role: 'teacher',
        permissions: [P.CAN_MANAGE_EVENTS],
        allowedEventTypes: ['Job Talk'],
      };
    }
    next();
  },
  requirePermission: (permission) => (req, res, next) => {
    if (!req.user || !hasPermission(req.user, permission)) {
      return res.status(403).json({ error: '權限不足' });
    }
    return next();
  },
  requirePermissionAndEventAccess: () => (_req, _res, next) => next(),
  hasPermission,
  canAccessEventType,
  P,
}));

const mockReservationFindByPk = jest.fn();
const mockUserFindByPk = jest.fn();

jest.mock('../models', () => ({
  Event: {},
  Reservation: {
    findByPk: (...args) => mockReservationFindByPk(...args),
  },
  User: {
    findByPk: (...args) => mockUserFindByPk(...args),
  },
  sequelize: {
    transaction: jest.fn(async () => ({
      commit: jest.fn(),
      rollback: jest.fn(),
    })),
  },
}));

jest.mock('../middlewares/checkSurvey', () => ({
  checkSurvey: (_req, _res, next) => next(),
}));

jest.mock('../services/accessControl/eventScopeGuard', () => ({
  assertCanAccessEvent: jest.fn(),
  buildEventScopeWhere: jest.fn(() => ({})),
}));

const mockCancelReservationByAdmin = jest.fn();
jest.mock('../services/reservationService', () => ({
  cancelReservationPublic: jest.requireActual('../services/reservationService').cancelReservationPublic,
  cancelReservationByAdmin: (...args) => mockCancelReservationByAdmin(...args),
}));

jest.mock('../services/waitlistService', () => ({
  promoteNextWaitlistedStudent: jest.fn(() => Promise.resolve()),
}));

jest.mock('../utils/reservationTime', () => ({
  calculateReservationTime: jest.fn(() => new Date()),
}));

jest.mock('../utils/validators', () => ({
  validateStudentId: jest.fn(() => true),
  validateName: jest.fn(() => true),
}));

jest.mock('../config/email', () => ({
  sendEmail: jest.fn(),
  transporter: {},
}));

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: jest.fn(),
}));

jest.mock('../services/notificationService', () => ({
  createFromEmailTemplate: jest.fn(() => Promise.resolve()),
}));

jest.mock('../utils/emailQueue', () => ({
  enqueue: jest.fn(() => Promise.resolve()),
}));

const reservationRouter = require('../routes/reservationRouter');

function makeReservation({
  eventType = 'English Table',
  date = '2026-04-10',
  startTime = '15:00:00',
  cancellationCode = '123456',
} = {}) {
  return {
    id: 99,
    userId: 1,
    studentId: 'A12345678',
    studentName: 'Test Student',
    studentEmail: 'test@example.com',
    checkinStatus: '未簽到',
    cancellationCode,
    Event: {
      id: 88,
      name: 'Mock Event',
      eventType,
      date,
      startTime,
      endTime: '17:00:00',
    },
    destroy: jest.fn(async () => {}),
  };
}

describe('DELETE /api/reservations/:id auth regression', () => {
  let app;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-10T10:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCancelReservationByAdmin.mockReset();
    app = express();
    app.use(express.json());
    app.use('/api', reservationRouter);
  });

  it('deprecated 路由：DELETE /api/reservations/:id 回 410', async () => {
    const res = await request(app).delete('/api/reservations/99').send({});
    expect(res.status).toBe(410);
    expect(String(res.body.message || '')).toContain('deprecated');
  });

  it('前台：正確驗證碼可取消成功（新路由）', async () => {
    const reservation = makeReservation({
      date: '2026-04-10',
      startTime: '15:00:00',
      cancellationCode: '111222',
    });
    mockReservationFindByPk.mockResolvedValueOnce(reservation);

    const res = await request(app)
      .post('/api/reservations/99/cancel-public')
      .send({
        studentId: reservation.studentId,
        studentName: reservation.studentName,
        email: reservation.studentEmail,
        cancellationCode: '111222',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.found).toBe(true);
    expect(reservation.destroy).toHaveBeenCalledTimes(1);
  });

  it('前台：錯誤驗證碼不會取消（新路由 fail-close）', async () => {
    const reservation = makeReservation({
      date: '2026-04-10',
      startTime: '15:00:00',
      cancellationCode: '111222',
    });
    mockReservationFindByPk.mockResolvedValueOnce(reservation);

    const res = await request(app)
      .post('/api/reservations/99/cancel-public')
      .send({
        studentId: reservation.studentId,
        studentName: reservation.studentName,
        email: reservation.studentEmail,
        cancellationCode: '999999',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.found).toBe(false);
    expect(reservation.destroy).not.toHaveBeenCalled();
  });

  it('前台：身分欄位不符不會成功取消（新路由）', async () => {
    const reservation = makeReservation({
      date: '2026-04-10',
      startTime: '11:00:00',
      cancellationCode: '111222',
    });
    mockReservationFindByPk.mockResolvedValueOnce(reservation);

    const res = await request(app)
      .post('/api/reservations/99/cancel-public')
      .send({
        studentId: reservation.studentId,
        studentName: reservation.studentName,
        email: 'wrong@example.com',
        cancellationCode: '111222',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.found).toBe(false);
    expect(reservation.destroy).not.toHaveBeenCalled();
  });

  it('後台：管理端新路由可刪除成功', async () => {
    const reservation = makeReservation({
      eventType: 'English Table',
      cancellationCode: '111222',
    });
    mockReservationFindByPk.mockResolvedValueOnce(reservation);
    mockCancelReservationByAdmin.mockImplementationOnce(async () => {
      await reservation.destroy();
      return {
        cancelled: true,
        reservation,
        reason: null,
      };
    });

    const res = await request(app)
      .delete('/api/admin/reservations/99')
      .set('Authorization', 'Bearer manage-events-et')
      .send({ cancellationCode: '111222' });

    expect(res.status).toBe(200);
    expect(String(res.body.message || '')).toContain('cancelled');
    expect(reservation.destroy).toHaveBeenCalledTimes(1);
  });

  it('後台：有 token 但無權限時回 403', async () => {
    const reservation1 = makeReservation({ eventType: 'English Table' });
    mockReservationFindByPk.mockResolvedValueOnce(reservation1);
    const r1 = await request(app)
      .delete('/api/admin/reservations/99')
      .set('Authorization', 'Bearer no-permission')
      .send({ cancellationCode: '123456' });

    expect(r1.status).toBe(403);
    expect(String(r1.body.message || r1.body.error || '')).toContain('權限');
    expect(reservation1.destroy).not.toHaveBeenCalled();
  });

  it('後台：admin 取消路由未帶 token 回 401', async () => {
    const res = await request(app).delete('/api/admin/reservations/99').send({ cancellationCode: '111222' });
    expect(res.status).toBe(401);
  });
});

