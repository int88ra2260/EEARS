'use strict';

const {
  violationDeletedStatusCopy,
  classCreditAdjustmentFollowUp,
} = require('../utils/studentNoticeCopy');

describe('violationDeletedStatusCopy', () => {
  it('says the student can reserve again when the current-semester blacklist is lifted', () => {
    const copy = violationDeletedStatusCopy({
      affectsCurrentSemester: true,
      isBlacklisted: false,
    });
    expect(copy.statusZh).toContain('可以繼續預約');
  });

  it('keeps the suspension date when the student is still blacklisted', () => {
    const copy = violationDeletedStatusCopy({
      affectsCurrentSemester: true,
      isBlacklisted: true,
      blacklistUntil: '2026-10-18',
    });
    expect(copy.statusZh).toContain('暫停預約');
    expect(copy.statusZh).toContain('2026-10-18');
  });

  it('does not change the current-semester message for an older record', () => {
    const copy = violationDeletedStatusCopy({ affectsCurrentSemester: false });
    expect(copy.statusZh).toContain('不屬於本學期');
  });
});

describe('classCreditAdjustmentFollowUp', () => {
  it('tells a single-course student the added hours are applied automatically', () => {
    const copy = classCreditAdjustmentFollowUp({
      direction: 'add',
      classCount: 1,
      className: '英文中級',
    });
    expect(copy.followUpZh).toContain('自動計入');
    expect(copy.followUpZh).toContain('英文中級');
  });

  it('asks a multi-course student to assign added hours', () => {
    const copy = classCreditAdjustmentFollowUp({
      direction: 'add',
      classCount: 2,
      allocationUrl: 'https://example.test/student/class-credit-allocation',
    });
    expect(copy.followUpZh).toContain('配置頁');
    expect(copy.followUpZh).toContain('https://example.test/student/class-credit-allocation');
  });

  it('asks a multi-course student to review courses after a deduction', () => {
    const copy = classCreditAdjustmentFollowUp({
      direction: 'deduct',
      classCount: 2,
    });
    expect(copy.followUpZh).toContain('確認');
  });
});
