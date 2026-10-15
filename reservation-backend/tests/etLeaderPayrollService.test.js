'use strict';

jest.mock('../models', () => ({
  Teacher: { findAll: jest.fn(), findByPk: jest.fn() },
  Event: { findAll: jest.fn() },
  EtLeaderAttendance: { findAll: jest.fn() },
  EtLeaderPayProfile: { findAll: jest.fn(), findOrCreate: jest.fn(), findByPk: jest.fn() },
  EtEventGroupLeader: { findAll: jest.fn() },
}));

jest.mock('../services/etGrouping/etLeaderAttendanceService', () => ({
  getEventWindow: jest.fn((event) => {
    if (!event?.date || !event?.startTime || !event?.endTime) return null;
    const startAt = new Date(`${event.date}T${event.startTime}:00+08:00`);
    const endAt = new Date(`${event.date}T${event.endTime}:00+08:00`);
    return { startAt, endAt };
  }),
}));

jest.mock('../services/etGrouping/etLeaderPayGate', () => {
  const actual = jest.requireActual('../services/etGrouping/etLeaderPayGate');
  return {
    ...actual,
    loadPayGateMap: jest.fn(async ({ attendances }) => {
      const map = new Map();
      (attendances || []).forEach((att) => {
        map.set(`${att.eventId}:${att.leaderTeacherId}`, {
          status: 'ready',
          payable: true,
          checkedInCount: 1,
          incompleteCount: 0,
          markingOpen: false,
          daysLeft: 0,
          releaseNote: null,
        });
      });
      return map;
    }),
  };
});

const {
  Teacher,
  Event,
  EtLeaderAttendance,
  EtLeaderPayProfile,
  EtEventGroupLeader,
} = require('../models');
const { loadPayGateMap } = require('../services/etGrouping/etLeaderPayGate');
const {
  parseYearMonth,
  computeEventHours,
  buildMonthlyPayroll,
  upsertPayProfile,
} = require('../services/etGrouping/etLeaderPayrollService');

describe('etLeaderPayrollService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('parseYearMonth returns month bounds', () => {
    expect(parseYearMonth('2026-09')).toEqual({
      yearMonth: '2026-09',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    });
    expect(parseYearMonth('2024-02')).toEqual({
      yearMonth: '2024-02',
      dateFrom: '2024-02-01',
      dateTo: '2024-02-29',
    });
    expect(() => parseYearMonth('2026-13')).toThrow(/有效月份/);
  });

  test('computeEventHours uses event duration', () => {
    expect(
      computeEventHours({ date: '2026-09-18', startTime: '14:00', endTime: '16:00' })
    ).toBe(2);
    expect(
      computeEventHours({ date: '2026-09-18', startTime: '14:00', endTime: '15:30' })
    ).toBe(1.5);
  });

  test('buildMonthlyPayroll aggregates by leader with seniority rate', async () => {
    Event.findAll.mockResolvedValue([
      {
        id: 1,
        name: 'ET A',
        date: '2026-09-10',
        startTime: '14:00',
        endTime: '16:00',
        eventType: 'English Table',
      },
      {
        id: 2,
        name: 'ET B',
        date: '2026-09-17',
        startTime: '14:00',
        endTime: '15:00',
        eventType: 'English Table',
      },
    ]);
    EtLeaderAttendance.findAll.mockResolvedValue([
      {
        eventId: 1,
        leaderTeacherId: 7,
        status: 'on_time',
        method: 'qr',
        checkInAt: new Date('2026-09-10T14:00:00+08:00'),
        note: null,
        leader: { id: 7, name: 'Alice', studentId: 'A123', email: 'a@test.com' },
      },
      {
        eventId: 2,
        leaderTeacherId: 7,
        status: 'late',
        method: 'qr',
        checkInAt: new Date('2026-09-17T14:20:00+08:00'),
        note: null,
        leader: { id: 7, name: 'Alice', studentId: 'A123', email: 'a@test.com' },
      },
      {
        eventId: 1,
        leaderTeacherId: 8,
        status: 'manual',
        method: 'manual',
        checkInAt: new Date('2026-09-10T14:05:00+08:00'),
        note: '忘帶手機',
        leader: { id: 8, name: 'Bob', studentId: 'B456', email: 'b@test.com' },
      },
    ]);
    EtEventGroupLeader.findAll.mockResolvedValue([
      { eventId: 1, leaderTeacherId: 7, groupLabel: 'Group 1' },
      { eventId: 2, leaderTeacherId: 7, groupLabel: 'Group 2' },
      { eventId: 1, leaderTeacherId: 8, groupLabel: 'Group 3' },
    ]);
    EtLeaderPayProfile.findAll.mockResolvedValue([
      { leaderTeacherId: 7, seniorityYears: 2, hourlyRate: 200, note: '資深' },
      { leaderTeacherId: 8, seniorityYears: 0.5, hourlyRate: 180, note: null },
    ]);

    const report = await buildMonthlyPayroll({ yearMonth: '2026-09' });

    expect(report.rows).toHaveLength(2);
    const alice = report.rows.find((r) => r.leaderTeacherId === 7);
    const bob = report.rows.find((r) => r.leaderTeacherId === 8);

    expect(alice.sessionCount).toBe(2);
    expect(alice.hours).toBe(3); // 2 + 1
    expect(alice.hourlyRate).toBe(200);
    expect(alice.subtotal).toBe(600);
    expect(alice.seniorityYears).toBe(2);
    expect(alice.sessions[1].note).toContain('遲到');

    expect(bob.sessionCount).toBe(1);
    expect(bob.hours).toBe(2);
    expect(bob.subtotal).toBe(360);
    expect(bob.sessions[0].note).toContain('行政補登');
    expect(bob.sessions[0].note).toContain('忘帶手機');

    expect(report.totals.leaderCount).toBe(2);
    expect(report.totals.hours).toBe(5);
    expect(report.totals.amount).toBe(960);
  });

  test('buildMonthlyPayroll leaves unmarked sessions out of the payable total', async () => {
    Event.findAll.mockResolvedValue([
      {
        id: 1,
        name: 'ET A',
        date: '2026-09-10',
        startTime: '14:00',
        endTime: '16:00',
        eventType: 'English Table',
      },
    ]);
    EtLeaderAttendance.findAll.mockResolvedValue([
      {
        eventId: 1,
        leaderTeacherId: 7,
        status: 'on_time',
        method: 'qr',
        checkInAt: new Date('2026-09-10T14:00:00+08:00'),
        note: null,
        leader: { id: 7, name: 'Alice', studentId: 'A123', email: 'a@test.com' },
      },
    ]);
    EtEventGroupLeader.findAll.mockResolvedValue([
      { eventId: 1, leaderTeacherId: 7, groupLabel: 'Group 1' },
    ]);
    EtLeaderPayProfile.findAll.mockResolvedValue([
      { leaderTeacherId: 7, seniorityYears: 2, hourlyRate: 200, note: null },
    ]);
    loadPayGateMap.mockResolvedValueOnce(new Map([
      ['1:7', {
        status: 'pending',
        payable: false,
        checkedInCount: 4,
        incompleteCount: 3,
        markingOpen: true,
        daysLeft: 2,
        releaseNote: null,
      }],
    ]));

    const report = await buildMonthlyPayroll({ yearMonth: '2026-09' });
    expect(report.rows).toHaveLength(0);
    expect(report.pending).toHaveLength(1);
    expect(report.pending[0].scheduledHours).toBe(2);
    expect(report.pending[0].hours).toBe(0);
    expect(report.pending[0].subtotal).toBe(0);
    expect(report.pending[0].potentialAmount).toBe(400);
    expect(report.totals.amount).toBe(0);
  });

  test('upsertPayProfile validates and saves', async () => {
    Teacher.findByPk.mockResolvedValue({
      id: 7,
      name: 'Alice',
      studentId: 'A123',
      email: 'a@test.com',
      role: 'leader',
    });
    const row = {
      id: 1,
      update: jest.fn().mockResolvedValue(undefined),
    };
    EtLeaderPayProfile.findOrCreate.mockResolvedValue([row, true]);
    EtLeaderPayProfile.findByPk.mockResolvedValue({
      id: 1,
      leaderTeacherId: 7,
      seniorityYears: 1.5,
      hourlyRate: 190,
      note: '備註',
      leader: { id: 7, name: 'Alice', studentId: 'A123', email: 'a@test.com' },
    });

    const data = await upsertPayProfile(7, {
      seniorityYears: 1.5,
      hourlyRate: 190,
      note: '備註',
    });

    expect(row.update).toHaveBeenCalledWith(
      expect.objectContaining({ seniorityYears: 1.5, hourlyRate: 190, note: '備註' })
    );
    expect(data.hourlyRate).toBe(190);
    expect(data.name).toBe('Alice');

    await expect(upsertPayProfile(7, { seniorityYears: -1, hourlyRate: 100 })).rejects.toThrow(/年資/);
  });
});
