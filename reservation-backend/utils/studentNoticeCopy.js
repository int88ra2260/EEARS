'use strict';

function violationDeletedStatusCopy({
  affectsCurrentSemester = false,
  isBlacklisted = false,
  blacklistUntil = '',
} = {}) {
  if (!affectsCurrentSemester) {
    return {
      statusZh: '這筆紀錄不屬於本學期，本學期的預約狀態沒有改變。',
      statusEn: 'This record is not from the current semester, so your reservation status this semester is unchanged.',
    };
  }
  if (isBlacklisted) {
    const until = String(blacklistUntil || '').trim();
    return {
      statusZh: until
        ? `您目前仍因本學期違規達兩次而暫停預約，至 ${until} 止。`
        : '您目前仍因本學期違規達兩次而暫停預約。',
      statusEn: until
        ? `Your reservation privileges remain suspended until ${until} because you still have two violations this semester.`
        : 'Your reservation privileges remain suspended because you still have two violations this semester.',
    };
  }
  return {
    statusZh: '您目前可以繼續預約活動。',
    statusEn: 'You may continue to make reservations.',
  };
}

function classCreditAdjustmentFollowUp({
  direction = 'add',
  classCount = 1,
  className = '',
  allocationUrl = '',
} = {}) {
  const course = className ? `「${className}」` : '該班';
  const url = String(allocationUrl || '').trim();
  if (Number(classCount) <= 1) {
    if (direction === 'deduct') {
      return {
        followUpZh: `已從${course}的課堂加分扣除。`,
        followUpEn: `This change has been applied to ${className || 'your course'}.`,
      };
    }
    return {
      followUpZh: `這段時數已自動計入${course}，不必再自行配置。`,
      followUpEn: `These hours have been applied to ${className || 'your course'}. You do not need to assign them yourself.`,
    };
  }
  const link = url ? `\n${url}` : '';
  if (direction === 'deduct') {
    return {
      followUpZh: `若您已把時數配置到課程，請至課堂加分配置頁確認各班時數。${link}`,
      followUpEn: `If you already assigned hours to your courses, please review them on the class-credit page.${link}`,
    };
  }
  return {
    followUpZh: `您本學期修習多門課。請至課堂加分配置頁，把尚未分配的時數配置到課程。${link}`,
    followUpEn: `You are enrolled in more than one course this semester. Please assign any unallocated hours on the class-credit page.${link}`,
  };
}

module.exports = {
  violationDeletedStatusCopy,
  classCreditAdjustmentFollowUp,
};
