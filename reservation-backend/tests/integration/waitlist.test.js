/**
 * 候補已停用：加入被拒、取消後不轉正
 */
describe('waitlistService (disabled)', () => {
  let waitlistService;
  let EventWaitlistEntry;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    EventWaitlistEntry = {
      update: jest.fn().mockResolvedValue([3]),
      findAll: jest.fn(),
      findByPk: jest.fn(),
    };

    jest.doMock('../../models', () => ({
      EventWaitlistEntry,
    }));
    jest.doMock('../../services/auditLogService', () => ({
      logAuditAsync: jest.fn(),
    }));

    waitlistService = require('../../services/waitlistService');
  });

  it('joinWaitlist 一律回 WAITLIST_DISABLED 且不寫入', async () => {
    const r = await waitlistService.joinWaitlist({
      eventId: 100,
      studentId: 'B123456789',
      studentName: '王小明',
      studentEmail: 'a@test.com',
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('WAITLIST_DISABLED');
    expect(EventWaitlistEntry.update).not.toHaveBeenCalled();
  });

  it('promoteNextWaitlistedStudent 不轉正', async () => {
    const out = await waitlistService.promoteNextWaitlistedStudent({ eventId: 100 });
    expect(out.promoted).toBe(false);
    expect(out.reason).toBe('waitlist_disabled');
  });

  it('expireWaitingEntries 將 waiting 改為 expired', async () => {
    const out = await waitlistService.expireWaitingEntries();
    expect(out.expired).toBe(3);
    expect(EventWaitlistEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'expired', notes: 'waitlist_disabled' }),
      expect.objectContaining({ where: { status: 'waiting' } })
    );
  });
});
