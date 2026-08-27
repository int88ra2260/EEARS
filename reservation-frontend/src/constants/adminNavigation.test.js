import {
  ADMIN_NAV_SECTIONS,
  filterAdminNavByQuery,
  filterVisibleNav,
  getAdminBreadcrumbs,
  getAdminRoleHomeLabel,
  getAdminRoleHomePath,
  getDefaultExpandedSectionIds,
} from './adminNavigation';
import { buildAccessProfile, buildNavContextFromAccessProfile } from '../utils/accessControl';
import { canAccessAdminRoute } from './adminRouteAccess';

describe('getAdminRoleHomePath', () => {
  it('returns login when unauthenticated', () => {
    expect(getAdminRoleHomePath(null)).toBe('/login');
  });

  it('returns my-sessions for leader', () => {
    expect(getAdminRoleHomePath({ role: 'leader' })).toBe('/admin/et-grouping/my-sessions');
  });

  it('returns classes for regular teacher', () => {
    expect(getAdminRoleHomePath({ role: 'teacher', teacherLevel: 'regular' })).toBe('/admin/classes');
  });

  it('returns operations for office staff', () => {
    expect(getAdminRoleHomePath({ role: 'office_staff' })).toBe('/admin/operations');
  });

  it('returns dashboard for admin', () => {
    expect(getAdminRoleHomePath({ role: 'admin' })).toBe('/admin/dashboard');
  });
});

describe('getAdminRoleHomeLabel', () => {
  it('matches role-specific copy', () => {
    expect(getAdminRoleHomeLabel({ role: 'leader' })).toBe('返回我的帶班場次');
    expect(getAdminRoleHomeLabel({ role: 'teacher', teacherLevel: 'regular' })).toBe('返回班級概況');
    expect(getAdminRoleHomeLabel({ role: 'office_staff' })).toBe('返回活動列表');
    expect(getAdminRoleHomeLabel({ role: 'admin' })).toBe('返回後台首頁');
  });
});

describe('filterVisibleNav worker restriction', () => {
  const workerProfile = buildAccessProfile('', 'worker');
  const workerCtx = buildNavContextFromAccessProfile(workerProfile);

  it('allows worker to access dashboard route', () => {
    expect(canAccessAdminRoute(workerProfile, '/admin/dashboard')).toBe(true);
  });

  it('shows only dashboard and password reset for worker', () => {
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, workerCtx);
    const leafIds = visible
      .flatMap((section) => (section.children || []).map((child) => child.id))
      .sort();
    expect(leafIds).toEqual(['account-reset', 'system-dashboard']);
  });

  it('hides legacy student lookup from nav for admin context', () => {
    const adminCtx = buildNavContextFromAccessProfile(
      buildAccessProfile('', 'admin')
    );
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, adminCtx);
    const analyticsSection = visible.find((s) => s.id === 'analytics');
    const legacyStudent = analyticsSection?.children?.find((c) => c.id === 'analytics-students');
    expect(legacyStudent).toBeUndefined();
  });
});

describe('getDefaultExpandedSectionIds', () => {
  it('expands system and accounts for worker', () => {
    const workerCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'worker'));
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, workerCtx);
    const ids = getDefaultExpandedSectionIds(workerCtx, visible);
    expect(ids.has('system')).toBe(true);
    expect(ids.has('accounts')).toBe(true);
  });

  it('expands events for office staff', () => {
    const ctx = buildNavContextFromAccessProfile(buildAccessProfile('', 'office_staff'));
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, ctx);
    const ids = getDefaultExpandedSectionIds(ctx, visible);
    expect(ids.has('events')).toBe(true);
  });

  it('expands classes for regular teacher', () => {
    const profile = buildAccessProfile('', 'teacher');
    profile.teacherLevel = 'regular';
    const ctx = buildNavContextFromAccessProfile(profile);
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, ctx);
    const ids = getDefaultExpandedSectionIds(ctx, visible);
    expect(ids.has('classes')).toBe(true);
  });
});

describe('getAdminBreadcrumbs', () => {
  it('links nav group to first child path', () => {
    const adminCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));
    const trail = getAdminBreadcrumbs('/admin/operations/participation', adminCtx);
    expect(trail[1]).toEqual({ label: '活動與預約', to: '/admin/operations' });
  });

  it('includes activity list link on event detail', () => {
    const adminCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));
    const trail = getAdminBreadcrumbs('/admin/operations/42', adminCtx);
    expect(trail).toEqual([
      { label: '後台', to: '/admin/dashboard' },
      { label: '活動與預約', to: '/admin/operations' },
      { label: '活動列表', to: '/admin/operations' },
      { label: '活動明細' },
    ]);
  });

  it('points 後台 crumb to leader home', () => {
    const leaderCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'leader'));
    const trail = getAdminBreadcrumbs('/admin/et-grouping/my-sessions', leaderCtx);
    expect(trail[0]).toEqual({ label: '後台', to: '/admin/et-grouping/my-sessions' });
  });
});

describe('filterAdminNavByQuery', () => {
  function visibleLeafLabels(query) {
    const adminCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, adminCtx);
    const filtered = filterAdminNavByQuery(visible, query);
    return filtered.flatMap((section) => {
      if (section.children?.length) return section.children.map((child) => child.label);
      return [section.label];
    });
  }

  it('filters leaves by label', () => {
    const labels = visibleLeafLabels('問卷中心');
    expect(labels.some((label) => label.includes('問卷中心'))).toBe(true);
  });

  it('matches related keywords beyond visible label text', () => {
    expect(visibleLeafLabels('開關')).toContain('系統設定');
  });

  it.each([
    ['黑名單', '合規與違規'],
    ['學號', '英語學習歷程中心'],
    ['待審', '培力英檢管理'],
    ['gate', '啟用規則'],
    ['上傳', '匯入入口'],
    ['回滾', '匯入紀錄'],
    ['跑馬燈', '公告'],
    ['audit', '操作紀錄'],
    ['簽到', '活動列表'],
  ])('maps %s to %s', (query, expectedLabel) => {
    expect(visibleLeafLabels(query)).toContain(expectedLabel);
  });
});
