const express = require('express');
const request = require('supertest');

describe('batch transaction consistency', () => {
  // jest.doMock + dynamic require 在慢機或完整 suite 並行資源下可能超過預設 5s
  jest.setTimeout(20000);

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('batch check-in rollback on injected error', async () => {
    const tx = { commit: jest.fn(), rollback: jest.fn() };
    const reservation1 = {
      id: 1,
      checkinStatus: '未簽到',
      checkinTime: null,
      update: jest.fn().mockResolvedValue(undefined),
    };
    const reservation2 = {
      id: 2,
      checkinStatus: '未簽到',
      checkinTime: null,
      update: jest.fn().mockRejectedValue(new Error('injected bulk checkin failure')),
    };

    jest.doMock('../../middlewares/auth', () => ({
      authMiddleware: (req, _res, next) => {
        req.user = { id: 1, role: 'admin', user: 'admin' };
        next();
      },
      adminOrExecutiveMiddleware: (_req, _res, next) => next(),
      requirePermission: () => (_req, _res, next) => next(),
      requireAnyPermission: () => (_req, _res, next) => next(),
      requirePermissionAndEventAccess: () => (_req, _res, next) => next(),
      hasPermission: () => true,
      canAccessEventType: () => true,
      P: {
        CAN_CHECKIN_STUDENTS: 'can_checkin_students',
        CAN_MANAGE_EVENTS: 'can_manage_events',
        CAN_MANAGE_VIOLATIONS: 'can_manage_violations',
        CAN_VIEW_BLACKLIST: 'can_view_blacklist',
        CAN_VIEW_RESERVATIONS: 'can_view_reservations',
        CAN_MANAGE_BLACKLIST: 'can_manage_blacklist',
      },
    }));
    jest.doMock('../../middlewares/requirePasswordConfirmation', () => ({
      requirePasswordConfirmation: (_req, _res, next) => next(),
    }));
    jest.doMock('../../utils/errorMessages', () => ({
      createAPIError: jest.fn(),
      logError: jest.fn(),
    }));
    jest.doMock('../../services/auditLogService', () => ({
      logAuditAsync: jest.fn(),
      diffShallow: jest.fn().mockReturnValue([]),
    }));
    jest.doMock('../../services/notificationService', () => ({
      createNotification: jest.fn().mockResolvedValue(undefined),
      createFromEmailTemplate: jest.fn().mockResolvedValue(undefined),
    }));
    jest.doMock('../../services/eventParticipationReportService', () => ({}));
    jest.doMock('../../services/eventAutoCheckService', () => ({
      runEventAutoCheck: jest.fn().mockResolvedValue({ results: {} }),
    }));
    jest.doMock('../../utils/eventStats', () => ({
      getMultipleEventsCheckinStats: jest.fn().mockResolvedValue(new Map()),
      getEventCheckinStats: jest.fn().mockResolvedValue({
        totalReservations: 2,
        checkedIn: 0,
        notCheckedIn: 2,
        violations: 0,
      }),
    }));
    jest.doMock('../../utils/eventSemesterFromDate', () => ({
      getSemesterInfo: jest.fn().mockReturnValue({}),
    }));
    jest.doMock('../../models', () => ({
      Event: {
        findByPk: jest.fn().mockResolvedValue({
          id: 10,
          eventType: 'English Table',
          date: new Date().toISOString().slice(0, 10),
          name: 'ET',
          autoCheckCompleted: false,
        }),
        sequelize: { transaction: jest.fn().mockResolvedValue(tx) },
      },
      Reservation: {
        findAll: jest.fn().mockResolvedValue([reservation1, reservation2]),
      },
      User: {},
      EventViolation: {},
      sequelize: { transaction: jest.fn().mockResolvedValue(tx) },
    }));

    const router = require('../../routes/eventRouter');
    const app = express();
    app.use(express.json());
    app.use('/api', router);
    app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

    const res = await request(app).post('/api/events/10/checkin/bulk').send({ reservationIds: [1, 2] });
    expect(res.status).toBe(500);
    expect(tx.rollback).toHaveBeenCalled();
    expect(tx.commit).not.toHaveBeenCalled();
  });

  it('batch no-show rollback on injected error', async () => {
    const tx = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    const user = { id: 3, violationCount: 0, save: jest.fn().mockResolvedValue(undefined) };
    const reservation = { checkinStatus: '未簽到', User: user, save: jest.fn().mockResolvedValue(undefined) };

    jest.doMock('../../models', () => ({
      Event: {
        findByPk: jest.fn().mockResolvedValue({
          id: 88,
          autoCheckCompleted: false,
          Reservations: [reservation],
          save: jest.fn().mockResolvedValue(undefined),
        }),
      },
      Reservation: {},
      User: {},
      EventViolation: {
        findAll: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockRejectedValue(new Error('injected no-show failure')),
      },
      BlackListRecord: { create: jest.fn() },
      sequelize: { transaction: jest.fn().mockResolvedValue(tx) },
    }));
    jest.doMock('../../services/auditLogService', () => ({
      logAuditAsync: jest.fn(),
    }));

    jest.dontMock('../../services/eventAutoCheckService');
    const { runEventAutoCheck } = require('../../services/eventAutoCheckService');
    await expect(runEventAutoCheck({ eventId: 88, recordedBy: 'tester' })).rejects.toThrow(
      'injected no-show failure'
    );
    expect(tx.rollback).toHaveBeenCalled();
    expect(tx.commit).not.toHaveBeenCalled();
  });

  it('blacklist threshold transaction consistency and email enqueue failure does not rollback committed DB state', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tx = { commit: jest.fn(), rollback: jest.fn() };
    const save = jest.fn().mockResolvedValue(undefined);
    const user = {
      id: 7,
      name: 'Tester',
      studentId: 'B123456789',
      email: 't@example.com',
      violationCount: 1,
      isBlacklisted: false,
      blacklistUntil: null,
      save,
    };
    const destroy = jest.fn().mockResolvedValue(undefined);

    jest.doMock('../../middlewares/auth', () => ({
      authMiddleware: (req, _res, next) => {
        req.user = { id: 1, role: 'admin', user: 'admin' };
        req.requestId = 'rid-1';
        next();
      },
      requirePermission: () => (_req, _res, next) => next(),
      hasPermission: () => true,
      P: {
        CAN_MANAGE_BLACKLIST: 'can_manage_blacklist',
        CAN_MANAGE_VIOLATIONS: 'can_manage_violations',
        CAN_RECORD_VIOLATIONS: 'can_record_violations',
        CAN_VIEW_BLACKLIST: 'can_view_blacklist',
      },
      workerMiddleware: (_req, _res, next) => next(),
      adminMiddleware: (_req, _res, next) => next(),
    }));
    jest.doMock('../../services/auditLogService', () => ({
      logAuditAsync: jest.fn(),
    }));
    jest.doMock('../../utils/emailQueue', () => ({
      enqueue: jest.fn().mockRejectedValue(new Error('email queue down')),
    }));
    jest.doMock('../../services/accessControl/eventScopeGuard', () => ({
      assertCanAccessEvent: jest.fn(),
    }));
    jest.doMock('../../models', () => ({
      User: { findOne: jest.fn().mockResolvedValue(user) },
      BlackListRecord: { create: jest.fn().mockResolvedValue({ id: 1 }) },
      Reservation: {
        findAll: jest.fn().mockResolvedValue([
          {
            Event: { date: tomorrow, startTime: '10:00:00', name: 'ET', eventType: 'English Table', endTime: '11:00:00' },
            destroy,
          },
        ]),
      },
      Event: { findByPk: jest.fn().mockResolvedValue({ id: 88, eventType: 'English Table', name: 'ET', date: tomorrow }) },
      EventViolation: { findOne: jest.fn().mockResolvedValue(null) },
      sequelize: { transaction: jest.fn().mockResolvedValue(tx) },
    }));

    const router = require('../../routes/blacklistRouter');
    const app = express();
    app.use(express.json());
    app.use('/api/blacklist', router);

    const res = await request(app)
      .post('/api/blacklist/recordViolation')
      .send({ eventId: 88, studentId: 'B123456789', reason: '測試' });

    expect(res.status).toBe(200);
    expect(tx.commit).toHaveBeenCalled();
    expect(tx.rollback).not.toHaveBeenCalled();
    expect(user.isBlacklisted).toBe(true);
    expect(destroy).toHaveBeenCalled();
  });
});

