/**
 * 違規次數跨學期歸零（以 BlackListRecord 當學期筆數為準）
 */
'use strict';

jest.mock('../models', () => ({
  Reservation: {},
  Event: {},
  BlackListRecord: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
}));

const { BlackListRecord } = require('../models');
const {
  countViolationsInSemester,
  syncSemesterViolationCountAndMaybeBlacklist,
  afterViolationRecordDeleted,
  resolveSemesterId,
} = require('../services/blacklistEnforcementService');
const { SEMESTER_RANGES } = require('../utils/semesterConstants');

describe('blacklistEnforcementService semester violation count', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('countViolationsInSemester counts only records in the semester range', async () => {
    BlackListRecord.count.mockResolvedValue(1);
    const range = SEMESTER_RANGES['115-1'];
    const atDate = new Date(`${range.start}T12:00:00+08:00`);

    const count = await countViolationsInSemester(42, { atDate });
    expect(count).toBe(1);
    expect(BlackListRecord.count).toHaveBeenCalledTimes(1);
    const where = BlackListRecord.count.mock.calls[0][0].where;
    expect(where.userId).toBe(42);
    expect(where.recordedAt).toBeDefined();
  });

  it('syncSemesterViolationCountAndMaybeBlacklist resets stale lifetime count and does not blacklist at 1', async () => {
    BlackListRecord.count.mockResolvedValue(1);
    const user = {
      id: 9,
      violationCount: 5, // 上學期殘留
      isBlacklisted: false,
      blacklistUntil: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const range = SEMESTER_RANGES['115-1'];
    const now = new Date(`${range.start}T10:00:00+08:00`);

    const result = await syncSemesterViolationCountAndMaybeBlacklist(user, {
      now,
      cancelReservations: false,
    });

    expect(result.violationCount).toBe(1);
    expect(result.blacklistedNow).toBe(false);
    expect(user.violationCount).toBe(1);
    expect(user.isBlacklisted).toBe(false);
    expect(user.save).toHaveBeenCalled();
  });

  it('syncSemesterViolationCountAndMaybeBlacklist blacklists when semester count >= 2', async () => {
    BlackListRecord.count.mockResolvedValue(2);
    const user = {
      id: 9,
      violationCount: 0,
      isBlacklisted: false,
      blacklistUntil: null,
      email: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const range = SEMESTER_RANGES['115-1'];
    const now = new Date(`${range.start}T10:00:00+08:00`);

    const result = await syncSemesterViolationCountAndMaybeBlacklist(user, {
      now,
      cancelReservations: false,
    });

    expect(result.violationCount).toBe(2);
    expect(result.blacklistedNow).toBe(true);
    expect(user.isBlacklisted).toBe(true);
    expect(user.blacklistUntil).toBeTruthy();
  });

  it('afterViolationRecordDeleted clears blacklist only for current-semester deletions', async () => {
    BlackListRecord.count.mockResolvedValue(1);
    const user = {
      id: 3,
      violationCount: 2,
      isBlacklisted: true,
      blacklistUntil: new Date('2099-01-01'),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const currentSemester = resolveSemesterId(new Date());
    const range = SEMESTER_RANGES[currentSemester];
    expect(range).toBeTruthy();

    await afterViolationRecordDeleted(user, new Date(`${range.start}T08:00:00+08:00`));
    expect(user.violationCount).toBe(1);
    expect(user.isBlacklisted).toBe(false);
    expect(user.blacklistUntil).toBeNull();
  });

  it('afterViolationRecordDeleted does not clear blacklist when deleting other-semester record', async () => {
    BlackListRecord.count.mockResolvedValue(0);
    const user = {
      id: 3,
      violationCount: 0,
      isBlacklisted: true,
      blacklistUntil: new Date('2099-01-01'),
      save: jest.fn().mockResolvedValue(undefined),
    };

    // 固定用上一可用學期區間（若當前是列表第一個則用第二個）
    const codes = Object.keys(SEMESTER_RANGES);
    const current = resolveSemesterId(new Date());
    const other = codes.find((c) => c !== current) || codes[0];
    const otherRange = SEMESTER_RANGES[other];

    await afterViolationRecordDeleted(user, new Date(`${otherRange.start}T08:00:00+08:00`));
    expect(user.isBlacklisted).toBe(true);
    expect(user.blacklistUntil).toBeTruthy();
  });
});
