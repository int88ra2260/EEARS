import {
  ADMIN_NAV_SECTIONS,
  filterAdminNavByQuery,
  filterVisibleNav,
  getAdminBreadcrumbs,
  getAdminPageMeta,
  isFinderWorkspace,
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

  it('returns role home by workerLevel', () => {
    expect(getAdminRoleHomePath({ role: 'worker', workerLevel: 'event_ops' })).toBe('/admin/operations');
    expect(getAdminRoleHomePath({ role: 'worker', workerLevel: 'content_editor' })).toBe('/admin/announcements');
    expect(getAdminRoleHomePath({ role: 'worker', workerLevel: 'bestep_ops' })).toBe('/admin/english-tests');
    expect(getAdminRoleHomePath({ role: 'worker', workerLevel: 'passport_ops' })).toBe('/admin/english-learning-passports');
  });

  it('returns dashboard for admin', () => {
    expect(getAdminRoleHomePath({ role: 'admin' })).toBe('/admin/dashboard');
  });
});

function staffToken(staffLevel) {
  const payload = Buffer.from(JSON.stringify({
    role: 'office_staff',
    staffLevel,
  })).toString('base64url');
  return `e30.${payload}.sig`;
}

describe('class credit allocation nav', () => {
  function visibleIds(token) {
    const profile = buildAccessProfile(token, 'office_staff');
    const ctx = buildNavContextFromAccessProfile(profile);
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, ctx);
    const section = visible.find((item) => item.id === 'classes');
    return (section?.children || []).map((child) => child.id);
  }

  it('shows allocation to deputy manager and event lead, not class overview', () => {
    expect(visibleIds(staffToken('deputy_manager'))).toContain('class-credit-allocation');
    expect(visibleIds(staffToken('deputy_manager'))).not.toContain('classes-overview');
    expect(visibleIds(staffToken('event_lead'))).toContain('class-credit-allocation');
    expect(canAccessAdminRoute(
      buildAccessProfile(staffToken('event_lead'), 'office_staff'),
      '/admin/classes/credit-allocation',
    )).toBe(true);
    expect(canAccessAdminRoute(
      buildAccessProfile(staffToken('bestep_lead'), 'office_staff'),
      '/admin/classes/credit-allocation',
    )).toBe(false);
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

describe('filterVisibleNav worker by workerLevel', () => {
  it('event_ops worker only sees events-list', () => {
    const workerProfile = buildAccessProfile('', 'worker');
    expect(workerProfile.workerLevel).toBe('event_ops');
    expect(canAccessAdminRoute(workerProfile, '/admin/operations')).toBe(true);
    expect(canAccessAdminRoute(workerProfile, '/admin/account/reset')).toBe(false);
    expect(canAccessAdminRoute(workerProfile, '/admin/announcements')).toBe(false);
    expect(workerProfile.permissionSet.has('can_manage_events')).toBe(false);
    expect(workerProfile.permissionSet.has('can_checkin_students')).toBe(true);
    expect(workerProfile.permissionSet.has('can_view_reservations')).toBe(true);

    const workerCtx = buildNavContextFromAccessProfile(workerProfile);
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, workerCtx);
    const sectionIds = visible.map((section) => section.id);
    expect(sectionIds).toEqual(['events']);
    expect(sectionIds).not.toContain('accounts');
    expect(sectionIds).not.toContain('announcements');
    expect(sectionIds).not.toContain('import-center');
    expect(sectionIds).not.toContain('system');

    const eventChildren = visible.find((s) => s.id === 'events')?.children?.map((c) => c.id) || [];
    expect(eventChildren).toEqual(['events-list']);
  });

  it('content_editor worker sees announcement routes', () => {
    const tokenPayload = Buffer.from(JSON.stringify({
      role: 'worker',
      workerLevel: 'content_editor',
    })).toString('base64');
    const fakeToken = `hdr.${tokenPayload}.sig`;
    const profile = buildAccessProfile(fakeToken, 'worker');
    expect(profile.workerLevel).toBe('content_editor');
    expect(canAccessAdminRoute(profile, '/admin/announcements')).toBe(true);
    expect(canAccessAdminRoute(profile, '/admin/operations')).toBe(false);
  });
});

describe('ADMIN_NAV_SECTIONS learning IA', () => {
  it('keeps exam admin separate from learning outcome surfaces', () => {
    const englishSection = ADMIN_NAV_SECTIONS.find((section) => section.id === 'english');
    const learningOutcomesSection = ADMIN_NAV_SECTIONS.find((section) => section.id === 'learning-outcomes');

    expect(englishSection?.children?.map((child) => child.id)).toContain('english-registration');
    expect(englishSection?.children?.map((child) => child.id)).not.toContain('english-learning-passport');
    expect(englishSection?.children?.map((child) => child.id)).not.toContain('learning-journey');

    expect(learningOutcomesSection?.label).toBe('學習歷程與成果');
    const learningLeafIds = [];
    const walk = (nodes) => {
      for (const node of nodes || []) {
        if (node.children?.length && !node.path) walk(node.children);
        else learningLeafIds.push(node.id);
      }
    };
    walk(learningOutcomesSection?.children);
    expect(learningLeafIds).toEqual(
      expect.arrayContaining([
        'english-learning-passport',
        'learning-journey',
        'learning-analytics-overview',
        'la-people',
      ])
    );
    expect(learningOutcomesSection?.children?.find((child) => child.id === 'learning-analytics')).toBeUndefined();
    expect(learningOutcomesSection?.children?.find((child) => child.id === 'la-people')).toMatchObject({
      label: '找學生',
      path: '/admin/learning-analytics/explore',
    });
    expect(learningOutcomesSection?.children?.filter((child) => child.hiddenFromNav).map((child) => child.id)).toEqual(
      expect.arrayContaining([
        'learning-analytics-kpi-report',
        'learning-analytics-resources',
        'learning-analytics-cohorts',
        'learning-analytics-raw',
        'learning-analytics-settings',
      ])
    );
    expect(ADMIN_NAV_SECTIONS.map((section) => section.id)).not.toContain('learning-analytics');
  });
});

describe('資源與開課 sidebar entry', () => {
  const ctx = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));

  function visibleLabels(nodes, labels = []) {
    for (const node of nodes || []) {
      if (node.children?.length && !node.path) visibleLabels(node.children, labels);
      else labels.push(node.label);
    }
    return labels;
  }

  it('keeps one entry and both old urls', () => {
    const labels = visibleLabels(filterVisibleNav(ADMIN_NAV_SECTIONS, ctx));
    expect(labels.filter((label) => label === '資源與開課')).toEqual([]);
    expect(labels.filter((label) => ['資源覆蓋', '課／師／活動'].includes(label))).toEqual([]);
    expect(getAdminPageMeta('/admin/learning-analytics/resources', ctx)).toMatchObject({
      pageTitle: '資源與開課',
      childId: 'learning-analytics-resources',
    });
    expect(getAdminPageMeta('/admin/learning-analytics/offerings', ctx)).toMatchObject({
      pageTitle: '資源與開課',
      childId: 'learning-analytics-resources',
    });
  });
});

describe('群體與技能比較 sidebar entry', () => {
  const ctx = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));

  function visibleLabels(nodes, labels = []) {
    for (const node of nodes || []) {
      if (node.children?.length && !node.path) visibleLabels(node.children, labels);
      else labels.push(node.label);
    }
    return labels;
  }

  it('keeps one entry and both old urls', () => {
    const labels = visibleLabels(filterVisibleNav(ADMIN_NAV_SECTIONS, ctx));
    expect(labels.filter((label) => label === '群體與技能比較')).toEqual([]);
    expect(labels.filter((label) => ['系所比較', '技能成長'].includes(label))).toEqual([]);
    expect(getAdminPageMeta('/admin/learning-analytics/cohorts', ctx)).toMatchObject({
      pageTitle: '群體與技能比較',
      childId: 'learning-analytics-cohorts',
    });
    expect(getAdminPageMeta('/admin/learning-analytics/skills', ctx)).toMatchObject({
      pageTitle: '群體與技能比較',
      childId: 'learning-analytics-cohorts',
    });
  });
});

describe('找學生 sidebar entry', () => {
  const ctx = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));

  function visibleLabels(nodes, labels = []) {
    for (const node of nodes || []) {
      if (node.children?.length && !node.path) visibleLabels(node.children, labels);
      else labels.push(node.label);
    }
    return labels;
  }

  it('keeps one visible entry and the old page titles', () => {
    const labels = visibleLabels(filterVisibleNav(ADMIN_NAV_SECTIONS, ctx));
    expect(labels.filter((label) => label === '找學生')).toEqual(['找學生']);
    expect(labels.filter((label) => ['學生探索', '接近 B2', '追蹤名單', '個人軌跡'].includes(label))).toEqual([]);

    expect(isFinderWorkspace('/admin/learning-analytics/explore')).toBe(true);
    expect(isFinderWorkspace('/admin/learning-analytics/students/S100')).toBe(true);
    expect(isFinderWorkspace('/admin/learning-analytics/overview')).toBe(false);
    expect(getAdminPageMeta('/admin/learning-analytics/explore', ctx)).toMatchObject({
      pageTitle: '學生探索',
      childId: 'la-people',
      sectionId: 'learning-outcomes',
    });
    expect(getAdminPageMeta('/admin/learning-analytics/b1-plus', ctx)).toMatchObject({
      pageTitle: '接近 B2',
      childId: 'la-people',
    });
    expect(getAdminPageMeta('/admin/learning-analytics/tracking-cohorts/c1', ctx)).toMatchObject({
      pageTitle: '追蹤名單',
      childId: 'la-people',
    });
    expect(getAdminPageMeta('/admin/learning-analytics/students/S100', ctx)).toMatchObject({
      pageTitle: '學生個人學習軌跡',
      childId: 'la-people',
    });
  });
});

describe('getDefaultExpandedSectionIds', () => {
  it('expands events for event_ops worker (no accounts)', () => {
    const workerCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'worker'));
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, workerCtx);
    const ids = getDefaultExpandedSectionIds(workerCtx, visible);
    expect(ids.has('events')).toBe(true);
    expect(ids.has('accounts')).toBe(false);
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

  it('expands only daily events for admin', () => {
    const ctx = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, ctx);
    const ids = getDefaultExpandedSectionIds(ctx, visible);
    expect([...ids]).toEqual(['events']);
  });

  it('expands learning outcomes for passport_ops worker', () => {
    const tokenPayload = Buffer.from(JSON.stringify({
      role: 'worker',
      workerLevel: 'passport_ops',
    })).toString('base64');
    const fakeToken = `hdr.${tokenPayload}.sig`;
    const ctx = buildNavContextFromAccessProfile(buildAccessProfile(fakeToken, 'worker'));
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, ctx);
    const ids = getDefaultExpandedSectionIds(ctx, visible);
    expect(ids.has('learning-outcomes')).toBe(true);
    expect(ids.has('english')).toBe(false);
    const profile = ctx.accessProfile;
    expect(profile.permissionSet.has('can_review_english_learning_submissions')).toBe(true);
    expect(profile.permissionSet.has('can_view_english_learning_passports')).toBe(false);
    expect(canAccessAdminRoute(profile, '/admin/english-learning-passports')).toBe(true);
    expect(canAccessAdminRoute(profile, '/admin/english-learning-passports/1')).toBe(false);
    const childIds = visible.find((section) => section.id === 'learning-outcomes')?.children?.map((child) => child.id);
    expect(childIds).toContain('english-learning-passport');
  });
});

describe('getAdminBreadcrumbs', () => {
  it('links nav group to first child path', () => {
    const adminCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));
    const trail = getAdminBreadcrumbs('/admin/operations/participation', adminCtx);
    expect(trail[1]).toEqual({ label: '活動與預約', to: '/admin/operations' });
  });

  it('places the activity operations overview under events', () => {
    const adminCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));
    const events = filterVisibleNav(ADMIN_NAV_SECTIONS, adminCtx).find((section) => section.id === 'events');
    const childIds = events?.children?.map((child) => child.id) || [];
    expect(childIds.indexOf('analytics-overview')).toBeGreaterThan(childIds.indexOf('events-participation-checkins'));
    expect(getAdminBreadcrumbs('/admin/analytics/overview', adminCtx).map((item) => item.label)).toEqual([
      '後台',
      '活動與預約',
      '活動營運總覽',
    ]);
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

  it('includes the nested group on learning analytics pages', () => {
    const adminCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));
    const trail = getAdminBreadcrumbs('/admin/learning-analytics/cohorts', adminCtx);
    expect(trail.map((item) => item.label)).toEqual([
      '後台',
      '學習歷程與成果',
      '群體與技能比較',
    ]);
  });

  it('hides the events-list hint when that page is not in the menu', () => {
    const leaderCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'leader'));
    const leaderEvents = filterVisibleNav(ADMIN_NAV_SECTIONS, leaderCtx).find((section) => section.id === 'events');
    expect(leaderEvents?.hint).toBeUndefined();

    const adminCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));
    const adminEvents = filterVisibleNav(ADMIN_NAV_SECTIONS, adminCtx).find((section) => section.id === 'events');
    expect(adminEvents?.hint).toMatch(/活動列表/);
  });

  it('points 後台 crumb to leader home', () => {
    const leaderCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'leader'));
    const trail = getAdminBreadcrumbs('/admin/et-grouping/my-sessions', leaderCtx);
    expect(trail[0]).toEqual({ label: '後台', to: '/admin/et-grouping/my-sessions' });
    const leaderLabels = [];
    const walk = (nodes) => {
      (nodes || []).forEach((node) => {
        if (node.children?.length && !node.path) walk(node.children);
        else leaderLabels.push(node.label);
      });
    };
    walk(filterVisibleNav(ADMIN_NAV_SECTIONS, leaderCtx));
    expect(leaderLabels).toContain('我的帶班場次');
  });

  it('keeps the agreed labels for a full-permission admin', () => {
    const labels = [];
    const walk = (nodes) => {
      (nodes || []).forEach((node) => {
        if (node.children?.length && !node.path) walk(node.children);
        else labels.push(node.label);
      });
    };
    walk(filterVisibleNav(ADMIN_NAV_SECTIONS, buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'))));
    expect(labels).toEqual([
      '活動列表',
      '簽到參與統計',
      '活動營運總覽',
      '營運報表下載',
      '合規與違規',
      'ET 分組設定',
      'ET 場次報表',
      '班級參與概況',
      '活動時數分配',
      '高關注名單',
      '培力英檢管理',
      '英語實踐歷程護照',
      '英語學習歷程中心',
      'ESAP 口說診斷',
      '學習成效概況',
      '找學生',
      '問卷中心（建立／發布）',
      '啟用規則',
      '作答紀錄',
      '統計分析',
      '匯入入口',
      '匯入紀錄',
      '公告',
      '學生回報',
      '英語中心週報',
      '學生端內容',
      '帳號管理',
      '變更密碼',
      '系統設定',
      '操作紀錄',
      '維運',
      '旅遊分帳',
    ]);
    expect(labels).not.toContain('我的教學儀表板');
    const teacherLabels = [];
    const walkTeacher = (nodes) => {
      (nodes || []).forEach((node) => {
        if (node.children?.length && !node.path) walkTeacher(node.children);
        else teacherLabels.push(node.label);
      });
    };
    walkTeacher(filterVisibleNav(
      ADMIN_NAV_SECTIONS,
      buildNavContextFromAccessProfile(buildAccessProfile('', 'teacher')),
    ));
    expect(teacherLabels).toContain('我的教學儀表板');
  });

  it('shows the public leaders editor to ET managers and content editors', () => {
    const tokenFor = (payload) => {
      const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return `e30.${body}.sig`;
    };
    const leafIds = (profile) => {
      const ids = [];
      const walk = (nodes) => {
        (nodes || []).forEach((node) => {
          ids.push(node.id);
          walk(node.children);
        });
      };
      walk(filterVisibleNav(ADMIN_NAV_SECTIONS, buildNavContextFromAccessProfile(profile)));
      return ids;
    };

    const etManager = buildAccessProfile(
      tokenFor({ role: 'teacher', teacherLevel: 'et_manager' }),
      'teacher',
    );
    const editor = buildAccessProfile(
      tokenFor({ role: 'worker', workerLevel: 'content_editor' }),
      'worker',
    );
    const leader = buildAccessProfile('', 'leader');

    expect(leafIds(etManager)).not.toContain('et-leader-public-profiles');
    expect(leafIds(editor)).not.toContain('et-leader-public-profiles');
    expect(leafIds(leader)).not.toContain('et-leader-public-profiles');
    expect(canAccessAdminRoute(etManager, '/admin/leaders-team')).toBe(true);
    expect(canAccessAdminRoute(editor, '/admin/leaders-team')).toBe(true);
    expect(canAccessAdminRoute(leader, '/admin/leaders-team')).toBe(false);
  });
});

describe('filterAdminNavByQuery', () => {
  function visibleLeafLabels(query) {
    const adminCtx = buildNavContextFromAccessProfile(buildAccessProfile('', 'admin'));
    const visible = filterVisibleNav(ADMIN_NAV_SECTIONS, adminCtx);
    const filtered = filterAdminNavByQuery(visible, query);
    const labels = [];
    const walk = (nodes) => {
      for (const node of nodes || []) {
        if (node.children?.length && !node.path) walk(node.children);
        else labels.push(node.label);
      }
    };
    walk(filtered);
    return labels;
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
