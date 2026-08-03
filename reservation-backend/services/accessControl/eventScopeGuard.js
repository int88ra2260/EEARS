'use strict';

const { buildAccessProfile, eventTypeToScope } = require('../../auth/accessProfile');
const { SCOPE } = require('../../auth/scopes');

const EVENT_TYPE_BY_SCOPE = {
  [SCOPE.ENGLISH_TABLE]: ['English Table'],
  [SCOPE.INTERNATIONAL_FORUM]: ['International Forum'],
  [SCOPE.JOB_TALK]: ['Job Talk'],
  [SCOPE.ENGLISH_CLUB]: ['English Club'],
};

function normalizeEventTypeForScope(eventType) {
  const raw = String(eventType || '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'english table') return { eventType: 'English Table', scope: SCOPE.ENGLISH_TABLE };
  if (lower === 'international forum') return { eventType: 'International Forum', scope: SCOPE.INTERNATIONAL_FORUM };
  if (lower === 'job talk') return { eventType: 'Job Talk', scope: SCOPE.JOB_TALK };
  if (lower === 'english club') return { eventType: 'English Club', scope: SCOPE.ENGLISH_CLUB };

  const scope = eventTypeToScope(raw);
  if (!scope) return { eventType: raw, scope: null };
  return { eventType: raw, scope };
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

  if (isWorkerProfile(profile)) {
    if (!options.explicitEventContext) {
      return { allowed: false, code: 'MISSING_EVENT_CONTEXT', message: '此操作需要指定活動或預約來源。' };
    }
    return { allowed: true, scope };
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
  if (isWorkerProfile(profile)) return null;

  if (profile.finalScopes.includes(SCOPE.ALL)) return {};

  const eventTypes = profile.finalScopes
    .flatMap((scope) => EVENT_TYPE_BY_SCOPE[scope] || [])
    .filter(Boolean);

  if (!eventTypes.length) return null;
  return { eventType: eventTypes };
}

module.exports = {
  normalizeEventTypeForScope,
  canAccessEventByRecord,
  assertCanAccessEvent,
  buildEventScopeWhere,
};
