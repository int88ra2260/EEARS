/**
 * 刪除違規紀錄時，學生進度仍讀預約的「已登記違規」。
 */
'use strict';

jest.mock('../models', () => ({
  Reservation: { findAll: jest.fn() },
  Event: {},
  BlackListRecord: {},
  EventViolation: { findAll: jest.fn() },
}));

const { Reservation, EventViolation } = require('../models');
const {
  pickViolationToClear,
  restoredCheckinStatus,
  clearStudentVisibleViolation,
} = require('../services/blacklistEnforcementService');

describe('pickViolationToClear', () => {
  const reservation = (id, eventId, extra = {}) => ({
    id,
    eventId,
    checkinStatus: '已登記違規',
    checkinTime: null,
    ...extra,
  });

  it('returns null when no reservation is still marked violated', () => {
    expect(pickViolationToClear(
      { reason: '預約未到', recordedAt: '2026-10-01T10:00:00Z' },
      [{ id: 1, violationType: '預約未到', reservation: { checkinStatus: '未簽到' } }]
    )).toBeNull();
  });

  it('clears the only remaining student-visible violation', () => {
    const only = {
      id: 7,
      eventId: 3,
      violationType: '未遵守規定',
      recordedAt: '2026-09-01T01:00:00Z',
      reservation: reservation(11, 3),
    };
    expect(pickViolationToClear(
      { reason: '課堂紀錄有誤', recordedAt: '2026-10-01T10:00:00Z' },
      [only]
    )).toBe(only);
  });

  it('keeps the other no-show when two exist and picks the closer record', () => {
    const earlier = {
      id: 1,
      violationType: '預約未到',
      recordedAt: '2026-09-01T02:00:00Z',
      reservation: reservation(1, 10),
    };
    const later = {
      id: 2,
      violationType: '預約未到',
      recordedAt: '2026-10-01T09:50:00Z',
      reservation: reservation(2, 20),
    };
    expect(pickViolationToClear(
      { reason: '預約未到', recordedAt: '2026-10-01T10:00:00Z' },
      [earlier, later]
    )).toBe(later);
  });

  it('does not clear a no-show when the deleted reason is an in-event violation', () => {
    const noShow = {
      id: 1,
      violationType: '預約未到',
      recordedAt: '2026-10-01T09:00:00Z',
      reservation: reservation(1, 10),
    };
    const during = {
      id: 2,
      violationType: '擾亂秩序',
      recordedAt: '2026-10-01T09:30:00Z',
      reservation: reservation(2, 20),
    };
    expect(pickViolationToClear(
      { reason: '活動期間違規', recordedAt: '2026-10-01T10:00:00Z' },
      [noShow, during]
    )).toBe(during);
  });

  it('does not guess when several violations remain and the reason matches none', () => {
    expect(pickViolationToClear(
      { reason: '手動補登', recordedAt: '2026-10-01T10:00:00Z' },
      [
        { id: 1, violationType: '預約未到', description: '', recordedAt: '2026-10-01T09:00:00Z', reservation: reservation(1, 10) },
        { id: 2, violationType: '擾亂秩序', description: '', recordedAt: '2026-10-01T09:30:00Z', reservation: reservation(2, 20) },
      ]
    )).toBeNull();
  });
});

describe('restoredCheckinStatus', () => {
  it('returns pending when the student was never checked in', () => {
    expect(restoredCheckinStatus({ checkinTime: null })).toBe('未簽到');
  });

  it('returns checked-in when a check-in time is still on the reservation', () => {
    expect(restoredCheckinStatus({ checkinTime: '2026-10-01T02:00:00Z' })).toBe('已簽到');
  });
});

describe('clearStudentVisibleViolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resets the reservation and removes the event violation row', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const destroy = jest.fn().mockResolvedValue(undefined);
    EventViolation.findAll.mockResolvedValue([
      {
        id: 5,
        eventId: 30,
        userId: 8,
        violationType: '預約未到',
        description: null,
        recordedAt: new Date('2026-10-01T10:00:00Z'),
        destroy,
      },
    ]);
    Reservation.findAll.mockResolvedValue([
      {
        id: 90,
        eventId: 30,
        userId: 8,
        checkinStatus: '已登記違規',
        checkinTime: null,
        update,
      },
    ]);

    const result = await clearStudentVisibleViolation(8, {
      reason: '預約未到',
      recordedAt: new Date('2026-10-01T10:01:00Z'),
    });

    expect(result).toEqual({
      cleared: true,
      eventId: 30,
      reservationId: 90,
      checkinStatus: '未簽到',
    });
    expect(update).toHaveBeenCalledWith({ checkinStatus: '未簽到' }, {});
    expect(destroy).toHaveBeenCalledWith({});
  });

  it('restores checked-in when the reservation still has a check-in time', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    EventViolation.findAll.mockResolvedValue([]);
    Reservation.findAll.mockResolvedValue([
      {
        id: 91,
        eventId: 31,
        userId: 8,
        checkinStatus: '已登記違規',
        checkinTime: new Date('2026-10-01T01:00:00Z'),
        update,
      },
    ]);

    const result = await clearStudentVisibleViolation(8, {
      reason: '課堂紀錄有誤',
      recordedAt: new Date('2026-10-01T10:00:00Z'),
    });

    expect(result.checkinStatus).toBe('已簽到');
    expect(update).toHaveBeenCalledWith({ checkinStatus: '已簽到' }, {});
  });
});
