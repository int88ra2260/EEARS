/**
 * 營運總覽「今日待辦」：用既有 KPI／活動資料組成可點擊項目，不另打 API。
 */

function kpiCount(kpi) {
  if (!kpi || kpi.status === 'error' || kpi.status === 'loading') return 0;
  const n = Number(kpi.value);
  return Number.isFinite(n) ? n : 0;
}

function localYmd(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isLocalToday(dateStr) {
  if (!dateStr) return false;
  const raw = String(dateStr).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw === localYmd();
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return localYmd(d) === localYmd();
}

export function countTodayEvents(events) {
  return (Array.isArray(events) ? events : []).filter((evt) => isLocalToday(evt?.date)).length;
}

/**
 * @param {{
 *   events?: Array<{ date?: string }>,
 *   kpiEnglishPending?: { status?: string, value?: number },
 *   kpiAnnouncementDraft?: { status?: string, value?: number },
 *   violationCount?: number,
 * }} input
 * @returns {Array<{ id: string, label: string, count: number, to: string, action: string }>}
 */
export function buildDashboardTodoItems({
  events = [],
  todayEventCount,
  kpiEnglishPending,
  kpiAnnouncementDraft,
  violationCount = 0,
} = {}) {
  const resolvedTodayCount =
    typeof todayEventCount === 'number' ? todayEventCount : countTodayEvents(events);
  const englishPending = kpiCount(kpiEnglishPending);
  const announcementDraft = kpiCount(kpiAnnouncementDraft);
  const violations = Number(violationCount) > 0 ? Number(violationCount) : 0;

  const items = [];
  if (resolvedTodayCount > 0) {
    items.push({
      id: 'today-events',
      label: `今日場次 ${resolvedTodayCount} 場`,
      count: resolvedTodayCount,
      to: '/admin/operations',
      action: '前往簽到／管理',
    });
  }
  if (englishPending > 0) {
    items.push({
      id: 'english-pending',
      label: `英檢待審 ${englishPending} 筆`,
      count: englishPending,
      to: '/admin/english-test',
      action: '前往審核',
    });
  }
  if (announcementDraft > 0) {
    items.push({
      id: 'announcement-draft',
      label: `公告草稿 ${announcementDraft} 則`,
      count: announcementDraft,
      to: '/admin/announcements',
      action: '前往公告',
    });
  }
  if (violations > 0) {
    items.push({
      id: 'violations',
      label: `本學期違規 ${violations} 筆`,
      count: violations,
      to: '/admin/violations',
      action: '前往處理',
    });
  }
  return items;
}
