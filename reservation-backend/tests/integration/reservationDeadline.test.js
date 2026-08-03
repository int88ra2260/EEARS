const dayjs = require('dayjs');
const { calculateReservationTime } = require('../../utils/reservationTime');

jest.mock('../../models', () => ({
  Reservation: { findByPk: jest.fn() },
  Event: function Event() {},
}));

const { Reservation } = require('../../models');
const { cancelReservationPublic } = require('../../services/reservationService');

describe('reservation / cancellation 2-hour cutoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('can reserve before cutoff', () => {
    jest.setSystemTime(new Date('2026-05-08T08:00:00+08:00'));
    const event = {
      eventType: 'English Table',
      date: '2026-05-08',
      startTime: '12:00:00',
    };
    const { openEnd } = calculateReservationTime(event);
    expect(dayjs().isBefore(openEnd)).toBe(true);
  });

  it('cannot reserve inside 2-hour cutoff', () => {
    jest.setSystemTime(new Date('2026-05-08T11:10:00+08:00'));
    const event = {
      eventType: 'English Table',
      date: '2026-05-08',
      startTime: '12:00:00',
    };
    const { openEnd } = calculateReservationTime(event);
    expect(dayjs().isAfter(openEnd)).toBe(true);
  });

  it('cannot reserve after event started', () => {
    jest.setSystemTime(new Date('2026-05-08T12:10:00+08:00'));
    const event = {
      eventType: 'English Table',
      date: '2026-05-08',
      startTime: '12:00:00',
    };
    const { openEnd } = calculateReservationTime(event);
    expect(dayjs().isAfter(openEnd)).toBe(true);
  });

  it('can cancel before cutoff', async () => {
    jest.setSystemTime(new Date('2026-05-08T08:30:00+08:00'));
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
    jest.setSystemTime(new Date('2026-05-08T10:30:00+08:00'));
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
    jest.setSystemTime(new Date('2026-05-08T12:10:00+08:00'));
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
});

