import { P } from './permissions';
import { isDeniedStaffLevel, OFFICE_STAFF_OPS_DENIED_LEVELS } from '../utils/accessControl';

const DEPUTY_DENIED_STAFF_LEVELS = ['deputy_manager'];
const IMPORT_CENTER_DENIED_STAFF_LEVELS = ['deputy_manager', 'event_lead'];
const IMPORT_CENTER_DENIED_TEACHER_LEVELS = ['et_manager', 'jt_manager'];
const WEEKLY_REPORT_DENIED_STAFF_LEVELS = ['curriculum_lead'];

export const ADMIN_ROUTE_ACCESS = [
  {
    pattern: '/admin',
    exact: true,
    label: '營運總覽',
    allowAuthenticated: true,
    denyNonExecutiveTeachers: true,
    denyRoles: ['leader'],
    denyStaffLevels: [...DEPUTY_DENIED_STAFF_LEVELS, ...OFFICE_STAFF_OPS_DENIED_LEVELS],
  },
  {
    pattern: '/admin/dashboard',
    label: '營運總覽',
    allowAuthenticated: true,
    denyNonExecutiveTeachers: true,
    denyRoles: ['leader'],
    denyStaffLevels: [...DEPUTY_DENIED_STAFF_LEVELS, ...OFFICE_STAFF_OPS_DENIED_LEVELS],
  },

  { pattern: '/admin/events', label: '活動與預約', anyPermissions: [P.CAN_VIEW_EVENTS_ADMIN] },
  { pattern: '/admin/operations', label: '活動列表', anyPermissions: [P.CAN_VIEW_EVENTS_ADMIN] },
  { pattern: '/admin/operations/participation', label: '簽到參與統計', anyPermissions: [P.CAN_VIEW_EVENTS_ADMIN] },
  {
    pattern: '/admin/et-grouping/settings',
    label: 'ET 分組設定',
    anyPermissions: [P.CAN_MANAGE_ET_GROUPING],
  },
  {
    pattern: '/admin/et-grouping/tasks',
    label: 'ET 任務模板',
    anyPermissions: [P.CAN_MANAGE_ET_GROUPING],
  },
  {
    pattern: '/admin/et-grouping/reports',
    label: 'ET 場次報表',
    anyPermissions: [P.CAN_VIEW_ET_GROUPING, P.CAN_EXPORT_ET_GROUPING, P.CAN_MANAGE_ET_GROUPING],
  },
  {
    pattern: '/admin/et-grouping/student-trends',
    label: 'ET 學生趨勢',
    anyPermissions: [P.CAN_VIEW_ET_GROUPING, P.CAN_EXPORT_ET_GROUPING, P.CAN_MANAGE_ET_GROUPING],
  },
  {
    pattern: '/admin/et-grouping/my-sessions',
    label: '我的帶班場次',
    anyPermissions: [P.CAN_MARK_ET_SESSION_TASKS],
  },
  {
    pattern: '/admin/operations/:eventId',
    label: '活動明細',
    anyPermissions: [
      P.CAN_VIEW_EVENTS_ADMIN,
      P.CAN_VIEW_RESERVATIONS,
      P.CAN_VIEW_ET_GROUPING,
      P.CAN_MARK_ET_SESSION_TASKS,
    ],
  },

  { pattern: '/admin/classes', label: '班級參與概況', anyPermissions: [P.CAN_VIEW_CLASSES, P.CAN_MANAGE_CLASSES] },
  {
    pattern: '/admin/classes/:classId',
    label: '班級明細',
    anyPermissions: [P.CAN_VIEW_CLASSES, P.CAN_MANAGE_CLASSES],
  },
  {
    pattern: '/admin/classes/:classId/bestep',
    label: 'BESTEP',
    anyPermissions: [P.CAN_VIEW_CLASSES, P.CAN_MANAGE_CLASSES, P.CAN_EXPORT_BESTEP],
  },
  {
    pattern: '/admin/classes/:classId/detail',
    label: 'Legacy 班級明細',
    anyPermissions: [P.CAN_VIEW_CLASSES, P.CAN_MANAGE_CLASSES],
  },

  {
    pattern: '/admin/import-center',
    label: '資料匯入中心',
    denyStaffLevels: IMPORT_CENTER_DENIED_STAFF_LEVELS,
    denyTeacherLevels: IMPORT_CENTER_DENIED_TEACHER_LEVELS,
    anyPermissions: [
      P.CAN_IMPORT_BESTEP,
      P.CAN_MANAGE_CLASSES,
      P.CAN_MANAGE_EVENTS,
      P.CAN_MANAGE_SURVEYS,
      P.CAN_MANAGE_SURVEY_SETTINGS,
      P.CAN_MANAGE_ENGLISH_TESTS,
    ],
  },
  {
    pattern: '/admin/import-center/runs',
    label: '匯入紀錄中心',
    denyStaffLevels: IMPORT_CENTER_DENIED_STAFF_LEVELS,
    denyTeacherLevels: IMPORT_CENTER_DENIED_TEACHER_LEVELS,
    anyPermissions: [
      P.CAN_IMPORT_BESTEP,
      P.CAN_MANAGE_ENGLISH_TEST_TRACKING,
      P.CAN_VIEW_ENGLISH_TEST_TRACKING,
      P.CAN_MANAGE_CLASSES,
      P.CAN_MANAGE_EVENTS,
      P.CAN_MANAGE_SURVEYS,
      P.CAN_MANAGE_SURVEY_SETTINGS,
      P.CAN_MANAGE_ENGLISH_TESTS,
    ],
  },

  { pattern: '/admin/bestep/import', label: 'BESTEP 資料匯入', anyPermissions: [P.CAN_IMPORT_BESTEP] },
  { pattern: '/admin/violations', label: '違規管理', anyPermissions: [P.CAN_MANAGE_BLACKLIST, P.CAN_MANAGE_VIOLATIONS, P.CAN_VIEW_BLACKLIST] },

  { pattern: '/admin/survey-module', label: '問卷模組', anyPermissions: [P.CAN_VIEW_SURVEYS] },
  {
    pattern: '/admin/survey-module/:surveyId/responses',
    label: '問卷作答',
    anyPermissions: [P.CAN_VIEW_SURVEY_RESPONSES],
  },
  {
    pattern: '/admin/survey-module/:surveyId/stats',
    label: '問卷統計',
    anyPermissions: [P.CAN_VIEW_SURVEY_ANALYTICS],
  },
  { pattern: '/admin/survey-center', label: '問卷中心', anyPermissions: [P.CAN_VIEW_SURVEYS] },
  { pattern: '/admin/survey-rules', label: '問卷規則', anyPermissions: [P.CAN_MANAGE_SURVEY_RULES] },
  {
    pattern: '/admin/survey-responses/:surveyId',
    label: '問卷填答紀錄',
    anyPermissions: [P.CAN_VIEW_SURVEY_RESPONSES],
  },
  {
    pattern: '/admin/survey-analytics/:surveyId',
    label: '問卷分析',
    anyPermissions: [P.CAN_VIEW_SURVEY_ANALYTICS],
  },
  { pattern: '/admin/survey-health', label: '問卷資料品質', anyPermissions: [P.CAN_VIEW_SURVEY_HEALTH] },
  {
    pattern: '/admin/survey-answer-mappings',
    label: '問卷答案對照',
    anyPermissions: [P.CAN_MANAGE_SURVEY_ANSWER_MAPPING],
  },
  { pattern: '/admin/surveys', label: 'Legacy 問卷管理', anyPermissions: [P.CAN_VIEW_SURVEYS, P.CAN_EXPORT_SURVEYS] },
  {
    pattern: '/admin/surveys/settings',
    label: 'Legacy 問卷設定',
    anyPermissions: [P.CAN_MANAGE_SURVEY_SETTINGS],
  },

  { pattern: '/admin/announcements', label: '公告管理', anyPermissions: [P.CAN_MANAGE_ANNOUNCEMENTS] },
  {
    pattern: '/admin/weekly-reports',
    label: '英語中心週報',
    denyStaffLevels: WEEKLY_REPORT_DENIED_STAFF_LEVELS,
    anyPermissions: [P.CAN_MANAGE_ANNOUNCEMENTS],
  },
  {
    pattern: '/admin/weekly-reports/:id/edit',
    label: '編輯週報',
    denyStaffLevels: WEEKLY_REPORT_DENIED_STAFF_LEVELS,
    anyPermissions: [P.CAN_MANAGE_ANNOUNCEMENTS],
  },
  { pattern: '/admin/student-content', label: '學生端內容', anyPermissions: [P.CAN_MANAGE_SITE_CONTENT] },
  { pattern: '/admin/site-content', label: '學生端內容', anyPermissions: [P.CAN_MANAGE_SITE_CONTENT] },
  { pattern: '/admin/page-content', label: '學生端內容', anyPermissions: [P.CAN_MANAGE_SITE_CONTENT] },

  { pattern: '/admin/logs', label: '操作紀錄', roles: ['admin'], denyStaffLevels: DEPUTY_DENIED_STAFF_LEVELS, anyPermissions: [P.CAN_VIEW_AUDIT_LOGS] },
  {
    pattern: '/admin/settings/system',
    label: '系統設定',
    anyPermissions: [P.CAN_MANAGE_SETTINGS],
  },
  {
    pattern: '/admin/settings/email-templates',
    label: '郵件設定中心',
    anyPermissions: [P.CAN_MANAGE_SETTINGS],
  },
  {
    pattern: '/admin/system/settings',
    label: '系統設定',
    anyPermissions: [P.CAN_MANAGE_SETTINGS],
  },
  {
    pattern: '/admin/diagnostics',
    label: '系統診斷',
    roles: ['admin'],
    denyStaffLevels: DEPUTY_DENIED_STAFF_LEVELS,
    anyPermissions: [P.CAN_VIEW_INTERNAL_DIAGNOSTICS],
  },

  {
    pattern: '/admin/english-test',
    label: '培力英檢管理',
    anyPermissions: [
      P.CAN_VIEW_ENGLISH_TEST_METRICS,
      P.CAN_VIEW_ENGLISH_TESTS,
      P.CAN_REVIEW_ENGLISH_TEST_REGISTRATIONS,
      P.CAN_EXPORT_ENGLISH_TEST_DATA,
    ],
  },
  {
    pattern: '/admin/english-learning-passports',
    label: '英語實踐歷程護照',
    anyPermissions: [
      P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS,
      P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS,
      P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS,
      P.CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS,
      P.CAN_MANAGE_ENGLISH_LEARNING_RULES,
    ],
  },
  {
    pattern: '/admin/english-learning-passports/:id',
    label: '護照詳情',
    anyPermissions: [P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS],
  },
  {
    pattern: '/admin/english-tests',
    label: '培力英檢管理',
    anyPermissions: [
      P.CAN_VIEW_ENGLISH_TEST_METRICS,
      P.CAN_VIEW_ENGLISH_TESTS,
      P.CAN_REVIEW_ENGLISH_TEST_REGISTRATIONS,
      P.CAN_EXPORT_ENGLISH_TEST_DATA,
    ],
  },
  {
    pattern: '/admin/english-test/import',
    label: 'BESTEP 資料匯入',
    anyPermissions: [P.CAN_IMPORT_BESTEP, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/english-tests/tracking',
    label: '英語學習歷程中心',
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/english-test-tracking',
    label: 'Legacy 英檢追蹤',
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/english-test-tracking-v2',
    label: 'Legacy 英檢追蹤 V2',
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/english-test-tracking/students',
    label: 'Legacy 英檢學生列表',
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/english-test-tracking/students/:studentId',
    label: 'Legacy 英檢學生頁',
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/english-test-tracking/student-timeline/:studentId',
    label: 'Legacy 英檢學生歷程',
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/english-test-tracking/*',
    label: 'Legacy 英檢追蹤',
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/english-test-v2',
    label: 'Legacy 英檢 V2',
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/english-test-v2/students',
    label: 'Legacy 英檢 V2 學生列表',
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/english-test-v2/students/:studentId',
    label: 'Legacy 英檢 V2 學生頁',
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/english-test-v2/*',
    label: 'Legacy 英檢 V2',
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/learning-journey-center',
    label: 'Legacy 學習歷程中心',
    denyStaffLevels: DEPUTY_DENIED_STAFF_LEVELS,
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/learning-journey-center/*',
    label: 'Legacy 學習歷程中心',
    denyStaffLevels: DEPUTY_DENIED_STAFF_LEVELS,
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/learning-journey/import',
    label: '學習歷程資料匯入',
    denyStaffLevels: DEPUTY_DENIED_STAFF_LEVELS,
    anyPermissions: [P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/learning-journey/ewl-sync',
    label: '英文寫作工坊（EWL）同步',
    denyStaffLevels: DEPUTY_DENIED_STAFF_LEVELS,
    anyPermissions: [P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/learning-journey',
    label: '英語學習歷程中心',
    denyStaffLevels: DEPUTY_DENIED_STAFF_LEVELS,
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/learning-journey/operations',
    label: '資料維運紀錄',
    denyStaffLevels: DEPUTY_DENIED_STAFF_LEVELS,
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/learning-journey/students/:studentId',
    label: '學生學習歷程',
    denyStaffLevels: DEPUTY_DENIED_STAFF_LEVELS,
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },

  {
    pattern: '/admin/analytics/students',
    label: '學生學習歷程查詢',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/analytics/student/:studentId',
    label: '學生學習歷程查詢',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  },
  {
    pattern: '/admin/learning-analytics',
    label: '學習成效分析',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_LEARNING_ANALYTICS],
  },
  {
    pattern: '/admin/learning-analytics/overview',
    label: '中心成效總覽',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_LEARNING_ANALYTICS],
  },
  {
    pattern: '/admin/learning-analytics/cohorts',
    label: '學生群體分析',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_LEARNING_ANALYTICS],
  },
  {
    pattern: '/admin/learning-analytics/offerings',
    label: '課程／教師／活動細項',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_LEARNING_ANALYTICS],
  },
  {
    pattern: '/admin/learning-analytics/resources',
    label: '課程與活動效益',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_LEARNING_ANALYTICS],
  },
  {
    pattern: '/admin/learning-analytics/skills',
    label: '技能成長分析',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_LEARNING_ANALYTICS],
    exact: false,
  },
  {
    pattern: '/admin/learning-analytics/skills/:studentId',
    label: '學生技能成長',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_LEARNING_ANALYTICS],
  },
  {
    pattern: '/admin/learning-analytics/students',
    label: '學生學習軌跡',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_LEARNING_ANALYTICS],
    exact: false,
  },
  {
    pattern: '/admin/learning-analytics/students/:studentId',
    label: '學生學習軌跡詳情',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_LEARNING_ANALYTICS],
  },
  {
    pattern: '/admin/learning-analytics/raw-data',
    label: '原始資料探索',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_LEARNING_ANALYTICS],
  },
  {
    pattern: '/admin/learning-analytics/insights',
    label: '進階分析',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_LEARNING_ANALYTICS],
  },
  {
    pattern: '/admin/learning-analytics/model-runs',
    label: '分析紀錄',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_VIEW_LEARNING_ANALYTICS],
  },
  {
    pattern: '/admin/learning-analytics/settings',
    label: '學習成效分析設定',
    allowAdminOrExecutive: true,
    anyPermissions: [P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS],
  },
  {
    pattern: '/admin/analytics/overview',
    label: '行政總覽',
    allowAdminOrExecutive: true,
  },
  {
    pattern: '/admin/analytics/risk',
    label: '高風險預警',
    allowAdminOrExecutive: true,
  },
  {
    pattern: '/admin/analytics/trends',
    label: '趨勢分析',
    allowAdminOrExecutive: true,
  },
  { pattern: '/admin/reports', label: '報表下載', anyPermissions: [P.CAN_EXPORT_REPORTS] },
  {
    pattern: '/admin/analytics/teacher-impact',
    label: '教學綜合趨勢',
    anyPermissions: [
      P.CAN_VIEW_ANALYTICS,
      P.CAN_VIEW_CLASSES,
      P.CAN_VIEW_ENGLISH_TEST_TRACKING,
    ],
    teacherLevels: ['et_manager', 'if_manager', 'jt_manager'],
    allowAdminOrExecutive: true,
  },
  {
    pattern: '/admin/teachers/dashboard',
    label: '我的教學儀表板',
    anyPermissions: [P.CAN_VIEW_ANALYTICS, P.CAN_VIEW_CLASSES],
  },

  { pattern: '/admin/accounts', label: '帳號管理', anyPermissions: [P.CAN_MANAGE_ACCOUNTS] },
  { pattern: '/admin/account', label: '帳號管理', anyPermissions: [P.CAN_MANAGE_ACCOUNTS] },
  { pattern: '/admin/account/reset', label: '變更密碼', allowAuthenticated: true },
];

function normalizePathname(pathname) {
  const path = String(pathname || '').split('?')[0].split('#')[0] || '/';
  if (path.length > 1) return path.replace(/\/+$/, '');
  return path;
}

function patternToRegExp(pattern, exact) {
  const normalized = normalizePathname(pattern);
  const segments = normalized.split('/').filter(Boolean);
  const source = segments
    .map((segment) => {
      if (segment === '*') return '.*';
      if (segment.startsWith(':')) return '[^/]+';
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  const suffix = exact === false ? '(?:/.*)?' : '';
  return new RegExp(`^/${source}${suffix}$`);
}

function routeScore(rule) {
  return rule.pattern
    .split('/')
    .filter(Boolean)
    .reduce((score, segment) => {
      if (segment === '*') return score;
      if (segment.startsWith(':')) return score + 1;
      return score + 3;
    }, 0);
}

export function getAdminRouteAccess(pathname) {
  const normalized = normalizePathname(pathname);
  return ADMIN_ROUTE_ACCESS
    .filter((rule) => patternToRegExp(rule.pattern, rule.exact).test(normalized))
    .sort((a, b) => routeScore(b) - routeScore(a))[0] || null;
}

function hasPermission(accessProfile, permission) {
  const set = accessProfile?.permissionSet;
  return !!(set && set.has && set.has(permission));
}

export function canAccessAdminRoute(accessProfile, pathname) {
  const rule = getAdminRouteAccess(pathname);
  if (!rule) return false;
  if (isDeniedStaffLevel(accessProfile, rule.denyStaffLevels)) return false;
  if (
    rule.denyTeacherLevels?.length
    && accessProfile?.role === 'teacher'
    && rule.denyTeacherLevels.includes(accessProfile?.teacherLevel)
  ) {
    return false;
  }
  if (rule.denyRoles?.length && rule.denyRoles.includes(accessProfile?.role)) return false;
  if (rule.denyNonExecutiveTeachers && accessProfile?.role === 'teacher' && !accessProfile?.hasAdminRights) {
    return false;
  }
  const isAdminOrExec = !!(accessProfile?.isAdmin || accessProfile?.hasAdminRights);
  if (rule.allowAdminOrExecutive && isAdminOrExec) {
    return true;
  }
  if (rule.allowAuthenticated) return !!accessProfile?.role;
  if (rule.roles?.length && !rule.roles.includes(accessProfile?.role)) return false;
  if (rule.teacherLevels?.length && !rule.teacherLevels.includes(accessProfile?.teacherLevel)) return false;
  if (rule.allPermissions?.length && !rule.allPermissions.every((permission) => hasPermission(accessProfile, permission))) {
    return false;
  }
  if (rule.anyPermissions?.length && !rule.anyPermissions.some((permission) => hasPermission(accessProfile, permission))) {
    return false;
  }
  // 僅標 allowAdminOrExecutive、無其他許可條件時：非 admin/executive 一律拒絕
  if (rule.allowAdminOrExecutive && !isAdminOrExec) {
    const hasAlternateGrant = !!(
      rule.allowAuthenticated
      || rule.roles?.length
      || rule.teacherLevels?.length
      || rule.anyPermissions?.length
      || rule.allPermissions?.length
    );
    if (!hasAlternateGrant) return false;
  }
  return true;
}

export function getAdminRouteDeniedReason(accessProfile, pathname) {
  const rule = getAdminRouteAccess(pathname);
  if (!rule) {
    return {
      code: 'missing_rule',
      title: '此後台頁面尚未設定權限規則，請聯絡系統管理員。',
      route: normalizePathname(pathname),
    };
  }
  if (!accessProfile?.role) {
    return { code: 'unauthenticated', title: '請先登入。', route: normalizePathname(pathname), rule };
  }
  if (canAccessAdminRoute(accessProfile, pathname)) {
    return null;
  }
  return {
    code: 'forbidden',
    title: '您沒有檢視此後台頁面的權限。',
    route: normalizePathname(pathname),
    rule,
  };
}
