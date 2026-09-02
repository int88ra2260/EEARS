/**
 * 前端存取控制：規則與後端 auth/accessProfile.js 對齊
 * @typedef {{ role: string, teacherLevel?: string|null }} UserLike
 */

import { P } from '../constants/permissions';
import { SCOPE, ALL_SCOPES } from '../constants/scopes';
import { parseJwtPayload } from './jwtPayload';

function addAll(set, list) {
  list.forEach((k) => set.add(k));
}

/** et_manager / jt_manager 共用（不含 ET 分組） */
const ACTIVITY_MANAGER_CORE_PERMS = [
  P.CAN_VIEW_CLASSES,
  P.CAN_VIEW_EVENTS_ADMIN,
  P.CAN_MANAGE_EVENTS,
  P.CAN_VIEW_RESERVATIONS,
  P.CAN_MANAGE_RESERVATIONS,
  P.CAN_EXPORT_RESERVATIONS,
  P.CAN_CHECKIN_STUDENTS,
  P.CAN_VIEW_SURVEYS,
  P.CAN_EXPORT_SURVEYS,
  P.CAN_VIEW_SURVEY_RESPONSES,
  P.CAN_EXPORT_SURVEY_RESPONSES,
  P.CAN_VIEW_SURVEY_ANALYTICS,
  P.CAN_VIEW_SURVEY_HEALTH,
  P.CAN_EXECUTE_SURVEY_REPAIRS,
  P.CAN_MANAGE_SURVEY_ANSWER_MAPPING,
  P.CAN_VIEW_SURVEY_REPAIR_AUDIT,
  P.CAN_MANAGE_ACCOUNTS,
  P.CAN_RESET_PASSWORDS,
];

function buildBasePermissionSet(user) {
  const role = user && user.role;
  const teacherLevel = (user && user.teacherLevel) || 'regular';
  const perms = new Set();

  if (role === 'admin') {
    Object.values(P).forEach((k) => perms.add(k));
    return perms;
  }

  if (role === 'teacher' && teacherLevel === 'executive') {
    // 與後端 accessProfile executive 對齊（側欄：活動／班級／英檢／學習成效／分析報表／帳號）
    addAll(perms, [
      P.CAN_MANAGE_ACCOUNTS,
      P.CAN_RESET_PASSWORDS,
      P.CAN_VIEW_EVENTS_ADMIN,
      P.CAN_MANAGE_EVENTS,
      P.CAN_VIEW_RESERVATIONS,
      P.CAN_MANAGE_RESERVATIONS,
      P.CAN_EXPORT_RESERVATIONS,
      P.CAN_CHECKIN_STUDENTS,
      P.CAN_VIEW_SURVEYS,
      P.CAN_MANAGE_SURVEYS,
      P.CAN_EXPORT_SURVEYS,
      P.CAN_MANAGE_SURVEY_SETTINGS,
      P.CAN_MANAGE_SURVEY_RULES,
      P.CAN_PUBLISH_SURVEYS,
      P.CAN_VIEW_SURVEY_RESPONSES,
      P.CAN_EXPORT_SURVEY_RESPONSES,
      P.CAN_VIEW_SURVEY_ANALYTICS,
      P.CAN_VIEW_SURVEY_HEALTH,
      P.CAN_EXECUTE_SURVEY_REPAIRS,
      P.CAN_MANAGE_SURVEY_ANSWER_MAPPING,
      P.CAN_VIEW_SURVEY_REPAIR_AUDIT,
      P.CAN_VIEW_CLASSES,
      P.CAN_MANAGE_CLASSES,
      P.CAN_IMPORT_BESTEP,
      P.CAN_EXPORT_BESTEP,
      P.CAN_VIEW_ENGLISH_TEST_METRICS,
      P.CAN_VIEW_ENGLISH_TESTS,
      P.CAN_MANAGE_ENGLISH_TESTS,
      P.CAN_REVIEW_ENGLISH_TEST_REGISTRATIONS,
      P.CAN_EXPORT_ENGLISH_TEST_DATA,
      P.CAN_VIEW_ENGLISH_TEST_TRACKING,
      P.CAN_MANAGE_ENGLISH_TEST_TRACKING,
      P.CAN_VIEW_BLACKLIST,
      P.CAN_MANAGE_BLACKLIST,
      P.CAN_RECORD_VIOLATIONS,
      P.CAN_MANAGE_VIOLATIONS,
      P.CAN_VIEW_ANALYTICS,
      P.CAN_EXPORT_REPORTS,
      P.CAN_VIEW_LEARNING_ANALYTICS,
      P.CAN_EXPORT_LEARNING_ANALYTICS,
      P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS,
      P.CAN_RUN_LEARNING_ANALYTICS_MODEL,
      P.CAN_MANAGE_SETTINGS,
      P.CAN_MANAGE_ANNOUNCEMENTS,
      P.CAN_MANAGE_SITE_CONTENT,
      P.CAN_MANAGE_LEARNING_PARTNER_ADMIN,
      P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS,
      P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS,
      P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS,
      P.CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS,
      P.CAN_MANAGE_ENGLISH_LEARNING_RULES,
      P.CAN_MANAGE_ET_GROUPING,
      P.CAN_VIEW_ET_GROUPING,
      P.CAN_EXPORT_ET_GROUPING,
    ]);
    return perms;
  }

  if (role === 'worker') {
    addAll(perms, [
      P.CAN_VIEW_EVENTS_ADMIN,
      P.CAN_VIEW_RESERVATIONS,
      P.CAN_EXPORT_RESERVATIONS,
      P.CAN_CHECKIN_STUDENTS,
      P.CAN_VIEW_BLACKLIST,
      P.CAN_RECORD_VIOLATIONS,
      P.CAN_MANAGE_VIOLATIONS,
      P.CAN_VIEW_ENGLISH_TEST_METRICS,
    ]);
    return perms;
  }

  if (role === 'leader') {
    addAll(perms, [P.CAN_MARK_ET_SESSION_TASKS]);
    return perms;
  }

  if (role === 'office_staff') {
    const staff = (user && user.staffLevel) || 'event_lead';
    const officeStaffCommon = [
      P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS,
      P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS,
      P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS,
      P.CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS,
      P.CAN_MANAGE_ANNOUNCEMENTS,
      P.CAN_MANAGE_SITE_CONTENT,
      P.CAN_MANAGE_SETTINGS,
    ];
    const eventLead = [
      P.CAN_VIEW_EVENTS_ADMIN,
      P.CAN_MANAGE_EVENTS,
      P.CAN_VIEW_RESERVATIONS,
      P.CAN_MANAGE_RESERVATIONS,
      P.CAN_EXPORT_RESERVATIONS,
      P.CAN_CHECKIN_STUDENTS,
      P.CAN_VIEW_BLACKLIST,
      P.CAN_MANAGE_BLACKLIST,
      P.CAN_RECORD_VIOLATIONS,
      P.CAN_MANAGE_VIOLATIONS,
      P.CAN_MANAGE_ANNOUNCEMENTS,
      P.CAN_MANAGE_ET_GROUPING,
      P.CAN_VIEW_ET_GROUPING,
      P.CAN_EXPORT_ET_GROUPING,
    ];
    const curriculumLead = [
      P.CAN_VIEW_CLASSES,
      P.CAN_MANAGE_CLASSES,
      P.CAN_IMPORT_BESTEP,
      P.CAN_EXPORT_BESTEP,
      P.CAN_VIEW_RESERVATIONS,
      P.CAN_EXPORT_RESERVATIONS,
      P.CAN_CHECKIN_STUDENTS,
    ];
    const bestepLead = [
      P.CAN_VIEW_ENGLISH_TEST_METRICS,
      P.CAN_VIEW_ENGLISH_TESTS,
      P.CAN_MANAGE_ENGLISH_TESTS,
      P.CAN_REVIEW_ENGLISH_TEST_REGISTRATIONS,
      P.CAN_EXPORT_ENGLISH_TEST_DATA,
      P.CAN_VIEW_ENGLISH_TEST_TRACKING,
      P.CAN_MANAGE_ENGLISH_TEST_TRACKING,
      P.CAN_IMPORT_BESTEP,
      P.CAN_EXPORT_BESTEP,
      P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS,
      P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS,
      P.CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS,
    ];
    if (staff === 'event_lead') {
      addAll(perms, [
        ...eventLead,
        P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS,
        P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS,
        P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS,
        P.CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS,
        P.CAN_MANAGE_ENGLISH_LEARNING_RULES,
        P.CAN_MANAGE_SITE_CONTENT,
        P.CAN_MANAGE_SETTINGS,
        P.CAN_MANAGE_ACCOUNTS,
        P.CAN_RESET_PASSWORDS,
      ]);
    } else if (staff === 'curriculum_lead') {
      addAll(perms, [...curriculumLead, ...officeStaffCommon]);
    } else if (staff === 'bestep_lead') {
      // 帳號與權限：僅可自行變更密碼（側欄 allowAuthenticated），不含帳號管理
      addAll(perms, [...bestepLead, ...officeStaffCommon]);
    } else if (staff === 'deputy_manager') {
      addAll(perms, [
        P.CAN_VIEW_EVENTS_ADMIN,
        P.CAN_MANAGE_EVENTS,
        P.CAN_VIEW_RESERVATIONS,
        P.CAN_MANAGE_RESERVATIONS,
        P.CAN_EXPORT_RESERVATIONS,
        P.CAN_CHECKIN_STUDENTS,
        P.CAN_VIEW_ENGLISH_TEST_METRICS,
        P.CAN_VIEW_ENGLISH_TESTS,
        P.CAN_MANAGE_ENGLISH_TESTS,
        P.CAN_REVIEW_ENGLISH_TEST_REGISTRATIONS,
        P.CAN_EXPORT_ENGLISH_TEST_DATA,
        P.CAN_VIEW_ENGLISH_TEST_TRACKING,
        P.CAN_MANAGE_ENGLISH_TEST_TRACKING,
        P.CAN_IMPORT_BESTEP,
        P.CAN_EXPORT_BESTEP,
        P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS,
        P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS,
        P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS,
        P.CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS,
        P.CAN_MANAGE_ENGLISH_LEARNING_RULES,
        P.CAN_MANAGE_LEARNING_PARTNER_ADMIN,
        P.CAN_MANAGE_SETTINGS,
        P.CAN_MANAGE_ANNOUNCEMENTS,
        P.CAN_MANAGE_SITE_CONTENT,
        P.CAN_MANAGE_ACCOUNTS,
        P.CAN_RESET_PASSWORDS,
      ]);
    } else {
      addAll(perms, [...eventLead, ...officeStaffCommon]);
    }
    return perms;
  }

  if (role === 'teacher') {
    if (teacherLevel === 'et_manager') {
      addAll(perms, [
        ...ACTIVITY_MANAGER_CORE_PERMS,
        P.CAN_MANAGE_ET_GROUPING,
        P.CAN_VIEW_ET_GROUPING,
        P.CAN_EXPORT_ET_GROUPING,
      ]);
      return perms;
    }
    if (teacherLevel === 'jt_manager') {
      addAll(perms, ACTIVITY_MANAGER_CORE_PERMS);
      return perms;
    }
    if (teacherLevel === 'if_manager') {
      addAll(perms, [
        P.CAN_VIEW_CLASSES,
        P.CAN_VIEW_ANALYTICS,
        P.CAN_VIEW_ENGLISH_TEST_TRACKING,
        P.CAN_VIEW_EVENTS_ADMIN,
      ]);
      return perms;
    }
    // regular：僅自己的班級、教學儀表板；變更密碼不需額外權限
    addAll(perms, [
      P.CAN_VIEW_CLASSES,
      P.CAN_VIEW_ANALYTICS,
    ]);
    return perms;
  }

  return perms;
}

function baseScopesFromTeacherLevel(teacherLevel) {
  const level = teacherLevel || 'regular';
  switch (level) {
    case 'executive':
      return [SCOPE.ALL];
    case 'et_manager':
      return [
        SCOPE.ENGLISH_TABLE,
        SCOPE.JOB_TALK,
        SCOPE.ENGLISH_CLUB,
        SCOPE.SURVEY_ENGLISH_TABLE,
        SCOPE.SURVEY_ENGLISH_CLUB,
        SCOPE.CLASS,
      ];
    case 'if_manager':
      return [SCOPE.INTERNATIONAL_FORUM];
    case 'jt_manager':
      return [
        SCOPE.JOB_TALK,
        SCOPE.SURVEY_ENGLISH_TABLE,
        SCOPE.SURVEY_ENGLISH_CLUB,
        SCOPE.CLASS,
      ];
    default:
      return [SCOPE.CLASS];
  }
}

function baseScopesFromStaffLevel(staffLevel) {
  const level = staffLevel || 'event_lead';
  switch (level) {
    case 'deputy_manager':
      return [SCOPE.ALL];
    case 'event_lead':
      return [SCOPE.ALL];
    case 'curriculum_lead':
      return [SCOPE.CLASS, SCOPE.ENGLISH_TEST];
    case 'bestep_lead':
      return [SCOPE.ENGLISH_TEST, SCOPE.SURVEY_ENGLISH_TABLE];
    default:
      return [SCOPE.CLASS];
  }
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes)) return [];
  const set = new Set();
  for (const s of scopes) {
    if (typeof s !== 'string') continue;
    if (!ALL_SCOPES.includes(s)) continue;
    set.add(s);
  }
  return Array.from(set);
}

function applyPermissionOverrides(base, overrides) {
  const final = new Set(base);
  const applied = {};
  if (!overrides || typeof overrides !== 'object') return { final, applied };
  for (const [key, val] of Object.entries(overrides)) {
    if (!Object.values(P).includes(key)) continue;
    if (val === true) {
      final.add(key);
      applied[key] = true;
    } else if (val === false) {
      final.delete(key);
      applied[key] = false;
    }
  }
  return { final, applied };
}

/**
 * @param {string|null|undefined} token - JWT
 * @param {string} [fallbackRole]
 * @returns {UserLike & { permissionSet: Set<string>, finalPermissions: string[], basePermissions: string[], baseScopes: string[], finalScopes: string[], permissionOverrides: any, scopeOverrides: any, isAdmin: boolean, isExecutive: boolean, hasAdminRights: boolean, isWorker: boolean, isTeacher: boolean }}
 */
export function buildAccessProfile(token, fallbackRole = '') {
  let role = fallbackRole || '';
  let teacherLevel = 'regular';
  let staffLevel = null;
  let permissionOverrides = null;
  let scopeOverrides = null;

  if (token) {
    try {
      const payload = parseJwtPayload(token);
      if (payload) {
        if (payload.role) role = payload.role;
        teacherLevel = payload.teacherLevel || 'regular';
        staffLevel = payload.staffLevel != null ? payload.staffLevel : null;
        permissionOverrides = payload.permissions || null;
        scopeOverrides = Array.isArray(payload.scopes) ? payload.scopes : null;
      }
    } catch (_) {
      /* ignore */
    }
  }

  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const isWorker = role === 'worker';
  const isLeader = role === 'leader';
  const isOfficeStaff = role === 'office_staff';
  const isExecutive = isTeacher && teacherLevel === 'executive';
  const hasAdminRights = isAdmin || isExecutive;

  const userLike = {
    role,
    teacherLevel: role === 'teacher' ? teacherLevel : null,
    staffLevel: isOfficeStaff ? (staffLevel || 'event_lead') : null,
    permissions: permissionOverrides,
    scopes: scopeOverrides,
  };

  const basePermissionsSet = buildBasePermissionSet(userLike);
  const { final: permissionSet, applied: appliedPermissionOverrides } = applyPermissionOverrides(
    basePermissionsSet,
    permissionOverrides
  );

  let baseScopes;
  if (isAdmin || isExecutive) baseScopes = [SCOPE.ALL];
  else if (isWorker) baseScopes = [SCOPE.ALL];
  else if (isLeader) baseScopes = [SCOPE.ENGLISH_TABLE];
  else if (isTeacher) baseScopes = baseScopesFromTeacherLevel(teacherLevel);
  else if (isOfficeStaff) baseScopes = baseScopesFromStaffLevel(staffLevel || 'event_lead');
  else baseScopes = [];

  const normalizedOverrides = scopeOverrides != null ? normalizeScopes(scopeOverrides) : null;
  const finalScopes = normalizedOverrides && normalizedOverrides.length ? normalizedOverrides : baseScopes;

  return {
    role,
    teacherLevel: userLike.teacherLevel,
    staffLevel: userLike.staffLevel,
    permissionSet,
    basePermissions: Array.from(basePermissionsSet).sort(),
    permissionOverrides,
    appliedPermissionOverrides,
    finalPermissions: Array.from(permissionSet).sort(),
    baseScopes,
    scopeOverrides: normalizedOverrides,
    finalScopes,
    isAdmin,
    isExecutive,
    hasAdminRights,
    isWorker,
    isLeader,
    isTeacher,
    isOfficeStaff,
  };
}

export function hasPermission(profile, permission) {
  return profile.permissionSet.has(permission);
}

/** 行政副理（office_staff + deputy_manager） */
export function isDeputyManagerProfile(profile) {
  return !!(profile && profile.role === 'office_staff' && profile.staffLevel === 'deputy_manager');
}

/** 活動行政（office_staff + event_lead） */
export function isEventLeadProfile(profile) {
  return !!(
    profile &&
    profile.role === 'office_staff' &&
    (profile.staffLevel || 'event_lead') === 'event_lead'
  );
}

/** 非副理行政職員：不進營運總覽（活動／課務／英檢行政） */
export const OFFICE_STAFF_OPS_DENIED_LEVELS = ['event_lead', 'curriculum_lead', 'bestep_lead'];

export function isOfficeStaffOpsDenied(profile) {
  return isDeniedStaffLevel(profile, OFFICE_STAFF_OPS_DENIED_LEVELS);
}

/** 培力英檢行政（office_staff + bestep_lead） */
export function isBestepLeadProfile(profile) {
  return !!(profile && profile.role === 'office_staff' && profile.staffLevel === 'bestep_lead');
}

/** English Table 負責人（teacher + et_manager） */
export function isEtManagerProfile(profile) {
  return !!(profile && profile.role === 'teacher' && profile.teacherLevel === 'et_manager');
}

/** Job Talk 負責人（teacher + jt_manager） */
export function isJtManagerProfile(profile) {
  return !!(profile && profile.role === 'teacher' && profile.teacherLevel === 'jt_manager');
}

/** 英語中心週報：副理、活動行政、培力英檢行政與管理層 */
export function canAccessWeeklyReports(profile) {
  if (!profile?.role) return false;
  if (profile.isAdmin || profile.hasAdminRights) return true;
  if (isDeputyManagerProfile(profile) || isEventLeadProfile(profile) || isBestepLeadProfile(profile)) {
    return true;
  }
  return false;
}

export function isDeniedStaffLevel(accessProfile, denyStaffLevels) {
  if (!denyStaffLevels?.length) return false;
  return (
    accessProfile?.role === 'office_staff' &&
    denyStaffLevels.includes(accessProfile?.staffLevel)
  );
}

export function hasAnyPermission(profile, permissions) {
  if (!permissions || !permissions.length) return true;
  return permissions.some((p) => profile.permissionSet.has(p));
}

export function hasAllPermissions(profile, permissions) {
  if (!permissions || !permissions.length) return true;
  return permissions.every((p) => profile.permissionSet.has(p));
}

export function canAccessEventType(profile, eventType) {
  if (profile.isAdmin) return true;
  if (profile.isWorker) return true;
  if (profile.isLeader) {
    const t = String(eventType || '').trim();
    if (t !== 'English Table') return false;
    return profile.finalScopes.includes(SCOPE.ENGLISH_TABLE) || profile.finalScopes.includes(SCOPE.ALL);
  }
  if (!profile.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)) return false;

  const t = String(eventType || '').trim();
  let scope = null;
  if (t === 'English Table') scope = SCOPE.ENGLISH_TABLE;
  else if (t === 'International Forum') scope = SCOPE.INTERNATIONAL_FORUM;
  else if (t === 'Job Talk') scope = SCOPE.JOB_TALK;
  else if (t === 'English Club') scope = SCOPE.ENGLISH_CLUB;
  else scope = null;
  if (!scope) return false;
  if (profile.finalScopes.includes(SCOPE.ALL)) return true;
  return profile.finalScopes.includes(scope);
}

export function canAccessSurvey(profile, surveyId) {
  if (profile.isAdmin) return true;
  if (!profile.permissionSet.has(P.CAN_VIEW_SURVEYS) && !profile.permissionSet.has(P.CAN_EXPORT_SURVEYS)) return false;
  const id = String(surveyId || '');
  const isEnglishClubSurvey = id === 'english_club_feedback_114_1' || id.includes('english_club');
  const isEnglishTableSurvey = id === 'english_table_feedback_114_1' || id.includes('english_table');
  if (isEnglishTableSurvey) {
    if (profile.finalScopes.includes(SCOPE.ALL)) return true;
    return profile.finalScopes.includes(SCOPE.SURVEY_ENGLISH_TABLE) || profile.finalScopes.includes(SCOPE.ENGLISH_TABLE);
  }
  if (isEnglishClubSurvey) {
    return (
      profile.finalScopes.includes(SCOPE.ALL)
      || profile.finalScopes.includes(SCOPE.ENGLISH_CLUB)
      || profile.finalScopes.includes(SCOPE.SURVEY_ENGLISH_CLUB)
    );
  }
  return false;
}

/**
 * 供 AdminSidebar / adminNavigation 使用（與舊 AdminNavContext 形狀相容）
 */
export function buildNavContextFromAccessProfile(profile) {
  const canViewReport = profile.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN);
  const canViewSurvey = profile.permissionSet.has(P.CAN_VIEW_SURVEYS) || profile.permissionSet.has(P.CAN_EXPORT_SURVEYS);
  const canManageAccounts = profile.permissionSet.has(P.CAN_MANAGE_ACCOUNTS);
  const canManageSettings = profile.permissionSet.has(P.CAN_MANAGE_SETTINGS);
  const canViewAnalytics = profile.permissionSet.has(P.CAN_VIEW_ANALYTICS);
  const canExportReports = profile.permissionSet.has(P.CAN_EXPORT_REPORTS);
  const canViewAuditLogs = profile.permissionSet.has(P.CAN_VIEW_AUDIT_LOGS);
  const canViewDiagnostics = profile.permissionSet.has(P.CAN_VIEW_INTERNAL_DIAGNOSTICS);
  const canManageAnnouncements = profile.permissionSet.has(P.CAN_MANAGE_ANNOUNCEMENTS);

  return {
    actualUserRole: profile.role,
    isTeacher: profile.isTeacher,
    hasAdminRights: profile.hasAdminRights,
    canViewReport,
    canViewSurvey,
    canManageAccounts,
    canManageSettings,
    canViewAnalytics,
    canExportReports,
    canViewAuditLogs,
    canViewDiagnostics,
    canManageAnnouncements,
    accessProfile: profile,
  };
}
