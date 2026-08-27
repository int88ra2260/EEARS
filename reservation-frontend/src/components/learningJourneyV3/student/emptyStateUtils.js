export const EMPTY_REASONS = {
  NO_RECORDS: 'NO_RECORDS',
  NO_SEMESTER_SELECTED: 'NO_SEMESTER_SELECTED',
  NO_ENROLLMENT_SNAPSHOT: 'NO_ENROLLMENT_SNAPSHOT',
  NO_ACTIVITY_PARTICIPATION: 'NO_ACTIVITY_PARTICIPATION',
  NO_COURSE_RECORDS: 'NO_COURSE_RECORDS',
  NO_EXAM_ATTEMPTS: 'NO_EXAM_ATTEMPTS',
  NO_BESTEP_RECORDS: 'NO_BESTEP_RECORDS',
  PROJECTION_NOT_BUILT: 'PROJECTION_NOT_BUILT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  API_ERROR: 'API_ERROR',
  UNKNOWN: 'UNKNOWN'
};

export const EMPTY_REASON_TEXT = {
  [EMPTY_REASONS.NO_RECORDS]: '此學生目前沒有符合條件的學習紀錄',
  [EMPTY_REASONS.NO_SEMESTER_SELECTED]: '請先選擇學期後再查詢學生學習歷程',
  [EMPTY_REASONS.NO_ENROLLMENT_SNAPSHOT]: '此學期尚未建立學生名冊快照',
  [EMPTY_REASONS.NO_ACTIVITY_PARTICIPATION]: '此學生在本學期尚無活動參與紀錄',
  [EMPTY_REASONS.NO_COURSE_RECORDS]: '此學生在本學期尚無修課紀錄；若教務已有選課，請由匯入中心執行修課紀錄匯入',
  [EMPTY_REASONS.NO_EXAM_ATTEMPTS]: '此學生目前沒有英檢成績紀錄',
  [EMPTY_REASONS.NO_BESTEP_RECORDS]: '此學生目前沒有培力英檢紀錄',
  [EMPTY_REASONS.PROJECTION_NOT_BUILT]: '此學期學習歷程統計尚未重建，請先執行資料同步或 rebuild',
  [EMPTY_REASONS.PERMISSION_DENIED]: '你沒有權限查看此學生的學習歷程',
  [EMPTY_REASONS.API_ERROR]: '系統暫時無法取得此區塊資料，請稍後再試',
  [EMPTY_REASONS.UNKNOWN]: '目前沒有可顯示的資料'
};

export function getEmptyReasonText(reason, fallbackText = EMPTY_REASON_TEXT[EMPTY_REASONS.UNKNOWN]) {
  return EMPTY_REASON_TEXT[reason] || fallbackText || EMPTY_REASON_TEXT[EMPTY_REASONS.UNKNOWN];
}

export function getSourceBadge(sourceMeta) {
  if (!sourceMeta || !sourceMeta.source) {
    return { label: '未知來源', className: 'text-bg-secondary' };
  }
  if (sourceMeta.fallbackUsed) {
    return { label: '備援資料', className: 'text-bg-warning' };
  }
  const source = String(sourceMeta.source || '').toLowerCase();
  if (source.includes('english_test_registrations')) {
    return { label: '舊英檢資料', className: 'text-bg-secondary' };
  }
  if (source.includes('legacy') && source.includes('+')) {
    return { label: '混合來源', className: 'text-bg-info' };
  }
  return { label: '正式資料', className: 'text-bg-success' };
}
