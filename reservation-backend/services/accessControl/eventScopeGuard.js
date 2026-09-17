'use strict';

const { buildAccessProfile, eventTypeToScope } = require('../../auth/accessProfile');
const { SCOPE } = require('../../auth/scopes');
const eventTypeService = require('../eventTypeService');

/** scope → 可匹配的 events.eventType 值（code + legacy，遷移過渡期） */
const EVENT_TYPE_BY_SCOPE = {
  [SCOPE.ENGLISH_TABLE]: ['english_table', 'English Table', 'ET'],
  [SCOPE.INTERNATIONAL_FORUM]: ['international_forum', 'International Forum', 'IF'],
  [SCOPE.JOB_TALK]: ['job_talk', 'Job Talk', 'JT'],
  [SCOPE.ENGLISH_CLUB]: ['english_club', 'English Club', 'EC'],
};

function normalizeEventTypeForScope(eventType) {
  const raw = String(eventType || '').trim();
  const scope = eventTypeToScope(raw);
  if (!scope) return { eventType: raw, scope: null };
  const cfg = eventTypeService.resolveTypeConfigSync(raw);
  return {
    eventType: cfg?.code || scope,
    displayName: cfg?.displayName || raw,
    scope,
  };
}

function hasAnyPermission(profile, permissions = []) {
  if (!permissions.length) return true;
  return permissions.some((permission) => profile.permissionSet.has(permission));
}

function isWorkerProfile(profile) {
  return profile.role === 'worker';
}

function canAccessEventByRecord(user, event, options = {}) {
  const profile = buildAccessProfile(user);
  const anyPermissions = Array.isArray(options.anyPermissions) ? options.anyPermissions : [];

  if (!event) {
    return { allowed: false, code: 'MISSING_EVENT_CONTEXT', message: '此操作需要指定活動或預約來源。' };
  }

  if (!hasAnyPermission(profile, anyPermissions)) {
    return { allowed: false, code: 'PERMISSION_DENIED', message: '您沒有執行此操作的權限。' };
  }

  if (profile.isAdmin) {
    return { allowed: true, scope: SCOPE.ALL };
  }

  const { scope } = normalizeEventTypeForScope(event.eventType);
  if (!scope) {
    return { allowed: false, code: 'EVENT_SCOPE_DENIED', message: '您沒有存取此活動資料的權限。' };
  }

  // 工讀生現場操作仍須帶明確活動上下文，但仍受 finalScopes 限制
  if (isWorkerProfile(profile) && !options.explicitEventContext) {
    return { allowed: false, code: 'MISSING_EVENT_CONTEXT', message: '此操作需要指定活動或預約來源。' };
  }

  if (profile.finalScopes.includes(SCOPE.ALL)) {
    return { allowed: true, scope: SCOPE.ALL };
  }

  if (profile.finalScopes.includes(scope)) {
    return { allowed: true, scope };
  }

  return { allowed: false, code: 'EVENT_SCOPE_DENIED', message: '您沒有存取此活動資料的權限。' };
}

function assertCanAccessEvent(user, event, options = {}) {
  const result = canAccessEventByRecord(user, event, options);
  if (result.allowed) return result;

  const err = new Error(result.message || '您沒有存取此活動資料的權限。');
  err.status = 403;
  err.code = result.code || 'EVENT_SCOPE_DENIED';
  throw err;
}

function buildEventScopeWhere(user) {
  const profile = buildAccessProfile(user);
  if (profile.isAdmin) return {};

  if (profile.finalScopes.includes(SCOPE.ALL)) return {};

  const eventTypes = profile.finalScopes
    .flatMap((scope) => {
      if (EVENT_TYPE_BY_SCOPE[scope]) return EVENT_TYPE_BY_SCOPE[scope];
      if (eventTypeService.isEventTypeScopeCode(scope)) return [scope];
      return [];
    })
    .filter(Boolean);

  if (!eventTypes.length) return null;
  return { eventType: [...new Set(eventTypes)] };
}

module.exports = {
  normalizeEventTypeForScope,
  canAccessEventByRecord,
  assertCanAccessEvent,
  buildEventScopeWhere,
};
