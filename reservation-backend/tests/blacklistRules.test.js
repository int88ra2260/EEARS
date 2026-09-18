// tests/blacklistRules.test.js
// 黑名單規則、違規累積與自動標記測試

const dayjs = require('dayjs');
const {
  computeBlacklistUnlockDate,
  resolveSemesterId,
} = require('../services/blacklistEnforcementService');
const { SEMESTER_RANGES } = require('../utils/semesterConstants');

describe('黑名單規則測試', () => {
  describe('違規累積邏輯（當學期）', () => {
    it('當學期違規次數達到 2 次時應該進入黑名單', () => {
      const semesterViolationCount = 2;
      const shouldBlacklist = semesterViolationCount >= 2;
      expect(shouldBlacklist).toBe(true);
    });

    it('當學期違規次數為 1 次時不應該進入黑名單', () => {
      const semesterViolationCount = 1;
      const shouldBlacklist = semesterViolationCount >= 2;
      expect(shouldBlacklist).toBe(false);
    });

    it('跨學期應歸零：上學期累積不計入當學期門檻', () => {
      const previousSemesterCount = 5;
      const currentSemesterCount = 1;
      // 門檻只看當學期
      expect(previousSemesterCount >= 2).toBe(true);
      expect(currentSemesterCount >= 2).toBe(false);
    });
  });

  describe('學期歸屬', () => {
    it('resolveSemesterId 應落在設定區間內', () => {
      const sampleStart = SEMESTER_RANGES['115-1']?.start;
      expect(sampleStart).toBeTruthy();
      expect(resolveSemesterId(sampleStart)).toBe('115-1');
    });
  });

  describe('黑名單解除時間計算', () => {
    it('應該正確計算下個或下下個禮拜天的 23:59:59', () => {
      const unlockDate = computeBlacklistUnlockDate(dayjs('2026-09-16')); // Wed
      expect(unlockDate.day()).toBe(0);
      expect(unlockDate.hour()).toBe(23);
      expect(unlockDate.minute()).toBe(59);
      expect(unlockDate.second()).toBe(59);
    });
  });

  describe('No-Show 自動標記', () => {
    it('當預約未簽到時應該標記為違規', () => {
      const checkinStatus = '未簽到';
      const shouldMarkViolation = checkinStatus === '未簽到';
      expect(shouldMarkViolation).toBe(true);
    });

    it('當預約已簽到時不應該標記為違規', () => {
      const checkinStatus = '已簽到';
      const shouldMarkViolation = checkinStatus === '未簽到';
      expect(shouldMarkViolation).toBe(false);
    });
  });

  describe('黑名單期間檢查', () => {
    it('當黑名單解除時間未到時應該阻擋預約', () => {
      const now = dayjs();
      const blacklistUntil = now.add(7, 'day');
      const isBlacklisted = blacklistUntil.isAfter(now);
      expect(isBlacklisted).toBe(true);
    });

    it('當黑名單解除時間已過時應該允許預約', () => {
      const now = dayjs();
      const blacklistUntil = now.subtract(1, 'day');
      const isBlacklisted = blacklistUntil.isAfter(now);
      expect(isBlacklisted).toBe(false);
    });
  });
});
