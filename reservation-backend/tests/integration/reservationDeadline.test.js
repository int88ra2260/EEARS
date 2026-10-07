const dayjs = require('dayjs');
const ENGLISH_TABLE_CONFIG = {
  code: 'english_table',
  displayName: 'English Table',
  openRule: { type: 'day_before', days: 1, hour: 12, minute: 0 },
  cutoffHours: 2,
};

jest.mock('../../services/eventTypeService', () => ({
  resolveTypeConfigSync: jest.fn(() => ENGLISH_TABLE_CONFIG),
  resolveTypeConfig: jest.fn(async () => ENGLISH_TABLE_CONFIG),
}));

const { calculateReservationTime } = require('../../utils/reservationTime');

jest.mock('../../models', () => ({
  Reservation: { findByPk: jest.fn() },
  Event: function Event() {},
}));

const { Reservation } = require('../../models');
const { cancelReservationPublic, cancelReservationByAdmin } = require('../../services/reservationService');

describe('reservation / cancellation 2-hour cutoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('English Table opens at noon the day before (not midnight)', () => {
    const event = {
      eventType: 'English Table',
      date: '2026-05-08',
      startTime: '14:00:00',
    };
    const { openStart, openEnd } = calculateReservationTime(event);
    expect(openStart.format('YYYY-MM-DD HH:mm')).toBe('2026-05-07 12:00');
    expect(openEnd.format('YYYY-MM-DD HH:mm')).toBe('2026-05-08 12:00');
    expect(openStart.hour()).toBe(12);
    expect(openStart.minute()).toBe(0);
  });

  it('custom event types use English Table noon-open rule', () => {
    const event = {
      eventType: 'Custom Workshop',
      date: '2026-05-08',
      startTime: '14:00:00',
    };
    const { openStart } = calculateReservationTime(event);
    expect(openStart.format('YYYY-MM-DD HH:mm')).toBe('2026-05-07 12:00');
  });

  it('can reserve before cutoff', () => {
    jest.setSystemTime(new Date('2026-05-08T08:00:00'));
    const event = {
      eventType: 'English Table',
      date: '2026-05-08',
      startTime: '12:00:00',
    };
    const { openEnd } = calculateReservationTime(event);
    expect(dayjs().isBefore(openEnd)).toBe(true);
  });

  it('cannot reserve inside 2-hour cutoff', () => {
    jest.setSystemTime(new Date('2026-05-08T11:10:00'));
    const event = {
      eventType: 'English Table',
      date: '2026-05-08',
      startTime: '12:00:00',
    };
    const { openEnd } = calculateReservationTime(event);
    expect(dayjs().isAfter(openEnd)).toBe(true);
  });

  it('cannot reserve after event started', () => {
    jest.setSystemTime(new Date('2026-05-08T12:10:00'));
    const event = {
      eventType: 'English Table',
      date: '2026-05-08',
      startTime: '12:00:00',
    };
    const { openEnd } = calculateReservationTime(event);
    expect(dayjs().isAfter(openEnd)).toBe(true);
  });

  it('can cancel before cutoff', async () => {
    jest.setSystemTime(new Date('2026-05-08T08:30:00'));
    const destroy = jest.fn().mockResolvedValue(undefined);
    Reservation.findByPk.mockResolvedValue({
      studentId: 'B123456789',
      studentName: 'Tester',
      studentEmail: 'a@b.com',
      cancellationCode: 'ABC123',
      Event: { date: '2026-05-08', startTime: '12:00:00' },
      destroy,
    });
    const result = await cancelReservationPublic({
      reservationId: 1,
      studentId: 'B123456789',
      studentName: 'Tester',
      email: 'a@b.com',
      verificationCode: 'ABC123',
    });
    expect(result.cancelled).toBe(true);
    expect(destroy).toHaveBeenCalled();
  });

  it('cannot cancel inside 2-hour cutoff', async () => {
    jest.setSystemTime(new Date('2026-05-08T10:30:00'));
    Reservation.findByPk.mockResolvedValue({
      studentId: 'B123456789',
      studentName: 'Tester',
      studentEmail: 'a@b.com',
      cancellationCode: 'ABC123',
      Event: { date: '2026-05-08', startTime: '12:00:00' },
      destroy: jest.fn(),
    });
    const result = await cancelReservationPublic({
      reservationId: 1,
      studentId: 'B123456789',
      studentName: 'Tester',
      email: 'a@b.com',
      verificationCode: 'ABC123',
    });
    expect(result.cancelled).toBe(false);
    expect(result.reason).toBe('time_window_closed');
  });

  it('cannot cancel after event started', async () => {
    jest.setSystemTime(new Date('2026-05-08T12:10:00'));
    Reservation.findByPk.mockResolvedValue({
      studentId: 'B123456789',
      studentName: 'Tester',
      studentEmail: 'a@b.com',
      cancellationCode: 'ABC123',
      Event: { date: '2026-05-08', startTime: '12:00:00' },
      destroy: jest.fn(),
    });
    const result = await cancelReservationPublic({
      reservationId: 1,
      studentId: 'B123456789',
      studentName: 'Tester',
      email: 'a@b.com',
      verificationCode: 'ABC123',
    });
    expect(result.cancelled).toBe(false);
    expect(result.reason).toBe('time_window_closed');
  });

  it('admin can cancel without a verification code', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Reservation.findByPk.mockResolvedValue({
      id: 9,
      studentId: 'B123456789',
      studentEmail: 'wrong@example.com',
      cancellationCode: 'ABC123',
      Event: { id: 3, date: '2026-05-08', startTime: '12:00:00' },
      destroy,
    });
    const result = await cancelReservationByAdmin({ reservationId: 9 });
    expect(result.cancelled).toBe(true);
    expect(result.reason).toBeNull();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

