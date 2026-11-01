import { canAccessAdminRoute } from '../../constants/adminRouteAccess';
import { formatPct1 } from './activityOpsPresentation';

/** 既有管理頁。不附查詢字串，因為這些頁不會讀取總覽的學期或活動類型。 */
export const OPERATIONS_FOLLOW_UPS = Object.freeze([
  {
    id: 'events',
    label: '開啟活動列表',
    to: '/admin/operations',
    hint: '活動列表不會套用此頁的學期或活動類型，請在該頁自行篩選。',
  },
  {
    id: 'checkins',
    label: '開啟簽到參與統計',
    to: '/admin/operations/participation',
    hint: '簽到頁不會自動帶入此頁的活動類型。',
  },
  {
    id: 'violations',
    label: '開啟違規管理',
    to: '/admin/violations',
    hint: '違規管理使用自己的清單，不會套用這裡的活動日期。',
  },
  {
    id: 'risk',
    label: '開啟高風險行政追蹤',
    to: '/admin/analytics/risk',
    hint: '高風險頁使用自己的學期控制，這裡不代傳篩選。',
  },
  {
    id: 'reports',
    label: '開啟營運報表',
    to: '/admin/reports',
    hint: '報表頁不會自動套用此頁的活動類型。',
  },
]);

function named(type) {
  return `「${type}」`;
}

export function describeReservationConcentration(byEventType) {
  const rows = (byEventType || []).filter((row) => row && row.eventType);
  const known = rows.filter((row) => Number.isFinite(row.totalReservations));
  const missing = rows.length - known.length;
  if (known.length === 0) {
    return '資料不足，暫無法判斷哪些活動類型的預約筆數較多。';
  }
  const max = known.reduce((best, row) => Math.max(best, row.totalReservations), 0);
  const top = known.filter((row) => row.totalReservations === max);
  const names = top.map((row) => named(row.eventType)).join('與');
  const missingNote = missing > 0 ? '缺少預約筆數的類型沒有納入比較。' : '';
  if (max === 0) {
    return `所選活動日期內，各類型預約筆數皆為 0。這只表示沒有預約列。${missingNote}`;
  }
  if (top.length === 1) {
    return `預約筆數主要出現在${names}，共 ${max} 筆預約列。這是預約列數，不是不重複學生人數。${missingNote}`;
  }
  return `${names}的預約筆數同為 ${max} 筆預約列，沒有單一較集中的類型。這不是不重複學生人數。${missingNote}`;
}

export function describeAttendance(attendanceRate) {
  if (!Number.isFinite(attendanceRate)) {
    return '預約列簽到率沒有數值，暫無法判斷。分項表沒有各類型出席數，這裡不另算比例。';
  }
  return `預約列簽到率為 ${formatPct1(attendanceRate)}。分母是預約列，不是報名學生人數，也沒有依活動類型拆開。`;
}

export function describeViolations(violationRate) {
  if (!Number.isFinite(violationRate)) {
    return '預約列違規狀態比沒有數值，暫無法判斷哪些行政例外需要查看。';
  }
  return `預約列違規狀態比為 ${formatPct1(violationRate)}。時間用活動日期，不是違規登錄日，也不是違規事件表的比例。`;
}

export function buildOperationsObservation({
  semester,
  dateWindow,
  byEventType,
  attendanceRate,
  violationRate,
  accessProfile,
}) {
  const windowLabel = dateWindow || '此學期尚未列入共用日期設定';
  const lines = [
    `觀察使用學期 ${semester || '未指定'} 的活動日期（${windowLabel}）。`,
    describeReservationConcentration(byEventType),
    describeAttendance(attendanceRate),
    describeViolations(violationRate),
  ];
  const actions = OPERATIONS_FOLLOW_UPS.filter((action) => (
    !action.to.includes('?')
    && canAccessAdminRoute(accessProfile, action.to)
  ));
  const hubAllowed = canAccessAdminRoute(accessProfile, '/admin/analytics');
  return {
    lines,
    actions,
    hubPath: hubAllowed ? '/admin/analytics' : null,
  };
}
