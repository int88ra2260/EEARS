/**
 * 後台導覽設定（Phase 2 IA）
 * 權限與舊版 AdminLayout nav-tabs 一致，不擴權。
 *
 * 側欄排序原則：日常營運 → 英檢／問卷 → 資料匯入 → 分析報表 → 合規／公告 → 帳號 → 系統（含營運總覽）
 *
 * @typedef {{ actualUserRole: string, isTeacher: boolean, hasAdminRights: boolean, canViewReport: boolean, canViewSurvey: boolean, accessProfile?: object }} AdminNavContext
 */

import { P } from './permissions';
import { canAccessAdminRoute } from './adminRouteAccess';
import { isDeputyManagerProfile, isEventLeadProfile, isEtManagerProfile, isJtManagerProfile, isOfficeStaffOpsDenied, canAccessWeeklyReports } from '../utils/accessControl';

function canAccessImportCenter(c) {
  if (
    isDeputyManagerProfile(c?.accessProfile)
    || isEventLeadProfile(c?.accessProfile)
    || isEtManagerProfile(c?.accessProfile)
    || isJtManagerProfile(c?.accessProfile)
  ) {
    return false;
  }
  return canAccessAdminRoute(c?.accessProfile, '/admin/import-center');
}

/**
 * visibility 鍵：
 * - all：凡可進後台者（仍會被 filterVisibleNav 依 worker 縮限）
 * - canViewReport：活動與預約（列表／明細）
 * - classes：班級與參與
 * - english：英檢與培力
 * - surveyGroup：問卷側欄群組是否出現
 * - canViewSurvey：問卷管理子項
 * - adminOnly：需 hasAdminRights（admin／executive）
 * - opsDashboard：營運總覽（非一般授課老師）
 * - teachingImpactTrends：教學綜合趨勢（admin／executive／活動負責人）
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
    case 'classes': {
      const set = c?.accessProfile?.permissionSet;
      const canClass =
        !!(set && set.has && (set.has(P.CAN_VIEW_CLASSES) || set.has(P.CAN_MANAGE_CLASSES)));
      return c.hasAdminRights || c.isTeacher || canClass;
    }
    case 'english': {
      const set = c?.accessProfile?.permissionSet;
      const canEnglish =
        !!(set && set.has && (
          set.has(P.CAN_VIEW_ENGLISH_TEST_METRICS) ||
          set.has(P.CAN_VIEW_ENGLISH_TESTS) ||
          set.has(P.CAN_VIEW_ENGLISH_TEST_TRACKING) ||
          set.has(P.CAN_MANAGE_ENGLISH_TEST_TRACKING) ||
          set.has(P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS) ||
          set.has(P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS) ||
          set.has(P.CAN_MANAGE_LEARNING_PARTNER_ADMIN)
        ));
      return c.hasAdminRights || canEnglish;
    }
    case 'englishLearningJourney': {
      if (isDeputyManagerProfile(c?.accessProfile)) return false;
      const set = c?.accessProfile?.permissionSet;
      const canLj =
        !!(set && set.has && (
          set.has(P.CAN_VIEW_ENGLISH_TEST_TRACKING) ||
          set.has(P.CAN_MANAGE_ENGLISH_TEST_TRACKING)
        ));
      return c.hasAdminRights || canLj;
    }
    case 'surveyGroup':
      return c.hasAdminRights || c.canViewSurvey;
    case 'canViewSurvey':
      return c.canViewSurvey;
    case 'adminOnly':
      return c.hasAdminRights;
    case 'importCenter':
      return canAccessImportCenter(c);
    case 'opsDashboard':
      if (isDeputyManagerProfile(c?.accessProfile) || isOfficeStaffOpsDenied(c?.accessProfile)) return false;
      if (c.actualUserRole === 'teacher' && !c.hasAdminRights) return false;
      return true;
    case 'teachingImpactTrends': {
      if (c.hasAdminRights) return true;
      const level = c?.accessProfile?.teacherLevel;
      return (
        c.isTeacher &&
        (level === 'et_manager' || level === 'if_manager' || level === 'jt_manager') &&
        c?.accessProfile?.permissionSet?.has?.(P.CAN_VIEW_ANALYTICS)
      );
    }
    case 'weeklyReports':
      return canAccessWeeklyReports(c?.accessProfile);
    case 'accountNav':
      if (c?.accessProfile?.permissionSet?.has(P.CAN_MANAGE_ACCOUNTS)) return true;
      return !!c?.accessProfile?.role;
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

export function canShowAdminNavItem(item, c) {
  if (item?.hiddenFromNav) return false;
  if (item?.visibility && !isNavItemVisible(item.visibility, c)) return false;
  if (item?.path && !canAccessAdminRoute(c?.accessProfile, item.path)) return false;
  return true;
}

/**
 * @typedef {{ id: string, label: string, path: string, matchPrefixes: string[], visibility: string, breadcrumbLabel?: string, pageTitle?: string, hiddenFromNav?: boolean }} AdminNavLeaf
 * @typedef {{ id: string, label: string, visibility: string, expandable?: boolean, children?: AdminNavLeaf[], path?: string, matchPrefixes?: string[], pageTitle?: string, breadcrumbLabel?: string, hiddenFromNav?: boolean }} AdminNavSection
 */

/** @type {AdminNavSection[]} */
export const ADMIN_NAV_SECTIONS = [
  {
    id: 'events',
    label: '活動與預約',
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
      {
        id: 'et-grouping-settings',
        label: 'ET 分組設定',
        path: '/admin/et-grouping/settings',
        matchPrefixes: ['/admin/et-grouping/settings'],
        visibility: 'perm:can_manage_et_grouping',
        pageTitle: 'ET 分組設定',
        breadcrumbLabel: 'ET 分組設定',
      },
      {
        id: 'et-task-templates',
        label: 'ET 任務模板',
        path: '/admin/et-grouping/tasks',
        matchPrefixes: ['/admin/et-grouping/tasks'],
        visibility: 'perm:can_manage_et_grouping',
        pageTitle: 'ET 任務模板',
        breadcrumbLabel: 'ET 任務模板',
      },
      {
        id: 'et-grouping-reports',
        label: 'ET 場次報表',
        path: '/admin/et-grouping/reports',
        matchPrefixes: ['/admin/et-grouping/reports'],
        visibility: 'perm:can_view_et_grouping',
        pageTitle: 'ET 場次報表彙總',
        breadcrumbLabel: 'ET 場次報表',
      },
      {
        id: 'et-student-trends',
        label: 'ET 學生趨勢',
        path: '/admin/et-grouping/student-trends',
        matchPrefixes: ['/admin/et-grouping/student-trends'],
        visibility: 'perm:can_view_et_grouping',
        pageTitle: 'ET 學生學期趨勢',
        breadcrumbLabel: 'ET 學生趨勢',
      },
      {
        id: 'et-leader-sessions',
        label: '我的帶班場次',
        path: '/admin/et-grouping/my-sessions',
        matchPrefixes: ['/admin/et-grouping/my-sessions'],
        visibility: 'perm:can_mark_et_session_tasks',
        pageTitle: '我的帶班場次',
        breadcrumbLabel: '我的帶班場次',
      },
      {
        id: 'events-compliance',
        label: '合規與違規',
        path: '/admin/violations',
        matchPrefixes: ['/admin/violations'],
        visibility: 'perm:can_manage_violations',
        pageTitle: '違規管理',
        breadcrumbLabel: '合規與違規',
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
        id: 'english-learning-passport',
        label: '英語實踐歷程護照',
        path: '/admin/english-learning-passports',
        matchPrefixes: ['/admin/english-learning-passports'],
        visibility: 'perm:can_view_english_learning_passports',
        pageTitle: '英語實踐歷程護照',
        breadcrumbLabel: '英語實踐歷程護照',
      },
      {
        id: 'english-registration',
        label: '培力英檢管理',
        path: '/admin/english-test',
        matchPrefixes: ['/admin/english-test', '/admin/english-tests'],
        visibility: 'perm:can_view_english_tests',
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
        visibility: 'englishLearningJourney',
        pageTitle: '英語學習歷程中心',
        breadcrumbLabel: '英語學習歷程中心',
      },
      {
        id: 'learning-journey-import',
        label: '學習歷程資料匯入',
        path: '/admin/learning-journey/import',
        matchPrefixes: ['/admin/learning-journey/import'],
        visibility: 'english',
        pageTitle: '學習歷程資料匯入',
        breadcrumbLabel: '學習歷程資料匯入',
        hiddenFromNav: true,
      },
      {
        id: 'learning-journey-ewl-sync',
        label: '英文寫作工坊（EWL）同步',
        path: '/admin/learning-journey/ewl-sync',
        matchPrefixes: ['/admin/learning-journey/ewl-sync'],
        visibility: 'english',
        pageTitle: '英文寫作工坊（EWL）同步',
        breadcrumbLabel: 'EWL 同步',
        hiddenFromNav: true,
      },
      {
        id: 'learning-journey-operations',
        label: '資料維運紀錄',
        path: '/admin/learning-journey/operations',
        matchPrefixes: ['/admin/learning-journey/operations'],
        visibility: 'perm:can_view_english_test_tracking',
        pageTitle: '資料維運紀錄',
        breadcrumbLabel: '資料維運紀錄',
        // P14-7：維運查詢入口已整合至資料匯入中心；保留 route／麵包屑 meta，僅自側欄隱藏
        hiddenFromNav: true,
      },
      {
        id: 'bestep-import',
        label: 'BESTEP 資料匯入',
        path: '/admin/english-test/import',
        matchPrefixes: ['/admin/english-test/import', '/admin/bestep/import'],
        visibility: 'english',
        pageTitle: 'BESTEP 資料匯入',
        breadcrumbLabel: 'BESTEP 資料匯入',
        // P14-5：匯入入口已整合至資料匯入中心；保留 route／麵包屑 meta，僅自側欄隱藏
        hiddenFromNav: true,
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
        label: '問卷中心（建立／發布）',
        path: '/admin/survey-center',
        matchPrefixes: ['/admin/survey-center'],
        visibility: 'perm:can_view_surveys',
        pageTitle: '問卷中心',
        breadcrumbLabel: '問卷中心',
      },
      {
        id: 'survey-rules-new',
        label: '啟用規則',
        path: '/admin/survey-rules',
        matchPrefixes: ['/admin/survey-rules'],
        visibility: 'perm:can_manage_survey_settings',
        pageTitle: '啟用規則',
        breadcrumbLabel: '啟用規則',
      },
      {
        id: 'survey-health',
        label: '資料品質（維運）',
        path: '/admin/survey-health',
        matchPrefixes: ['/admin/survey-health'],
        visibility: 'perm:can_view_survey_health',
        pageTitle: '問卷資料品質',
        breadcrumbLabel: '資料品質',
      },
      {
        id: 'survey-answer-mappings',
        label: '答案對照（維運）',
        path: '/admin/survey-answer-mappings',
        matchPrefixes: ['/admin/survey-answer-mappings'],
        visibility: 'perm:can_manage_survey_answer_mapping',
        pageTitle: '問卷答案對照',
        breadcrumbLabel: '答案對照',
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
        hiddenFromNav: true,
      },
    ],
  },
  {
    id: 'import-center',
    label: '資料匯入中心',
    visibility: 'importCenter',
    expandable: true,
    children: [
      {
        id: 'import-center-home',
        label: '匯入入口',
        path: '/admin/import-center',
        matchPrefixes: ['/admin/import-center'],
        visibility: 'importCenter',
        pageTitle: '資料匯入中心',
        breadcrumbLabel: '匯入入口',
      },
      {
        id: 'import-center-runs',
        label: '匯入紀錄',
        path: '/admin/import-center/runs',
        matchPrefixes: ['/admin/import-center/runs'],
        visibility: 'importCenter',
        pageTitle: '匯入紀錄中心',
        breadcrumbLabel: '匯入紀錄',
      },
    ],
  },
  {
    id: 'learning-analytics',
    label: '學習成效分析',
    visibility: 'perm:can_view_learning_analytics',
    expandable: true,
    children: [
      {
        id: 'learning-analytics-overview',
        label: '中心成效總覽',
        path: '/admin/learning-analytics/overview',
        matchPrefixes: ['/admin/learning-analytics/overview', '/admin/learning-analytics'],
        visibility: 'perm:can_view_learning_analytics',
        pageTitle: '英語學習成效分析',
        breadcrumbLabel: '中心成效總覽',
      },
      {
        id: 'learning-analytics-cohorts',
        label: '學生群體分析',
        path: '/admin/learning-analytics/cohorts',
        matchPrefixes: ['/admin/learning-analytics/cohorts'],
        visibility: 'perm:can_view_learning_analytics',
        pageTitle: '學生群體分析',
        breadcrumbLabel: '群體分析',
      },
      {
        id: 'learning-analytics-resources',
        label: '課程與活動效益',
        path: '/admin/learning-analytics/resources',
        matchPrefixes: ['/admin/learning-analytics/resources'],
        visibility: 'perm:can_view_learning_analytics',
        pageTitle: '課程與活動效益',
        breadcrumbLabel: '資源效益',
      },
      {
        id: 'learning-analytics-skills',
        label: '技能成長分析',
        path: '/admin/learning-analytics/skills',
        matchPrefixes: ['/admin/learning-analytics/skills'],
        visibility: 'perm:can_view_learning_analytics',
        pageTitle: '技能成長分析',
        breadcrumbLabel: '技能成長',
      },
      {
        id: 'learning-analytics-students',
        label: '學生學習軌跡',
        path: '/admin/learning-analytics/students',
        matchPrefixes: ['/admin/learning-analytics/students'],
        visibility: 'perm:can_view_learning_analytics',
        pageTitle: '學生學習軌跡',
        breadcrumbLabel: '學習軌跡',
      },
      {
        id: 'learning-analytics-raw',
        label: '原始資料探索',
        path: '/admin/learning-analytics/raw-data',
        matchPrefixes: ['/admin/learning-analytics/raw-data'],
        visibility: 'perm:can_view_learning_analytics',
        pageTitle: '原始資料探索',
        breadcrumbLabel: '原始資料',
      },
      {
        id: 'learning-analytics-insights',
        label: '決策支援',
        path: '/admin/learning-analytics/insights',
        matchPrefixes: ['/admin/learning-analytics/insights'],
        visibility: 'perm:can_view_learning_analytics',
        pageTitle: '決策支援分析',
        breadcrumbLabel: '決策支援',
      },
      {
        id: 'learning-analytics-model-runs',
        label: '模型紀錄',
        path: '/admin/learning-analytics/model-runs',
        matchPrefixes: ['/admin/learning-analytics/model-runs'],
        visibility: 'perm:can_view_learning_analytics',
        pageTitle: '模型執行紀錄',
        breadcrumbLabel: '模型紀錄',
      },
      {
        id: 'learning-analytics-settings',
        label: '模組設定',
        path: '/admin/learning-analytics/settings',
        matchPrefixes: ['/admin/learning-analytics/settings'],
        visibility: 'perm:can_manage_learning_analytics_settings',
        pageTitle: '學習成效分析設定',
        breadcrumbLabel: '模組設定',
      },
    ],
  },
  {
    id: 'analytics',
    label: '分析與報表',
    visibility: 'perm:can_view_analytics',
    expandable: true,
    children: [
      {
        id: 'analytics-students',
        // Legacy 學號搜尋入口；老師請用「英語學習歷程中心」Student Table（同 V3 資料源）
        label: '學生學習歷程查詢',
        path: '/admin/analytics/students',
        matchPrefixes: ['/admin/analytics/students', '/admin/analytics/student/'],
        visibility: 'perm:can_view_english_test_tracking',
        pageTitle: '學生學習歷程查詢',
        breadcrumbLabel: '學生學習歷程查詢',
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
        label: '我的教學儀表板',
        path: '/admin/teachers/dashboard',
        matchPrefixes: ['/admin/teachers/dashboard'],
        visibility: 'perm:can_view_analytics',
        pageTitle: '我的教學儀表板',
        breadcrumbLabel: '我的教學儀表板',
      },
      {
        id: 'analytics-teacher-impact',
        label: '教學綜合趨勢',
        path: '/admin/analytics/teacher-impact',
        matchPrefixes: ['/admin/analytics/teacher-impact'],
        visibility: 'teachingImpactTrends',
        pageTitle: '教學綜合趨勢',
        breadcrumbLabel: '教學綜合趨勢',
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
    visibility: 'weeklyReports',
    path: '/admin/weekly-reports',
    matchPrefixes: ['/admin/weekly-reports'],
    pageTitle: '英語中心週報',
    breadcrumbLabel: '英語中心週報',
  },
  {
    id: 'site-content',
    label: '網站文案',
    visibility: 'perm:can_manage_site_content',
    path: '/admin/site-content',
    matchPrefixes: ['/admin/site-content'],
    pageTitle: '網站文案管理',
    breadcrumbLabel: '網站文案管理',
  },
  {
    id: 'page-content',
    label: '頁面內容',
    visibility: 'perm:can_manage_site_content',
    path: '/admin/page-content',
    matchPrefixes: ['/admin/page-content'],
    pageTitle: '頁面內容管理',
    breadcrumbLabel: '頁面內容管理',
  },
  {
    id: 'accounts',
    label: '帳號與權限',
    visibility: 'accountNav',
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
    expandable: true,
    children: [
      {
        id: 'system-dashboard',
        label: '營運總覽',
        path: '/admin/dashboard',
        matchPrefixes: ['/admin/dashboard'],
        visibility: 'opsDashboard',
        pageTitle: '營運總覽',
        breadcrumbLabel: '營運總覽',
      },
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

  if (pathname === '/admin/english-test/import' || pathname === '/admin/bestep/import') {
    const english = filtered.find((s) => s.id === 'english');
    if (english) {
      return {
        groupLabel: english.label,
        pageTitle: 'BESTEP 資料匯入',
        breadcrumbLeaf: 'BESTEP 資料匯入',
        sectionId: 'english',
        childId: 'bestep-import',
      };
    }
  }

  if (
    pathname === '/admin/learning-journey/operations' ||
    pathname.startsWith('/admin/learning-journey/operations/')
  ) {
    const english = filtered.find((s) => s.id === 'english');
    if (english) {
      return {
        groupLabel: english.label,
        pageTitle: '資料維運紀錄',
        breadcrumbLeaf: '資料維運紀錄',
        sectionId: 'english',
        childId: 'learning-journey-operations',
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
    breadcrumbLeaf = '學生學習歷程查詢';
    pageTitle = '學生學習歷程查詢';
  }

  if (pathname === '/admin' || pathname === '/admin/dashboard') {
    const sys = filtered.find((s) => s.id === 'system');
    if (sys) {
      return {
        groupLabel: sys.label,
        pageTitle: '營運總覽',
        breadcrumbLeaf: '營運總覽',
        sectionId: 'system',
        childId: 'system-dashboard',
      };
    }
    breadcrumbLeaf = '營運總覽';
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
  return sections
    .map((section) => {
      if (section.children?.length) {
        if (section.visibility && !isNavItemVisible(section.visibility, c)) {
          return null;
        }
        const children = section.children.filter((ch) => canShowAdminNavItem(ch, c));
        if (children.length === 0) {
          return null;
        }
        return { ...section, children };
      }
      if (!canShowAdminNavItem(section, c)) {
        return null;
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
