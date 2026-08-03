/**
 * 後台導覽設定（Phase 2 IA）
 * 權限與舊版 AdminLayout nav-tabs 一致，不擴權。
 *
 * @typedef {{ actualUserRole: string, isTeacher: boolean, hasAdminRights: boolean, canViewReport: boolean, canViewSurvey: boolean }} AdminNavContext
 */

/**
 * visibility 鍵：
 * - all：凡可進後台者（仍會被 filterVisibleNav 依 worker 縮限）
 * - canViewReport：活動與預約（列表／明細）
 * - classes：班級與參與
 * - english：英檢與培力
 * - surveyGroup：問卷側欄群組是否出現
 * - canViewSurvey：問卷管理子項
 * - adminOnly：需 hasAdminRights（admin／executive）
 */
export function isNavItemVisible(visibility, c) {
  // Phase 2：permission-based visibility（以 accessProfile.finalPermissions 為主）
  if (typeof visibility === 'string' && visibility.startsWith('perm:')) {
    const key = visibility.slice('perm:'.length);
    const set = c?.accessProfile?.permissionSet;
    return !!(set && set.has && set.has(key));
  }
  switch (visibility) {
    case 'all':
      return true;
    case 'canViewReport':
      return c.canViewReport;
    case 'classes':
      return c.hasAdminRights || c.isTeacher;
    case 'english':
      return c.hasAdminRights;
    case 'surveyGroup':
      return c.hasAdminRights || c.canViewSurvey;
    case 'canViewSurvey':
      return c.canViewSurvey;
    case 'adminOnly':
      return c.hasAdminRights;
    default:
      return false;
  }
}

/**
 * Worker：舊版僅顯示總覽，側欄只保留「營運總覽」。
 * @param {AdminNavContext} c
 */
export function isWorkerRestrictedMenu(c) {
  return c.actualUserRole === 'worker';
}

/**
 * @typedef {{ id: string, label: string, path: string, matchPrefixes: string[], visibility: string, breadcrumbLabel?: string, pageTitle?: string, hiddenFromNav?: boolean }} AdminNavLeaf
 * @typedef {{ id: string, label: string, visibility: string, expandable?: boolean, children?: AdminNavLeaf[], path?: string, matchPrefixes?: string[], pageTitle?: string, breadcrumbLabel?: string, hiddenFromNav?: boolean }} AdminNavSection
 */

/** @type {AdminNavSection[]} */
export const ADMIN_NAV_SECTIONS = [
  {
    id: 'dashboard',
    label: '營運總覽',
    visibility: 'all',
    path: '/admin/dashboard',
    matchPrefixes: ['/admin/dashboard', '/admin'],
    pageTitle: '營運總覽',
    breadcrumbLabel: '營運總覽',
  },
  {
    id: 'events',
    label: '活動與預約',
    visibility: 'canViewReport',
    expandable: true,
    children: [
      {
        id: 'events-list',
        label: '活動列表',
        path: '/admin/operations',
        matchPrefixes: ['/admin/operations', '/admin/events'],
        visibility: 'canViewReport',
        pageTitle: '活動列表',
        breadcrumbLabel: '活動列表',
      },
      {
        id: 'events-participation-checkins',
        label: '簽到參與統計',
        path: '/admin/operations/participation',
        matchPrefixes: ['/admin/operations/participation'],
        visibility: 'canViewReport',
        pageTitle: '簽到參與統計',
        breadcrumbLabel: '簽到參與統計',
      },
    ],
  },
  {
    id: 'classes',
    label: '班級與參與',
    visibility: 'classes',
    path: '/admin/classes',
    matchPrefixes: ['/admin/classes'],
    pageTitle: '班級參與概況',
    breadcrumbLabel: '班級列表',
  },
  {
    id: 'english',
    label: '英檢與培力',
    visibility: 'english',
    expandable: true,
    children: [
      {
        id: 'english-registration',
        label: '培力英檢管理',
        path: '/admin/english-test',
        matchPrefixes: ['/admin/english-test', '/admin/english-tests'],
        visibility: 'english',
        pageTitle: '培力英檢管理',
        breadcrumbLabel: '培力英檢管理',
      },
      {
        id: 'learning-journey',
        label: '英語學習歷程中心',
        path: '/admin/learning-journey',
        matchPrefixes: [
          '/admin/learning-journey',
          '/admin/learning-journey-center',
        ],
        visibility: 'english',
        pageTitle: '英語學習歷程中心',
        breadcrumbLabel: '英語學習歷程中心',
      },
      {
        id: 'bestep-import',
        label: 'BESTEP 資料匯入',
        path: '/admin/english-test/import',
        matchPrefixes: ['/admin/english-test/import', '/admin/bestep/import'],
        visibility: 'english',
        pageTitle: 'BESTEP 資料匯入',
        breadcrumbLabel: 'BESTEP 資料匯入',
      },
    ],
  },
  {
    id: 'surveys',
    label: '問卷與回饋',
    visibility: 'surveyGroup',
    expandable: true,
    children: [
      {
        id: 'survey-center',
        label: '問卷中心',
        path: '/admin/survey-center',
        matchPrefixes: ['/admin/survey-center'],
        visibility: 'perm:can_view_surveys',
        pageTitle: '問卷中心',
        breadcrumbLabel: '問卷中心',
      },
      {
        id: 'survey-rules-new',
        label: '問卷規則',
        path: '/admin/survey-rules',
        matchPrefixes: ['/admin/survey-rules'],
        visibility: 'perm:can_manage_survey_settings',
        pageTitle: '問卷規則',
        breadcrumbLabel: '問卷規則',
      },
      {
        id: 'survey-health',
        label: '資料健康',
        path: '/admin/survey-health',
        matchPrefixes: ['/admin/survey-health'],
        visibility: 'perm:can_view_surveys',
        pageTitle: 'Survey Data Health',
        breadcrumbLabel: '資料健康',
      },
      {
        id: 'survey-answer-mappings',
        label: '答案映射',
        path: '/admin/survey-answer-mappings',
        matchPrefixes: ['/admin/survey-answer-mappings'],
        visibility: 'perm:can_manage_survey_answer_mapping',
        pageTitle: 'Survey Answer Mapping',
        breadcrumbLabel: '答案映射',
      },
      {
        id: 'survey-manage',
        label: '問卷管理（Legacy）',
        path: '/admin/surveys',
        matchPrefixes: ['/admin/surveys'],
        visibility: 'canViewSurvey',
        pageTitle: '問卷管理（Legacy）',
        breadcrumbLabel: '問卷管理',
        hiddenFromNav: true,
      },
      {
        id: 'survey-product',
        label: '問卷模組',
        path: '/admin/survey-module',
        matchPrefixes: ['/admin/survey-module'],
        visibility: 'perm:can_view_surveys',
        pageTitle: '問卷模組',
        breadcrumbLabel: '問卷模組',
      },
      {
        id: 'survey-settings',
        label: '問卷設定（Legacy）',
        path: '/admin/survey-settings',
        matchPrefixes: ['/admin/survey-settings', '/admin/surveys/settings'],
        visibility: 'adminOnly',
        pageTitle: '問卷設定（Legacy）',
        breadcrumbLabel: '問卷設定',
        hiddenFromNav: true,
      },
    ],
  },
  {
    id: 'compliance',
    label: '合規與違規',
    visibility: 'adminOnly',
    path: '/admin/violations',
    matchPrefixes: ['/admin/violations'],
    pageTitle: '違規管理',
    breadcrumbLabel: '違規管理',
  },
  {
    id: 'analytics',
    label: '分析與報表',
    visibility: 'perm:can_view_analytics',
    expandable: true,
    children: [
      {
        id: 'analytics-students',
        label: '學習歷程',
        path: '/admin/analytics/students',
        matchPrefixes: ['/admin/analytics/students', '/admin/analytics/student/'],
        visibility: 'adminOnly',
        pageTitle: '學習歷程',
        breadcrumbLabel: '學習歷程',
      },
      {
        id: 'analytics-overview',
        label: '行政總覽',
        path: '/admin/analytics/overview',
        matchPrefixes: ['/admin/analytics/overview'],
        visibility: 'adminOnly',
        pageTitle: '行政總覽',
        breadcrumbLabel: '行政總覽',
      },
      {
        id: 'analytics-risk',
        label: '高風險預警',
        path: '/admin/analytics/risk',
        matchPrefixes: ['/admin/analytics/risk'],
        visibility: 'adminOnly',
        pageTitle: '高風險預警',
        breadcrumbLabel: '高風險預警',
      },
      {
        id: 'analytics-trends',
        label: '趨勢分析',
        path: '/admin/analytics/trends',
        matchPrefixes: ['/admin/analytics/trends'],
        visibility: 'adminOnly',
        pageTitle: '趨勢分析',
        breadcrumbLabel: '趨勢分析',
      },
      {
        id: 'analytics-reports',
        label: '報表下載',
        path: '/admin/reports',
        matchPrefixes: ['/admin/reports'],
        visibility: 'perm:can_export_reports',
        pageTitle: '報表下載',
        breadcrumbLabel: '報表下載',
      },
      {
        id: 'analytics-teacher-dash',
        label: '教師總覽',
        path: '/admin/teachers/dashboard',
        matchPrefixes: ['/admin/teachers/dashboard'],
        visibility: 'adminOnly',
        pageTitle: '教師總覽',
        breadcrumbLabel: '教師總覽',
      },
      {
        id: 'analytics-teacher-impact',
        label: '教師影響力指標',
        path: '/admin/analytics/teacher-impact',
        matchPrefixes: ['/admin/analytics/teacher-impact'],
        visibility: 'adminOnly',
        pageTitle: '教師影響力指標',
        breadcrumbLabel: '教師影響力指標',
      },
    ],
  },
  {
    id: 'announcements',
    label: '公告',
    visibility: 'perm:can_manage_announcements',
    path: '/admin/announcements',
    matchPrefixes: ['/admin/announcements'],
    pageTitle: '公告管理',
    breadcrumbLabel: '公告管理',
  },
  {
    id: 'weekly-reports',
    label: '英語中心週報',
    visibility: 'adminOnly',
    path: '/admin/weekly-reports',
    matchPrefixes: ['/admin/weekly-reports'],
    pageTitle: '英語中心週報',
    breadcrumbLabel: '英語中心週報',
  },
  {
    id: 'accounts',
    label: '帳號與權限',
    visibility: 'perm:can_manage_accounts',
    expandable: true,
    children: [
      {
        id: 'account-list',
        label: '帳號管理',
        path: '/admin/account',
        matchPrefixes: ['/admin/account', '/admin/accounts'],
        visibility: 'perm:can_manage_accounts',
        pageTitle: '帳號管理',
        breadcrumbLabel: '帳號管理',
      },
      {
        id: 'account-reset',
        label: '變更密碼',
        path: '/admin/account/reset',
        matchPrefixes: ['/admin/account/reset'],
        visibility: 'all',
        pageTitle: '變更密碼',
        breadcrumbLabel: '變更密碼',
      },
    ],
  },
  {
    id: 'system',
    label: '系統與稽核',
    visibility: 'perm:can_manage_settings',
    expandable: true,
    children: [
      {
        id: 'system-settings',
        label: '系統設定',
        path: '/admin/settings/system',
        matchPrefixes: ['/admin/settings/system', '/admin/system/settings'],
        visibility: 'perm:can_manage_settings',
        pageTitle: '系統設定',
        breadcrumbLabel: '系統設定',
      },
      {
        id: 'system-logs',
        label: '操作紀錄',
        path: '/admin/logs',
        matchPrefixes: ['/admin/logs'],
        visibility: 'perm:can_view_audit_logs',
        pageTitle: '操作紀錄',
        breadcrumbLabel: '操作紀錄',
      },
      {
        id: 'system-diagnostics',
        label: '系統診斷',
        path: '/admin/diagnostics',
        matchPrefixes: ['/admin/diagnostics'],
        visibility: 'perm:can_view_internal_diagnostics',
        pageTitle: '系統診斷',
        breadcrumbLabel: '系統診斷',
      },
    ],
  },
];

/** 將 section 轉成可迭代葉節（含群組資訊） */
function flattenLeaves(sections) {
  /** @type {{ section: AdminNavSection, leaf: AdminNavLeaf }[]} */
  const out = [];
  for (const section of sections) {
    if (section.children?.length) {
      for (const leaf of section.children) {
        out.push({ section, leaf });
      }
    } else if (section.path) {
      out.push({
        section,
        leaf: {
          id: section.id,
          label: section.label,
          path: section.path,
          matchPrefixes: section.matchPrefixes || [section.path],
          visibility: section.visibility,
          pageTitle: section.pageTitle,
          breadcrumbLabel: section.breadcrumbLabel,
        },
      });
    }
  }
  return out;
}

/**
 * 最長前綴匹配 pathname（用於 breadcrumb / 標題 / active）
 * @param {string} pathname
 * @param {string[]} prefixes
 */
function bestPrefixLength(pathname, prefixes) {
  let best = 0;
  for (const p of prefixes) {
    if (pathname === p || pathname.startsWith(`${p}/`)) {
      best = Math.max(best, p.length);
    }
  }
  return best;
}

/**
 * @param {string} pathname
 * @param {AdminNavContext} ctx
 */
export function getAdminPageMeta(pathname, ctx) {
  const filtered = filterVisibleNav(ADMIN_NAV_SECTIONS, ctx);

  // 活動列表／簽到參與統計／活動明細（Phase 3）
  if (pathname === '/admin/operations' || pathname === '/admin/events') {
    const ev = filtered.find((s) => s.id === 'events');
    if (ev) {
      return {
        groupLabel: ev.label,
        pageTitle: '活動列表',
        breadcrumbLeaf: '活動列表',
        sectionId: 'events',
        childId: 'events-list',
      };
    }
  }
  if (pathname === '/admin/operations/participation') {
    const ev = filtered.find((s) => s.id === 'events');
    if (ev) {
      return {
        groupLabel: ev.label,
        pageTitle: '簽到參與統計',
        breadcrumbLeaf: '簽到參與統計',
        sectionId: 'events',
        childId: 'events-participation-checkins',
      };
    }
  }
  if (pathname.match(/^\/admin\/operations\/\d+$/)) {
    const ev = filtered.find((s) => s.id === 'events');
    if (ev) {
      return {
        groupLabel: ev.label,
        pageTitle: '活動明細',
        breadcrumbLeaf: '活動明細',
        sectionId: 'events',
        childId: 'event-detail',
      };
    }
  }

  // 班級動態路由（優先於一般前綴匹配）
  if (pathname.startsWith('/admin/survey-module')) {
    const sur = filtered.find((s) => s.id === 'surveys');
    if (sur) {
      return {
        groupLabel: sur.label,
        pageTitle: pathname.includes('/responses')
          ? '問卷作答'
          : pathname.includes('/stats')
            ? '問卷統計'
            : '問卷模組',
        breadcrumbLeaf: pathname.includes('/responses')
          ? '作答資料'
          : pathname.includes('/stats')
            ? '統計'
            : '問卷模組',
        sectionId: 'surveys',
        childId: 'survey-product',
      };
    }
  }

  if (pathname.startsWith('/admin/classes')) {
    const classesSection = filtered.find((s) => s.id === 'classes');
    if (classesSection) {
      const groupLabel = classesSection.label;
      if (pathname.includes('/bestep')) {
        return {
          groupLabel,
          pageTitle: 'BESTEP',
          breadcrumbLeaf: 'BESTEP',
          sectionId: 'classes',
          childId: 'classes-bestep',
        };
      }
      if (pathname.match(/^\/admin\/classes\/[^/]+$/)) {
        return {
          groupLabel,
          pageTitle: '班級明細',
          breadcrumbLeaf: '班級明細',
          sectionId: 'classes',
          childId: 'classes-detail',
        };
      }
      if (pathname === '/admin/classes') {
        return {
          groupLabel,
          pageTitle: classesSection.pageTitle || '班級參與概況',
          breadcrumbLeaf: classesSection.breadcrumbLabel || '班級列表',
          sectionId: 'classes',
          childId: 'classes',
        };
      }
    }
  }

  const pairs = flattenLeaves(filtered);
  let bestScore = -1;
  /** @type {{ section: AdminNavSection, leaf: AdminNavLeaf } | null} */
  let best = null;

  for (const pair of pairs) {
    const prefs = pair.leaf.matchPrefixes || [pair.leaf.path];
    const len = bestPrefixLength(pathname, prefs);
    if (len > bestScore) {
      bestScore = len;
      best = pair;
    }
  }

  if (!best || bestScore <= 0) {
    return {
      groupLabel: '後台',
      pageTitle: '後台',
      breadcrumbLeaf: pathname.replace(/^\/admin\/?/, '') || '總覽',
      sectionId: null,
      childId: null,
    };
  }

  // 學生 profile
  let breadcrumbLeaf = best.leaf.breadcrumbLabel || best.leaf.label;
  let pageTitle = best.leaf.pageTitle || best.leaf.label;
  if (pathname.startsWith('/admin/analytics/student/')) {
    breadcrumbLeaf = '學生學習歷程';
    pageTitle = '學生學習歷程';
  }

  if (pathname === '/admin' || pathname === '/admin/dashboard') {
    breadcrumbLeaf = '總覽';
    pageTitle = '營運總覽';
  }

  return {
    groupLabel: best.section.label,
    pageTitle,
    breadcrumbLeaf,
    sectionId: best.section.id,
    childId: best.leaf.id,
  };
}

/**
 * @param {AdminNavSection[]} sections
 * @param {AdminNavContext} c
 * @returns {AdminNavSection[]}
 */
export function filterVisibleNav(sections, c) {
  const workerOnly = isWorkerRestrictedMenu(c);
  return sections
    .map((section) => {
      if (workerOnly && section.id !== 'dashboard') {
        return null;
      }
      if (!isNavItemVisible(section.visibility, c)) {
        return null;
      }
      if (section.children?.length) {
        const children = section.children.filter((ch) => !ch.hiddenFromNav && isNavItemVisible(ch.visibility, c));
        if (children.length === 0) {
          return null;
        }
        return { ...section, children };
      }
      return { ...section };
    })
    .filter(Boolean);
}

/**
 * @param {string} pathname
 * @param {AdminNavContext} ctx
 * @returns {{ label: string, to?: string }[]}
 */
export function getAdminBreadcrumbs(pathname, ctx) {
  const meta = getAdminPageMeta(pathname, ctx);
  const trail = [{ label: '後台', to: '/admin' }];
  if (meta.groupLabel && meta.groupLabel !== '後台') {
    trail.push({ label: meta.groupLabel });
  }
  trail.push({ label: meta.breadcrumbLeaf || meta.pageTitle });
  return trail;
}

/**
 * @param {string} pathname
 * @param {AdminNavContext} ctx
 */
export function getAdminPageTitle(pathname, ctx) {
  return getAdminPageMeta(pathname, ctx).pageTitle;
}

/**
 * Sidebar active：展開區段與作用中子項
 * @param {string} pathname
 * @param {AdminNavContext} ctx
 */
export function getSidebarActiveState(pathname, ctx) {
  const meta = getAdminPageMeta(pathname, ctx);
  return {
    sectionId: meta.sectionId,
    childId: meta.childId,
  };
}

/**
 * 側欄單層連結（無 children）是否為目前作用中
 * @param {{ sectionId: string|null, childId: string|null }} active
 * @param {string} sectionId
 */
export function isSidebarSingleSectionActive(active, sectionId) {
  return active.sectionId === sectionId;
}

/**
 * 側欄子連結是否為目前作用中
 * @param {{ sectionId: string|null, childId: string|null }} active
 * @param {string} sectionId
 * @param {string} leafId
 */
export function isSidebarChildActive(active, sectionId, leafId) {
  return active.sectionId === sectionId && active.childId === leafId;
}
