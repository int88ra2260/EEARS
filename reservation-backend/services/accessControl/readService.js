const { RolePermission, UserPermissionOverride, UserScope } = require('../../models');
const { P } = require('../../auth/permissions');
const { ALL_SCOPES } = require('../../auth/scopes');
const ALL_PERMISSION_VALUES = Object.values(P);

function toOverrideObject(rows) {
  const out = {};
  for (const row of rows || []) {
    if (!Object.values(P).includes(row.permission)) continue;
    out[row.permission] = row.value === 'allow';
  }
  return out;
}

function toScopesArray(rows) {
  const values = [];
  for (const row of rows || []) {
    if (row.scopeType !== 'event') continue;
    if (!ALL_SCOPES.includes(row.scopeValue)) continue;
    values.push(row.scopeValue);
  }
  return Array.from(new Set(values));
}

function normalizeRoleKey(role, teacherLevel, staffLevel, workerLevel) {
  if (typeof role === 'string') {
    if (
      role.startsWith('teacher:')
      || role.startsWith('office_staff:')
      || role.startsWith('worker:')
    ) {
      return role;
    }
  }
  if (role === 'teacher') return `teacher:${teacherLevel || 'regular'}`;
  if (role === 'office_staff') return `office_staff:${staffLevel || 'event_lead'}`;
  if (role === 'worker') return `worker:${workerLevel || 'event_ops'}`;
  return role || '';
}

async function getRolePermissions(role, teacherLevel, options = {}) {
  const { transaction, staffLevel, workerLevel } = options;
  const roleKey = normalizeRoleKey(role, teacherLevel, staffLevel, workerLevel);
  if (!roleKey) return [];
  const rows = await RolePermission.findAll({
    where: { role: roleKey },
    attributes: ['permission'],
    transaction,
  });
  return rows.map((r) => r.permission).filter((p) => ALL_PERMISSION_VALUES.includes(p));
}

async function getUserOverrides(userId, options = {}) {
  if (!userId) return {};
  const { transaction } = options;
  const rows = await UserPermissionOverride.findAll({
    where: { userId },
    attributes: ['permission', 'value'],
    transaction,
  });
  return toOverrideObject(rows);
}

async function getUserScopes(userId, options = {}) {
  if (!userId) return [];
  const { transaction } = options;
  const rows = await UserScope.findAll({
    where: { userId },
    attributes: ['scopeType', 'scopeValue'],
    transaction,
  });
  return toScopesArray(rows);
}

function applyOverrides(basePermissions, overrides) {
  const set = new Set(basePermissions || []);
  const ov = overrides && typeof overrides === 'object' ? overrides : {};
  for (const [key, val] of Object.entries(ov)) {
    if (!ALL_PERMISSION_VALUES.includes(key)) continue;
    if (val === true) set.add(key);
    if (val === false) set.delete(key);
  }
  return Array.from(set).sort();
}

/**
 * mode:
 * - json_only: 僅用 JSON（3.1 預設）
 * - json_first: 有 table 才覆寫，無則回退 JSON
 * - table_first: 有 table 先用 table，無則回退 JSON
 */
async function buildEffectiveAccessFromSources({
  userId,
  role = null,
  teacherLevel = null,
  staffLevel = null,
  workerLevel = null,
  jsonPermissions = null,
  jsonScopes = null,
  mode = 'json_only',
}) {
  const jsonFallbackEnabled = String(process.env.ACCESS_PROFILE_JSON_FALLBACK_ENABLED || 'true').toLowerCase() !== 'false';
  const fallbackPermissions = jsonPermissions && typeof jsonPermissions === 'object' ? jsonPermissions : null;
  const fallbackScopes = Array.isArray(jsonScopes) ? jsonScopes : null;

  if (!userId || mode === 'json_only') {
    return {
      basePermissions: [],
      permissionOverrides: fallbackPermissions,
      scopeOverrides: fallbackScopes,
      finalPermissions: applyOverrides([], fallbackPermissions || {}),
      source: 'json_only',
      consistency: null,
    };
  }

  const [tableBasePermissionsRaw, tablePermissionOverrides, tableScopeOverrides] = await Promise.all([
    getRolePermissions(role, teacherLevel, { staffLevel, workerLevel }),
    getUserOverrides(userId),
    getUserScopes(userId),
  ]);
  // role_permissions 若早於 permissions.js 新增欄位，table 會缺新鍵；admin 應永遠擁有 P 之全集。
  let tableBasePermissions = tableBasePermissionsRaw;
  if (role === 'admin' && tableBasePermissions.length > 0) {
    tableBasePermissions = Array.from(new Set([...tableBasePermissions, ...ALL_PERMISSION_VALUES])).sort();
  }
  const tableFinalPermissions = applyOverrides(tableBasePermissions, tablePermissionOverrides);

  const hasTablePermission = Object.keys(tablePermissionOverrides).length > 0;
  const hasTableScope = tableScopeOverrides.length > 0;
  const hasTableBase = tableBasePermissions.length > 0;
  const hasAnyTableData = hasTableBase || hasTablePermission || hasTableScope;

  const tableConsistency = jsonFallbackEnabled
    ? {
        hasMismatch:
          JSON.stringify(tablePermissionOverrides) !== JSON.stringify(fallbackPermissions || {}) ||
          JSON.stringify(tableScopeOverrides) !== JSON.stringify(fallbackScopes || []),
        permissionOverrideDiff: {
          table: tablePermissionOverrides,
          fallback: fallbackPermissions || {},
        },
        scopeDiff: {
          table: tableScopeOverrides,
          fallback: fallbackScopes || [],
        },
      }
    : null;

  if (mode === 'table_first') {
    return {
      basePermissions: tableBasePermissions,
      permissionOverrides: hasTablePermission
        ? tablePermissionOverrides
        : (jsonFallbackEnabled ? (fallbackPermissions || null) : null),
      scopeOverrides: hasTableScope
        ? tableScopeOverrides
        : (jsonFallbackEnabled ? fallbackScopes : null),
      finalPermissions: tableFinalPermissions,
      source: hasAnyTableData ? 'table_first' : (jsonFallbackEnabled ? 'json_fallback' : 'table_only_empty'),
      consistency: tableConsistency,
    };
  }

  // json_first
  return {
    basePermissions: tableBasePermissions,
    permissionOverrides: fallbackPermissions != null
      ? fallbackPermissions
      : (hasTablePermission ? tablePermissionOverrides : null),
    scopeOverrides: fallbackScopes != null
      ? fallbackScopes
      : (hasTableScope ? tableScopeOverrides : null),
    finalPermissions: tableFinalPermissions,
    source: 'json_first',
    consistency: tableConsistency,
  };
}

module.exports = {
  normalizeRoleKey,
  getRolePermissions,
  getUserOverrides,
  getUserScopes,
  buildEffectiveAccessFromSources,
};

