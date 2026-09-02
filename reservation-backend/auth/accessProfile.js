/**
 * 統一存取輪廓：將 JWT / Teacher 的 role + teacherLevel 映射為
 * scopes、permissions、以及與舊版相容的旗標。
 *
 * 規則集中於此檔；router 請勿再散落 if (role===...)。
 */

const { P } = require('./permissions');
const { SCOPE, ALL_SCOPES } = require('./scopes');
const { buildEffectiveAccessFromSources } = require('../services/accessControl/readService');
const logger = require('../utils/logger');

/**
 * @typedef {{
 *  id?: number|string,
 *  role?: string,
 *  teacherLevel?: string|null,
 *  permissions?: Record<string, boolean|null|undefined>|null,
 *  scopes?: string[]|null
 * }} UserLike
 */

/**
 * teacherLevel → 業務範圍（不含 admin/worker）
 * @param {string} teacherLevel
 * @returns {string[]}
 */
function baseScopesFromTeacherLevel(teacherLevel) {
  const level = teacherLevel || 'regular';
  switch (level) {
    case 'executive':
      return [SCOPE.ALL];
    case 'et_manager':
      // 活動：ET／Job Talk／English Club；問卷含 ET／EC；班級為自行授課（guard）
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
      // 活動僅 Job Talk；問卷／班級與 et_manager 對齊（班級為自行授課 guard）
      return [
        SCOPE.JOB_TALK,
        SCOPE.SURVEY_ENGLISH_TABLE,
        SCOPE.SURVEY_ENGLISH_CLUB,
        SCOPE.CLASS,
      ];
    case 'regular':
    default:
      return [SCOPE.CLASS];
  }
}

/** 行政職員職務 → 活動類型／業務範圍（與 canAccessEventType 等對齊） */
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

/**
 * @param {Set<string>} set
 * @param {string[]} list
 */
function addAll(set, list) {
  list.forEach((k) => set.add(k));
}

/**
 * 第一階段 base 權限映射（role + teacherLevel）
 * 第二階段：base + per-user overrides（user.permissions）
 */
/**
 * et_manager / jt_manager 共用：活動營運、問卷、自授班級、Leader 帳號（不含 ET 分組）
 * @returns {string[]}
 */
function activityManagerCorePerms() {
  return [
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
}

function buildBasePermissionSet(user) {
  const role = user && user.role;
  const teacherLevel = (user && user.teacherLevel) || 'regular';
  const perms = new Set();

  if (role === 'admin') {
    Object.values(P).forEach((k) => perms.add(k));
    return perms;
  }

  if (role === 'teacher' && teacherLevel === 'executive') {
    // 第二階段：executive 不再等同 admin（系統級權限改為 admin only）
    addAll(perms, [
      // 帳號：可管理 teacher/worker（controller 另限制不可改 admin）
      P.CAN_MANAGE_ACCOUNTS,
      P.CAN_RESET_PASSWORDS,

      // 活動與預約
      P.CAN_VIEW_EVENTS_ADMIN,
      P.CAN_MANAGE_EVENTS,
      P.CAN_VIEW_RESERVATIONS,
      P.CAN_MANAGE_RESERVATIONS,
      P.CAN_EXPORT_RESERVATIONS,
      P.CAN_CHECKIN_STUDENTS,

      // 問卷
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

      // 班級 / BESTEP
      P.CAN_VIEW_CLASSES,
      P.CAN_MANAGE_CLASSES,
      P.CAN_IMPORT_BESTEP,
      P.CAN_EXPORT_BESTEP,

      // 英檢
      P.CAN_VIEW_ENGLISH_TEST_METRICS,
      P.CAN_VIEW_ENGLISH_TESTS,
      P.CAN_MANAGE_ENGLISH_TESTS,
      P.CAN_REVIEW_ENGLISH_TEST_REGISTRATIONS,
      P.CAN_EXPORT_ENGLISH_TEST_DATA,
      P.CAN_VIEW_ENGLISH_TEST_TRACKING,
      P.CAN_MANAGE_ENGLISH_TEST_TRACKING,

      // 黑名單 / 違規
      P.CAN_VIEW_BLACKLIST,
      P.CAN_MANAGE_BLACKLIST,
      P.CAN_RECORD_VIOLATIONS,
      P.CAN_MANAGE_VIOLATIONS,

      // 分析 / 報表
      P.CAN_VIEW_ANALYTICS,
      P.CAN_EXPORT_REPORTS,

      // 英語學習成效分析
      P.CAN_VIEW_LEARNING_ANALYTICS,
      P.CAN_EXPORT_LEARNING_ANALYTICS,
      P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS,
      P.CAN_RUN_LEARNING_ANALYTICS_MODEL,

      // 系統設定（保留；feature flags / diagnostics / audit logs 改 admin-only）
      P.CAN_MANAGE_SETTINGS,

      // 公告（保留）
      P.CAN_MANAGE_ANNOUNCEMENTS,

      // 學生端文案
      P.CAN_MANAGE_SITE_CONTENT,

      // 學習有伴管理端
      P.CAN_MANAGE_LEARNING_PARTNER_ADMIN,

      // 英語實踐歷程護照
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
    addAll(perms, [
      P.CAN_MARK_ET_SESSION_TASKS,
    ]);
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
        // 活動預約（全部）
        P.CAN_VIEW_EVENTS_ADMIN,
        P.CAN_MANAGE_EVENTS,
        P.CAN_VIEW_RESERVATIONS,
        P.CAN_MANAGE_RESERVATIONS,
        P.CAN_EXPORT_RESERVATIONS,
        P.CAN_CHECKIN_STUDENTS,
        // 英檢與培力（全部）
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
        P.CAN_MANAGE_ET_GROUPING,
        P.CAN_VIEW_ET_GROUPING,
        P.CAN_EXPORT_ET_GROUPING,
        // 公告、週報（週報 API 沿用 can_manage_announcements）、網站文案
        P.CAN_MANAGE_ANNOUNCEMENTS,
        P.CAN_MANAGE_SITE_CONTENT,
        // 帳號治理（不可管理 admin／執行長，見 teacherController）
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
      // 活動與預約（ET／JT／EC）、問卷、自授班級、ET 桌長帳號／分組；不含英檢／分析報表
      addAll(perms, [
        ...activityManagerCorePerms(),
        P.CAN_MANAGE_ET_GROUPING,
        P.CAN_VIEW_ET_GROUPING,
        P.CAN_EXPORT_ET_GROUPING,
      ]);
      return perms;
    }

    if (teacherLevel === 'jt_manager') {
      // 與 et_manager 相同模組權限；活動 scope 僅 Job Talk（無 ET 分組）
      addAll(perms, activityManagerCorePerms());
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

    // regular：僅自己的班級、教學儀表板（CAN_VIEW_ANALYTICS）；變更密碼不需額外權限
    addAll(perms, [
      P.CAN_VIEW_CLASSES,
      P.CAN_VIEW_ANALYTICS,
    ]);
    return perms;
  }

  return perms;
}

/**
 * per-user permission overrides（tri-state）
 * true：強制允許；false：強制禁止；undefined/null：不覆寫
 * @param {Set<string>} base
 * @param {Record<string, boolean|null|undefined>|null|undefined} overrides
 * @returns {{ final: Set<string>, applied: Record<string, boolean> }}
 */
function applyPermissionOverrides(base, overrides) {
  const final = new Set(base);
  /** @type {Record<string, boolean>} */
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

function isExecutiveTeacherRecord(teacher) {
  return !!(teacher && teacher.role === 'teacher' && (teacher.teacherLevel || 'regular') === 'executive');
}

function isDeputyManagerUser(user) {
  return !!(user && user.role === 'office_staff' && (user.staffLevel || 'event_lead') === 'deputy_manager');
}

function isEventLeadUser(user) {
  return !!(user && user.role === 'office_staff' && (user.staffLevel || 'event_lead') === 'event_lead');
}

function isEtManagerUser(user) {
  return !!(user && user.role === 'teacher' && (user.teacherLevel || 'regular') === 'et_manager');
}

function isJtManagerUser(user) {
  return !!(user && user.role === 'teacher' && (user.teacherLevel || 'regular') === 'jt_manager');
}

/** 活動行政／ET／JT 負責人：帳號管理僅限 ET Leader */
function isLeaderOnlyAccountManagerUser(user) {
  return isEventLeadUser(user) || isEtManagerUser(user) || isJtManagerUser(user);
}

function isBestepLeadUser(user) {
  return !!(user && user.role === 'office_staff' && (user.staffLevel || 'event_lead') === 'bestep_lead');
}

function buildAccessProfile(user) {
  const role = (user && user.role) || '';
  const teacherLevel = user && user.teacherLevel != null ? user.teacherLevel : 'regular';
  const staffLevel = user && user.staffLevel != null ? user.staffLevel : null;
  const isAdmin = role === 'admin';
  const isExecutive = role === 'teacher' && teacherLevel === 'executive';
  const isWorker = role === 'worker';
  const isLeader = role === 'leader';
  const isTeacher = role === 'teacher';
  const isOfficeStaff = role === 'office_staff';
  const hasAdminRights = isAdmin || isExecutive;

  // base scopes（role + teacherLevel / staffLevel）
  let baseScopes;
  if (isAdmin || isExecutive) {
    baseScopes = [SCOPE.ALL];
  } else if (isWorker) {
    baseScopes = [SCOPE.ALL];
  } else if (isLeader) {
    baseScopes = [SCOPE.ENGLISH_TABLE];
  } else if (isTeacher) {
    baseScopes = baseScopesFromTeacherLevel(teacherLevel);
  } else if (isOfficeStaff) {
    baseScopes = baseScopesFromStaffLevel(staffLevel || 'event_lead');
  } else {
    baseScopes = [];
  }

  // final scopes：若 user.scopes 有值，採「覆寫」模式（最保守，避免不小心 union 放寬）
  const scopeInput = user && user.__effectiveScopes !== undefined ? user.__effectiveScopes : (user && user.scopes);
  const scopeOverrides = scopeInput != null ? normalizeScopes(scopeInput) : null;
  const finalScopes = scopeOverrides && scopeOverrides.length ? scopeOverrides : baseScopes;

  const rawEffectiveBase = user && user.__effectiveBasePermissions;
  const hasEffectiveBaseArray = Array.isArray(rawEffectiveBase);
  // table_first 在 DB 尚無任何 role/user 列時會標為 json_fallback，但仍回傳 basePermissions: []。
  // 空陣列在此語意代表「尚未以表接管」，應回退到 buildBasePermissionSet（admin 全權等）。
  // json_only 同理：base 為空時僅 JWT 覆寫不足以代表「零權限」的 admin。
  const source = user && user.__effectiveSource;
  const emptyBaseMeansUseDefaults =
    hasEffectiveBaseArray &&
    rawEffectiveBase.length === 0 &&
    (source === 'json_fallback' || source === 'json_only');
  const basePermissionSet =
    hasEffectiveBaseArray && !emptyBaseMeansUseDefaults
      ? new Set(rawEffectiveBase)
      : buildBasePermissionSet(user);
  // table_first 若 role_permissions 尚未重 seed，補齊程式碼定義的職務範本權限（不縮減表內既有鍵）
  if (
    hasEffectiveBaseArray &&
    !emptyBaseMeansUseDefaults &&
    source === 'table_first' &&
    (isTeacher || isOfficeStaff)
  ) {
    buildBasePermissionSet(user).forEach((perm) => basePermissionSet.add(perm));
  }
  const permissionInput =
    user && user.__effectivePermissionOverrides !== undefined ? user.__effectivePermissionOverrides : (user && user.permissions);
  const permissionOverrides = permissionInput != null ? permissionInput : null;
  const { final: finalPermissionSet, applied: appliedPermissionOverrides } = applyPermissionOverrides(
    basePermissionSet,
    permissionOverrides
  );

  return {
    role,
    teacherLevel: role === 'teacher' ? teacherLevel : null,
    staffLevel: isOfficeStaff ? (staffLevel || 'event_lead') : null,
    isAdmin,
    isExecutive,
    isWorker,
    isLeader,
    isTeacher,
    isOfficeStaff,
    hasAdminRights,

    baseScopes,
    scopeOverrides,
    finalScopes,

    basePermissions: Array.from(basePermissionSet).sort(),
    permissionOverrides,
    appliedPermissionOverrides,
    finalPermissions: Array.from(finalPermissionSet).sort(),

    permissionSet: finalPermissionSet,
  };
}

function isFlagEnabled(name, defaultValue = false) {
  const val = process.env[name];
  if (val == null || val === '') return defaultValue;
  return String(val).toLowerCase() === 'true' || String(val) === '1';
}

function getAccessProfileReadMode() {
  const tableReadEnabled = isFlagEnabled('ACCESS_PROFILE_ENABLE_TABLE_READ', true);
  if (!tableReadEnabled) return 'json_only';
  const tableFirst = isFlagEnabled('ACCESS_PROFILE_TABLE_FIRST', true);
  return tableFirst ? 'table_first' : 'json_first';
}

async function resolveEffectiveAccessSources(user) {
  if (!user || !user.id) return user;
  const mode = getAccessProfileReadMode();
  const effective = await buildEffectiveAccessFromSources({
    userId: user.id,
    role: user.role || null,
    teacherLevel: user.teacherLevel || null,
    staffLevel: user.staffLevel != null ? user.staffLevel : null,
    jsonPermissions: user.permissions || null,
    jsonScopes: Array.isArray(user.scopes) ? user.scopes : null,
    mode,
  });
  if (effective?.consistency?.hasMismatch) {
    console.log(JSON.stringify({
      type: 'access_profile_source_mismatch',
      userId: user.id,
      role: user.role || null,
      teacherLevel: user.teacherLevel || null,
      source: effective.source,
      mode,
      permissionOverrideDiffKeys: {
        table: Object.keys(effective.consistency.permissionOverrideDiff.table || {}),
        fallback: Object.keys(effective.consistency.permissionOverrideDiff.fallback || {}),
      },
      scopeDiff: effective.consistency.scopeDiff || null,
    }));
    logger.warn('access profile table/json mismatch detected');
  }
  return {
    ...user,
    __effectiveBasePermissions: Array.isArray(effective.basePermissions) ? effective.basePermissions : [],
    __effectivePermissionOverrides: effective.permissionOverrides,
    __effectiveScopes: effective.scopeOverrides,
    __effectiveSource: effective.source,
    __effectiveFinalPermissions: effective.finalPermissions,
  };
}

/**
 * 附加在 req 上供後續 middleware 使用
 * @param {import('express').Request} req
 */
function attachAccessProfile(req) {
  if (!req.user) return null;
  const profile = buildAccessProfile(req.user);
  req.accessProfile = profile;
  return profile;
}

function hasPermission(user, permission) {
  const profile = buildAccessProfile(user);
  return profile.permissionSet.has(permission);
}

function hasAnyPermission(user, permissions) {
  if (!permissions || !permissions.length) return true;
  const profile = buildAccessProfile(user);
  return permissions.some((p) => profile.permissionSet.has(p));
}

function hasAllPermissions(user, permissions) {
  if (!permissions || !permissions.length) return true;
  const profile = buildAccessProfile(user);
  return permissions.every((p) => profile.permissionSet.has(p));
}

/**
 * eventType → scope 映射（第二階段：scope 正式化）
 */
function eventTypeToScope(eventType) {
  const t = String(eventType || '').trim();
  if (!t) return null;
  if (t === 'English Table') return SCOPE.ENGLISH_TABLE;
  if (t === 'International Forum') return SCOPE.INTERNATIONAL_FORUM;
  if (t === 'Job Talk') return SCOPE.JOB_TALK;
  if (t === 'English Club') return SCOPE.ENGLISH_CLUB;
  // 其他未映射活動類型：僅 admin/worker／ALL scope 可視
  return null;
}

function hasScope(profile, scope) {
  if (!scope) return false;
  if (profile.finalScopes.includes(SCOPE.ALL)) return true;
  return profile.finalScopes.includes(scope);
}

/**
 * canAccessEventType：以 permission + scope 為主，teacherLevel 僅作 base 映射來源
 */
function canAccessEventType(user, eventType) {
  const profile = buildAccessProfile(user);
  if (profile.isAdmin) return true;
  if (profile.isWorker) return true;
  if (profile.isLeader) {
    const scope = eventTypeToScope(eventType);
    return scope === SCOPE.ENGLISH_TABLE && hasScope(profile, scope);
  }

  if (!profile.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)) return false;
  const scope = eventTypeToScope(eventType);
  // 未映射者：僅 admin/worker；避免擴權
  if (!scope) return false;
  return hasScope(profile, scope);
}

/**
 * canAccessSurvey：以 permission + scope 為主
 */
function canAccessSurvey(user, surveyId) {
  const profile = buildAccessProfile(user);
  if (profile.isAdmin) return true;
  if (!profile.permissionSet.has(P.CAN_VIEW_SURVEYS) && !profile.permissionSet.has(P.CAN_EXPORT_SURVEYS)) return false;

  const id = String(surveyId || '');
  const isEnglishClubSurvey = id === 'english_club_feedback_114_1' || id.includes('english_club');
  // 第二階段先落地 ET 問卷 scope；EC 目前無獨立 scope，僅 ALL scope 可存取
  const isEnglishTableSurvey = id === 'english_table_feedback_114_1' || id.includes('english_table');
  if (isEnglishTableSurvey) {
    return hasScope(profile, SCOPE.SURVEY_ENGLISH_TABLE) || hasScope(profile, SCOPE.ENGLISH_TABLE);
  }
  if (isEnglishClubSurvey) {
    return hasScope(profile, SCOPE.ALL)
      || hasScope(profile, SCOPE.ENGLISH_CLUB)
      || hasScope(profile, SCOPE.SURVEY_ENGLISH_CLUB);
  }
  return false;
}

/** @deprecated 使用 buildAccessProfile；保留別名相容 */
function normalizeUserAccess(user) {
  return buildAccessProfile(user);
}

module.exports = {
  SCOPE,
  buildAccessProfile,
  resolveEffectiveAccessSources,
  getAccessProfileReadMode,
  attachAccessProfile,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessEventType,
  canAccessSurvey,
  normalizeUserAccess,
  baseScopesFromTeacherLevel,
  baseScopesFromStaffLevel,
  buildBasePermissionSet,
  eventTypeToScope,
  isDeputyManagerUser,
  isEventLeadUser,
  isEtManagerUser,
  isJtManagerUser,
  isLeaderOnlyAccountManagerUser,
  isBestepLeadUser,
  isExecutiveTeacherRecord,
};
