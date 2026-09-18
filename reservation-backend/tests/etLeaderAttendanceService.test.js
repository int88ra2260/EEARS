'use strict';

jest.mock('../models', () => ({
  Event: { findByPk: jest.fn() },
  Teacher: { findByPk: jest.fn() },
  EtEventGroupLeader: { findOne: jest.fn(), findAll: jest.fn() },
  EtLeaderAttendance: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    findOrCreate: jest.fn(),
    findByPk: jest.fn(),
  },
  EtLeaderCheckinToken: { findOne: jest.fn(), findOrCreate: jest.fn() },
  sequelize: { transaction: jest.fn(async () => ({ commit: jest.fn(), rollback: jest.fn() })) },
}));

const {
  Event,
  Teacher,
  EtEventGroupLeader,
  EtLeaderAttendance,
  EtLeaderCheckinToken,
} = require('../models');
const {
  hashToken,
  resolveCheckInStatus,
  getEventWindow,
  checkInWithQr,
  rotateCheckinQr,
  manualUpsertAttendance,
  STATUS,
} = require('../services/etGrouping/etLeaderAttendanceService');

function makeEvent(overrides = {}) {
  return {
    id: 359,
    name: 'ET Test',
    date: '2026-09-18',
    startTime: '14:00',
    endTime: '16:00',
    eventType: 'English Table',
    semesterId: 1,
    ...overrides,
  };
}

describe('etLeaderAttendanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getEventWindow uses Asia/Taipei wall clock', () => {
    const window = getEventWindow(makeEvent());
    expect(window.openAt.toISOString()).toBe(new Date('2026-09-18T13:30:00+08:00').toISOString());
    expect(window.onTimeUntil.toISOString()).toBe(new Date('2026-09-18T14:10:00+08:00').toISOString());
    expect(window.endAt.toISOString()).toBe(new Date('2026-09-18T16:00:00+08:00').toISOString());
  });

  test('resolveCheckInStatus returns on_time / late / rejects outside window', () => {
    const event = makeEvent();
    expect(resolveCheckInStatus(event, new Date('2026-09-18T14:05:00+08:00'))).toBe(STATUS.ON_TIME);
    expect(resolveCheckInStatus(event, new Date('2026-09-18T14:30:00+08:00'))).toBe(STATUS.LATE);

    expect(() => resolveCheckInStatus(event, new Date('2026-09-18T13:00:00+08:00'))).toThrow(/尚未開放/);
    expect(() => resolveCheckInStatus(event, new Date('2026-09-18T16:01:00+08:00'))).toThrow(/已結束/);
  });

  test('checkInWithQr succeeds for assigned leader with valid token', async () => {
    Event.findByPk.mockResolvedValue(makeEvent());
    EtEventGroupLeader.findOne.mockResolvedValue({ id: 1, groupLabel: 'Group 1' });
    EtLeaderCheckinToken.findOne.mockResolvedValue({
      tokenHash: hashToken('plain-token'),
      expiresAt: new Date('2026-09-18T16:00:00+08:00'),
    });
    EtLeaderAttendance.findOne.mockResolvedValue(null);
    EtLeaderAttendance.create.mockResolvedValue({
      eventId: 359,
      leaderTeacherId: 7,
      checkInAt: new Date('2026-09-18T14:00:00+08:00'),
      status: STATUS.ON_TIME,
      method: 'qr',
      markedBy: null,
      note: null,
    });

    const result = await checkInWithQr(359, {
      teacherId: 7,
      token: 'plain-token',
      now: new Date('2026-09-18T14:00:00+08:00'),
    });

    expect(result.status).toBe(STATUS.ON_TIME);
    expect(EtLeaderAttendance.create).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 359,
      leaderTeacherId: 7,
      method: 'qr',
      status: STATUS.ON_TIME,
    }));
  });

  test('checkInWithQr rejects invalid token and unassigned leader', async () => {
    Event.findByPk.mockResolvedValue(makeEvent());
    EtEventGroupLeader.findOne.mockResolvedValue(null);
    await expect(checkInWithQr(359, {
      teacherId: 7,
      token: 'x',
      now: new Date('2026-09-18T14:00:00+08:00'),
    })).rejects.toMatchObject({ status: 403, code: 'NOT_ASSIGNED_LEADER' });

    EtEventGroupLeader.findOne.mockResolvedValue({ id: 1 });
    EtLeaderCheckinToken.findOne.mockResolvedValue({
      tokenHash: hashToken('other'),
      expiresAt: new Date('2026-09-18T16:00:00+08:00'),
    });
    await expect(checkInWithQr(359, {
      teacherId: 7,
      token: 'wrong',
      now: new Date('2026-09-18T14:00:00+08:00'),
    })).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
  });

  test('checkInWithQr rejects duplicate check-in', async () => {
    Event.findByPk.mockResolvedValue(makeEvent());
    EtEventGroupLeader.findOne.mockResolvedValue({ id: 1 });
    EtLeaderCheckinToken.findOne.mockResolvedValue({
      tokenHash: hashToken('plain-token'),
      expiresAt: new Date('2026-09-18T16:00:00+08:00'),
    });
    EtLeaderAttendance.findOne.mockResolvedValue({
      eventId: 359,
      leaderTeacherId: 7,
      status: STATUS.ON_TIME,
      checkInAt: new Date(),
      method: 'qr',
    });

    await expect(checkInWithQr(359, {
      teacherId: 7,
      token: 'plain-token',
      now: new Date('2026-09-18T14:00:00+08:00'),
    })).rejects.toMatchObject({ status: 409, code: 'ALREADY_CHECKED_IN' });
  });

  test('rotateCheckinQr stores hashed token and returns plaintext once', async () => {
    Event.findByPk.mockResolvedValue(makeEvent());
    const update = jest.fn();
    EtLeaderCheckinToken.findOrCreate.mockResolvedValue([
      { update },
      true,
    ]);

    const data = await rotateCheckinQr(359, { userId: 1 });
    expect(data.token).toBeTruthy();
    expect(data.token.length).toBeGreaterThan(10);
    expect(EtLeaderCheckinToken.findOrCreate).toHaveBeenCalledWith(expect.objectContaining({
      defaults: expect.objectContaining({
        tokenHash: hashToken(data.token),
        createdBy: 1,
      }),
    }));
  });

  test('manualUpsertAttendance creates manual attendance for assigned leader', async () => {
    Event.findByPk.mockResolvedValue(makeEvent());
    EtEventGroupLeader.findOne.mockResolvedValue({ id: 1 });
    Teacher.findByPk.mockResolvedValue({ id: 7, isActive: true, name: 'Amy' });
    EtLeaderAttendance.findOrCreate.mockResolvedValue([
      {
        id: 9,
        update: jest.fn(),
      },
      true,
    ]);
    EtLeaderAttendance.findByPk.mockResolvedValue({
      eventId: 359,
      leaderTeacherId: 7,
      checkInAt: new Date('2026-09-18T14:20:00+08:00'),
      status: STATUS.MANUAL,
      method: 'manual',
      markedBy: 1,
      note: '紙本補登',
      leader: { name: 'Amy' },
    });

    const result = await manualUpsertAttendance(359, 7, {
      status: STATUS.MANUAL,
      note: '紙本補登',
      userId: 1,
      checkInAt: '2026-09-18T14:20:00+08:00',
    });

    expect(result.attendance.status).toBe(STATUS.MANUAL);
    expect(result.attendance.method).toBe('manual');
    expect(result.attendance.leaderName).toBe('Amy');
  });
});
