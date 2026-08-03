'use strict';

const { P } = require('./permissions');

/**
 * 僅系統管理員（JWT role === admin）可透過帳號管理指派／變更之覆寫權限。
 * executive／其他非 admin 不可新增、修改、清除（改為 inherit）這些覆寫。
 * can_manage_accounts 刻意不在此列，以保留 executive 合理的帳號治理流程。
 */
const SYSTEM_ONLY_ASSIGNMENT_KEYS = Object.freeze([
  P.CAN_VIEW_AUDIT_LOGS,
  P.CAN_VIEW_INTERNAL_DIAGNOSTICS,
  P.CAN_MANAGE_SETTINGS,
  P.CAN_MANAGE_FEATURE_FLAGS,
]);

function isSystemAdminUser(user) {
  return !!(user && user.role === 'admin');
}

function assignmentDeniedResponse() {
  return {
    status: 403,
    body: {
      success: false,
      code: 'PERMISSION_ASSIGNMENT_DENIED',
      error: '您不能指派此系統層級權限。',
    },
  };
}

/**
 * 建立帳號：非 admin 請求不可帶入任何 system-only 覆寫鍵。
 * @param {import('express').Request} req
 * @param {Record<string, boolean>|null|undefined} permissionOverrides
 * @returns {string|null} 錯誤碼字串或 null
 */
function validateCreatePermissionOverrides(req, permissionOverrides) {
  if (isSystemAdminUser(req.user)) return null;
  if (!permissionOverrides || typeof permissionOverrides !== 'object') return null;
  for (const key of SYSTEM_ONLY_ASSIGNMENT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(permissionOverrides, key)) {
      return 'PERMISSION_ASSIGNMENT_DENIED';
    }
  }
  return null;
}

/**
 * 更新覆寫：非 admin 不可變更／新增 system-only；清除全部覆寫時仍保留既有 system-only 列。
 * @param {import('express').Request} req
 * @param {Record<string, boolean>|null|undefined} incoming `undefined` 表示不更新此欄位
 * @param {Record<string, boolean>|null|undefined} before
 * @returns {{ ok: true, merged: object|null|undefined } | { ok: false, code: string }}
 */
function resolveUpdatePermissionOverrides(req, incoming, before) {
  if (incoming === undefined) {
    return { ok: true, merged: undefined };
  }

  const beforeObj = before && typeof before === 'object' ? before : {};

  if (isSystemAdminUser(req.user)) {
    if (incoming === null) return { ok: true, merged: null };
    if (typeof incoming === 'object') return { ok: true, merged: { ...incoming } };
    return { ok: true, merged: null };
  }

  if (incoming === null) {
    const preserved = {};
    for (const key of SYSTEM_ONLY_ASSIGNMENT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(beforeObj, key)) {
        preserved[key] = beforeObj[key];
      }
    }
    const keys = Object.keys(preserved);
    return { ok: true, merged: keys.length ? preserved : null };
  }

  if (typeof incoming !== 'object') {
    return { ok: true, merged: null };
  }

  for (const key of SYSTEM_ONLY_ASSIGNMENT_KEYS) {
    const hadBefore = Object.prototype.hasOwnProperty.call(beforeObj, key);
    const hasInc = Object.prototype.hasOwnProperty.call(incoming, key);
    if (hasInc && !hadBefore) {
      return { ok: false, code: 'PERMISSION_ASSIGNMENT_DENIED' };
    }
    if (hasInc && hadBefore && JSON.stringify(beforeObj[key]) !== JSON.stringify(incoming[key])) {
      return { ok: false, code: 'PERMISSION_ASSIGNMENT_DENIED' };
    }
  }

  const merged = { ...incoming };
  for (const key of SYSTEM_ONLY_ASSIGNMENT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(beforeObj, key) && !Object.prototype.hasOwnProperty.call(incoming, key)) {
      merged[key] = beforeObj[key];
    }
  }
  return { ok: true, merged: Object.keys(merged).length ? merged : null };
}

module.exports = {
  SYSTEM_ONLY_ASSIGNMENT_KEYS,
  isSystemAdminUser,
  validateCreatePermissionOverrides,
  resolveUpdatePermissionOverrides,
  assignmentDeniedResponse,
};
