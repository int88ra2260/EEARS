import { buildDashboardTodoItems } from './adminDashboardTodos';

function todayYmd() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

describe('buildDashboardTodoItems', () => {
  it('returns empty when nothing is pending', () => {
    expect(buildDashboardTodoItems({})).toEqual([]);
  });

  it('includes today events, pending english, drafts and violations', () => {
    const items = buildDashboardTodoItems({
      events: [{ date: todayYmd() }, { date: '2099-01-01' }],
      kpiEnglishPending: { status: 'success', value: 3 },
      kpiAnnouncementDraft: { status: 'success', value: 2 },
      violationCount: 4,
    });
    expect(items.map((item) => item.id)).toEqual([
      'today-events',
      'english-pending',
      'announcement-draft',
      'violations',
    ]);
    expect(items[0].to).toBe('/admin/operations');
    expect(items[1].count).toBe(3);
  });

  it('skips error or loading KPIs', () => {
    const items = buildDashboardTodoItems({
      kpiEnglishPending: { status: 'error', value: 9 },
      kpiAnnouncementDraft: { status: 'loading', value: 8 },
    });
    expect(items).toEqual([]);
  });

  it('uses todayEventCount when provided', () => {
    const items = buildDashboardTodoItems({ todayEventCount: 2 });
    expect(items).toEqual([
      expect.objectContaining({
        id: 'today-events',
        count: 2,
        to: '/admin/operations',
      }),
    ]);
  });
});
