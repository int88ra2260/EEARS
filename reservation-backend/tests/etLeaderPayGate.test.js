'use strict';

const { evaluateSessionPayGate } = require('../services/etGrouping/etLeaderPayGate');

const event = { date: '2026-10-15', endTime: '12:55', startTime: '12:10' };
const tasks = [
  { id: 1, bandScope: 'ALL', isRequired: true, isActive: true },
  { id: 2, bandScope: 'ET-B2', isRequired: true, isActive: true },
];

describe('evaluateSessionPayGate', () => {
  test('counts a session once every required mark exists, including an explicit no', () => {
    const gate = evaluateSessionPayGate({
      attendance: { status: 'on_time' },
      groupLabels: ['A'],
      students: [
        { reservationId: 9, checkinStatus: '已簽到', groupLabel: 'A', bandCode: '001' },
        { reservationId: 10, checkinStatus: '未簽到', groupLabel: 'A', bandCode: '001' },
        { reservationId: 11, checkinStatus: '已簽到', groupLabel: 'B', bandCode: '001' },
      ],
      markKeys: new Set(['9:1']),
      taskItems: tasks,
      event,
      now: new Date('2026-10-16T00:00:00+08:00'),
    });
    expect(gate.payable).toBe(true);
    expect(gate.status).toBe('ready');
    expect(gate.checkedInCount).toBe(1);
  });

  test('holds pay while required marks are still blank inside the grace window', () => {
    const gate = evaluateSessionPayGate({
      attendance: { status: 'late' },
      groupLabels: ['A'],
      students: [
        { reservationId: 9, checkinStatus: '已簽到', groupLabel: 'A', bandCode: 'ET-B2' },
      ],
      markKeys: new Set(['9:1']),
      taskItems: tasks,
      event,
      now: new Date('2026-10-16T00:00:00+08:00'),
    });
    expect(gate.payable).toBe(false);
    expect(gate.status).toBe('pending');
    expect(gate.incompleteCount).toBe(1);
    expect(gate.daysLeft).toBeGreaterThan(0);
  });

  test('admin release pays the session and keeps the reason', () => {
    const gate = evaluateSessionPayGate({
      attendance: { status: 'manual', payReleasedAt: '2026-10-20T00:00:00Z', payReleaseNote: '現場名單對不上' },
      groupLabels: ['A'],
      students: [
        { reservationId: 9, checkinStatus: '已簽到', groupLabel: 'A', bandCode: '001' },
      ],
      markKeys: new Set(),
      taskItems: tasks,
      event,
      now: new Date('2026-10-20T00:00:00+08:00'),
    });
    expect(gate.payable).toBe(true);
    expect(gate.status).toBe('released');
    expect(gate.releaseNote).toBe('現場名單對不上');
  });

  test('closes pay after three days when required marks are still blank', () => {
    const gate = evaluateSessionPayGate({
      attendance: { status: 'on_time' },
      groupLabels: ['A'],
      students: [
        { reservationId: 9, checkinStatus: '已簽到', groupLabel: 'A', bandCode: '001' },
      ],
      markKeys: new Set(),
      taskItems: tasks,
      event,
      now: new Date('2026-10-20T09:00:00+08:00'),
    });
    expect(gate.payable).toBe(false);
    expect(gate.status).toBe('expired');
    expect(gate.markingOpen).toBe(false);
  });

  test('an admin extension lets the leader finish marks before the session is paid', () => {
    const gate = evaluateSessionPayGate({
      attendance: {
        status: 'late',
        markingOpenUntil: '2026-10-22T18:00:00+08:00',
        markingOpenNote: '當天沒勾完',
      },
      groupLabels: ['A'],
      students: [
        { reservationId: 9, checkinStatus: '已簽到', groupLabel: 'A', bandCode: '001' },
      ],
      markKeys: new Set(),
      taskItems: tasks,
      event,
      now: new Date('2026-10-20T09:00:00+08:00'),
    });
    expect(gate.payable).toBe(false);
    expect(gate.status).toBe('pending');
    expect(gate.extended).toBe(true);
    expect(gate.markingOpen).toBe(true);
  });

  test('does not pay a leader who never checked in', () => {
    const gate = evaluateSessionPayGate({
      attendance: null,
      groupLabels: ['A'],
      students: [],
      taskItems: tasks,
      event,
    });
    expect(gate.payable).toBe(false);
    expect(gate.status).toBe('unchecked');
  });
});
