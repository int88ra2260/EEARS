/**
 * 候補服務與流程（以 mock 隔離 DB）
 */
const dayjs = require('dayjs');

describe('waitlistService', () => {
  const tx = { LOCK: { UPDATE: 'UPDATE' } };

  let waitlistService;
  let Event;
  let Reservation;
  let User;
  let EventWaitlistEntry;
  let sequelize;
  let auditLogService;
  let emailQueue;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    sequelize = {
      transaction: jest.fn(async (fn) => fn(tx)),
    };

    Event = { findByPk: jest.fn() };
    Reservation = { count: jest.fn(), findOne: jest.fn(), create: jest.fn() };
    User = { findOne: jest.fn(), create: jest.fn() };
    const mockUser = {
      id: 1,
      isBlacklisted: false,
      blacklistUntil: null,
      update: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockResolvedValue(mockUser);

    EventWaitlistEntry = {
      findOne: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
    };

    jest.doMock('../../models', () => ({
      sequelize,
      Event,
      Reservation,
      User,
      EventWaitlistEntry,
    }));

    auditLogService = { logAuditAsync: jest.fn() };
    emailQueue = { enqueue: jest.fn().mockResolvedValue(1) };

    jest.doMock('../../services/auditLogService', () => auditLogService);
    jest.doMock('../../utils/emailQueue', () => emailQueue);
    jest.doMock('../../utils/logger', () => ({
      error: jest.fn(),
      warn: jest.fn(),
    }));

    waitlistService = require('../../services/waitlistService');
  });

  function baseEvent(over = {}) {
    return {
      id: 100,
      name: '測試活動',
      date: '2026-06-01',
      startTime: '14:00:00',
      endTime: '16:00:00',
      maxCapacity: 2,
      eventType: 'English Table',
      location: '教室A',
      ...over,
    };
  }

  it('1. 活動未額滿時不可候補（SPOTS_AVAILABLE）', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-31T10:00:00+08:00'));
    Event.findByPk.mockResolvedValue(baseEvent());
    Reservation.count.mockResolvedValue(1);

    const r = await waitlistService.joinWaitlist({
      eventId: 100,
      studentId: 'B123456789',
      studentName: '王小明',
      studentEmail: 'a@test.com',
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('SPOTS_AVAILABLE');
    jest.useRealTimers();
  });

  it('2. 活動額滿時可加入候補', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-31T10:00:00+08:00'));
    Event.findByPk.mockResolvedValue(baseEvent());
    Reservation.count.mockResolvedValue(2);
    Reservation.findOne.mockResolvedValue(null);
    EventWaitlistEntry.findOne.mockResolvedValue(null);
    const created = {
      id: 1,
      eventId: 100,
      studentId: 'B123456789',
      studentName: '王小明',
      studentEmail: 'a@test.com',
      createdAt: new Date('2026-05-31T10:00:01Z'),
    };
    EventWaitlistEntry.create.mockResolvedValue(created);
    EventWaitlistEntry.count.mockResolvedValue(1);

    const r = await waitlistService.joinWaitlist({
      eventId: 100,
      studentId: 'B123456789',
      studentName: '王小明',
      studentEmail: 'a@test.com',
    });
    expect(r.ok).toBe(true);
    expect(r.position).toBe(1);
    expect(EventWaitlistEntry.create).toHaveBeenCalled();
    expect(auditLogService.logAuditAsync).toHaveBeenCalled();
    expect(emailQueue.enqueue).toHaveBeenCalledWith('waitlistJoined', expect.any(Object), expect.any(Object));
    jest.useRealTimers();
  });

  it('3. 同一學生不可重複候補', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-31T10:00:00+08:00'));
    Event.findByPk.mockResolvedValue(baseEvent());
    Reservation.count.mockResolvedValue(2);
    Reservation.findOne.mockResolvedValue(null);
    const existing = {
      id: 9,
      eventId: 100,
      studentId: 'B123456789',
      createdAt: new Date('2026-05-31T09:00:00Z'),
    };
    EventWaitlistEntry.findOne.mockResolvedValue(existing);
    EventWaitlistEntry.count.mockResolvedValue(3);

    const r = await waitlistService.joinWaitlist({
      eventId: 100,
      studentId: 'B123456789',
      studentName: '王小明',
      studentEmail: 'a@test.com',
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('ALREADY_WAITLISTED');
    expect(r.position).toBe(3);
    jest.useRealTimers();
  });

  it('4. 已正式預約者不可候補', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-31T10:00:00+08:00'));
    Event.findByPk.mockResolvedValue(baseEvent());
    Reservation.count.mockResolvedValue(2);
    Reservation.findOne.mockResolvedValue({ id: 1 });
    EventWaitlistEntry.findOne.mockResolvedValue(null);

    const r = await waitlistService.joinWaitlist({
      eventId: 100,
      studentId: 'B123456789',
      studentName: '王小明',
      studentEmail: 'a@test.com',
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('ALREADY_RESERVED');
    jest.useRealTimers();
  });

  it('5. 黑名單學生不可候補', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-31T10:00:00+08:00'));
    Event.findByPk.mockResolvedValue(baseEvent());
    Reservation.count.mockResolvedValue(2);
    Reservation.findOne.mockResolvedValue(null);
    EventWaitlistEntry.findOne.mockResolvedValue(null);
    User.findOne.mockResolvedValue({
      id: 1,
      isBlacklisted: true,
      blacklistUntil: dayjs().add(7, 'day').toDate(),
      update: jest.fn().mockResolvedValue(undefined),
    });

    const r = await waitlistService.joinWaitlist({
      eventId: 100,
      studentId: 'B123456789',
      studentName: '王小明',
      studentEmail: 'a@test.com',
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('BLACKLIST');
    jest.useRealTimers();
  });

  it('6. 超過活動開始前 2 小時不可候補（與 openEnd 一致）', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T13:30:00+08:00'));
    Event.findByPk.mockResolvedValue(baseEvent());

    const r = await waitlistService.joinWaitlist({
      eventId: 100,
      studentId: 'B123456789',
      studentName: '王小明',
      studentEmail: 'a@test.com',
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('NOT_IN_BOOKING_WINDOW');
    jest.useRealTimers();
  });

  it('7–8. 取消後轉正：建立預約並標記 promoted', async () => {
    const nextEntry = {
      id: 50,
      eventId: 100,
      studentId: 'B987654321',
      studentName: '陳候補',
      studentEmail: 'w@test.com',
      update: jest.fn().mockResolvedValue(undefined),
    };
    Event.findByPk.mockResolvedValue(baseEvent());
    Reservation.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    EventWaitlistEntry.findOne.mockResolvedValue(nextEntry);
    Reservation.findOne.mockResolvedValue(null);
    Reservation.create.mockResolvedValue({ id: 999, studentId: 'B987654321' });
    User.findOne.mockResolvedValue({
      id: 2,
      isBlacklisted: false,
      blacklistUntil: null,
      update: jest.fn().mockResolvedValue(undefined),
    });

    const out = await waitlistService.promoteNextWaitlistedStudent({
      eventId: 100,
      triggeredBy: 'test',
    });

    expect(out.promoted).toBe(true);
    expect(out.reservationId).toBe(999);
    expect(nextEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'promoted', promotedReservationId: 999 }),
      expect.any(Object)
    );
    expect(auditLogService.logAuditAsync).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'WAITLIST_PROMOTED' })
    );
    expect(emailQueue.enqueue).toHaveBeenCalledWith('waitlistPromoted', expect.any(Object), expect.any(Object));
  });

  it('9. email enqueue 失敗不影響 DB（promote 已在 transaction 外才寄信）', async () => {
    emailQueue.enqueue.mockRejectedValueOnce(new Error('queue fail'));
    const nextEntry = {
      id: 50,
      eventId: 100,
      studentId: 'B987654321',
      studentName: '陳候補',
      studentEmail: 'w@test.com',
      update: jest.fn().mockResolvedValue(undefined),
    };
    Event.findByPk.mockResolvedValue(baseEvent());
    Reservation.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    EventWaitlistEntry.findOne.mockResolvedValue(nextEntry);
    Reservation.findOne.mockResolvedValue(null);
    Reservation.create.mockResolvedValue({ id: 1001, studentId: 'B987654321' });
    User.findOne.mockResolvedValue({
      id: 2,
      isBlacklisted: false,
      blacklistUntil: null,
      update: jest.fn().mockResolvedValue(undefined),
    });

    const out = await waitlistService.promoteNextWaitlistedStudent({ eventId: 100 });
    expect(out.promoted).toBe(true);
    expect(out.reservationId).toBe(1001);
  });

  it('10. 已滿座不轉正', async () => {
    Event.findByPk.mockResolvedValue(baseEvent());
    Reservation.count.mockResolvedValue(2);

    const out = await waitlistService.promoteNextWaitlistedStudent({ eventId: 100 });
    expect(out.promoted).toBe(false);
    expect(out.reason).toBe('full');
  });
});
