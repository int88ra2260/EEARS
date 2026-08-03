const { Teacher, RolePermission, UserPermissionOverride, UserScope } = require('../../models');
const { normalizeRoleKey, buildEffectiveAccessFromSources } = require('./readService');
const {
  buildBasePermissionSet,
  buildAccessProfile,
  getAccessProfileReadMode,
} = require('../../auth/accessProfile');

function sortUnique(list) {
  return Array.from(new Set(list || [])).sort();
}

async function getUserBasicInfo(userId) {
  return Teacher.findByPk(userId, {
    attributes: ['id', 'role', 'teacherLevel', 'staffLevel', 'permissions', 'scopes', 'accessVersion', 'isActive'],
  });
}

async function loadUserForAccessDebug(userId) {
  if (!userId) return null;
  return Teacher.findByPk(userId, {
    attributes: [
      'id',
      'username',
      'name',
      'email',
      'role',
      'teacherLevel',
      'staffLevel',
      'permissions',
      'scopes',
      'accessVersion',
      'isActive',
      'mustResetPassword',
      'lastLoginAt',
    ],
  });
}

async function getRolePermissions(roleKey) {
  if (!roleKey) return [];
  const rows = await RolePermission.findAll({
    where: { role: roleKey },
    attributes: ['permission', 'createdAt', 'updatedAt'],
    order: [['permission', 'ASC']],
  });
  return rows;
}

async function getUserOverrides(userId) {
  if (!userId) return [];
  return UserPermissionOverride.findAll({
    where: { userId },
    attributes: ['permission', 'value', 'source', 'updatedBy', 'createdAt', 'updatedAt'],
    order: [['permission', 'ASC']],
  });
}

async function getUserScopes(userId) {
  if (!userId) return [];
  return UserScope.findAll({
    where: { userId },
    attributes: ['scopeType', 'scopeValue', 'source', 'updatedBy', 'createdAt', 'updatedAt'],
    order: [['scopeType', 'ASC'], ['scopeValue', 'ASC']],
  });
}

async function getJsonPermissions(userId) {
  const t = await getUserBasicInfo(userId);
  return t ? (t.permissions || null) : null;
}

async function getJsonScopes(userId) {
  const t = await getUserBasicInfo(userId);
  return t ? (Array.isArray(t.scopes) ? t.scopes : null) : null;
}

async function buildEffectiveAccessTableFirst({ userId, role, teacherLevel, staffLevel, jsonPermissions, jsonScopes }) {
  return buildEffectiveAccessFromSources({
    userId,
    role,
    teacherLevel,
    staffLevel: staffLevel != null ? staffLevel : null,
    jsonPermissions,
    jsonScopes,
    mode: 'table_first',
  });
}

async function buildEffectiveAccessJsonFirst({ userId, role, teacherLevel, staffLevel, jsonPermissions, jsonScopes }) {
  return buildEffectiveAccessFromSources({
    userId,
    role,
    teacherLevel,
    staffLevel: staffLevel != null ? staffLevel : null,
    jsonPermissions,
    jsonScopes,
    mode: 'json_first',
  });
}

function diffAccess(tableResult, jsonResult) {
  const tablePerms = sortUnique(tableResult?.finalPermissions || []);
  const jsonPerms = sortUnique(jsonResult?.finalPermissions || []);
  const tableScopes = sortUnique(tableResult?.scopeOverrides || []);
  const jsonScopes = sortUnique(jsonResult?.scopeOverrides || []);
  return {
    permissionsOnlyInTable: tablePerms.filter((p) => !jsonPerms.includes(p)),
    permissionsOnlyInJson: jsonPerms.filter((p) => !tablePerms.includes(p)),
    scopesOnlyInTable: tableScopes.filter((s) => !jsonScopes.includes(s)),
    scopesOnlyInJson: jsonScopes.filter((s) => !tableScopes.includes(s)),
  };
}

function analyzeFallback(tableResult, jsonResult) {
  const source = tableResult?.source || 'unknown';
  const consistency = tableResult?.consistency || null;
  const required = source === 'json_fallback' || source === 'table_only_empty';
  const reason = required
    ? (source === 'json_fallback' ? 'table 缺少 base/override/scope，觸發 JSON fallback' : 'table-only 模式下 table 無資料')
    : 'NOT REQUIRED';
  return {
    required,
    source,
    reason,
    mismatch: consistency?.hasMismatch || false,
    consistency: consistency || null,
    jsonFirstSource: jsonResult?.source || 'unknown',
  };
}

function generateSuggestion(diffResult, data) {
  const hints = [];
  const rolePermissionsCount = (data?.table?.rolePermissions || []).length;
  const overrideCount = (data?.table?.overrides || []).length;
  const scopeCount = (data?.table?.scopes || []).length;
  if (!rolePermissionsCount) hints.push('RolePermissions 可能未 seed（base 權限為空）');
  if (!overrideCount) hints.push('此使用者無 override（屬正常，代表只吃 role base）');
  if (!scopeCount) hints.push('此使用者無 user_scopes（可能依 baseScopes 或無需 scope）');
  if (diffResult.permissionsOnlyInTable.length) hints.push('table 比 json 多權限，可能是 3.3 停寫 JSON 後的預期差異');
  if (diffResult.permissionsOnlyInJson.length) hints.push('json 比 table 多權限，請檢查 backfill/同步或是否漏寫 override');
  if (diffResult.scopesOnlyInJson.length || diffResult.scopesOnlyInTable.length) hints.push('scope 不一致，請檢查 user_scopes 與 legacy JSON scopes');
  if ((data?.basic?.accessVersion || 0) > (data?.tokenVersion || 0) && data?.tokenVersion != null) {
    hints.push('tokenVersion 落後於 DB accessVersion，可能觸發 ACCESS_PROFILE_STALE');
  }
  if (!hints.length) hints.push('table 與 json 看起來一致，未見明顯異常');
  return hints;
}

/**
 * HTTP / 後台除錯用：單一使用者權限來源分解（不含密碼／token）
 * @param {number|string} userId
 * @returns {Promise<object|null>}
 */
async function buildAccessDebugApiPayload(userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return null;

  const basic = await loadUserForAccessDebug(uid);
  if (!basic) return null;

  const plain = basic.get ? basic.get({ plain: true }) : basic;
  const roleKey = normalizeRoleKey(plain.role, plain.teacherLevel, plain.staffLevel);
  const [rolePermissionsRows, overrideRows, scopeRows, tableFirst, jsonFirst] = await Promise.all([
    getRolePermissions(roleKey),
    getUserOverrides(uid),
    getUserScopes(uid),
    buildEffectiveAccessTableFirst({
      userId: uid,
      role: plain.role,
      teacherLevel: plain.teacherLevel,
      staffLevel: plain.staffLevel,
      jsonPermissions: plain.permissions || null,
      jsonScopes: Array.isArray(plain.scopes) ? plain.scopes : null,
    }),
    buildEffectiveAccessJsonFirst({
      userId: uid,
      role: plain.role,
      teacherLevel: plain.teacherLevel,
      staffLevel: plain.staffLevel,
      jsonPermissions: plain.permissions || null,
      jsonScopes: Array.isArray(plain.scopes) ? plain.scopes : null,
    }),
  ]);

  const userLike = {
    id: plain.id,
    role: plain.role,
    teacherLevel: plain.role === 'teacher' ? (plain.teacherLevel || 'regular') : null,
    staffLevel: plain.role === 'office_staff' ? (plain.staffLevel || 'event_lead') : null,
    permissions: plain.permissions || null,
    scopes: Array.isArray(plain.scopes) ? plain.scopes : null,
  };
  const profile = buildAccessProfile(userLike);

  const roleBaseSet = buildBasePermissionSet(userLike);
  const roleBase = sortUnique(Array.from(roleBaseSet));

  const allowList = [];
  const denyList = [];
  for (const row of overrideRows || []) {
    if (row.value === 'allow') allowList.push(row.permission);
    else if (row.value === 'deny') denyList.push(row.permission);
  }

  const jsonPermKeys =
    plain.permissions && typeof plain.permissions === 'object'
      ? sortUnique(Object.keys(plain.permissions))
      : [];

  const diff = diffAccess(tableFirst, jsonFirst);
  const data = {
    table: { rolePermissions: rolePermissionsRows, overrides: overrideRows, scopes: scopeRows },
    effective: { tableFirst, jsonFirst },
  };
  const fallback = analyzeFallback(tableFirst, jsonFirst);

  const diagnostics = [];
  if (diff.permissionsOnlyInTable.length || diff.permissionsOnlyInJson.length) {
    diagnostics.push({
      level: 'warning',
      code: 'FRONTEND_BACKEND_PERMISSION_MISMATCH',
      message:
        'table_first 與 json_first 有效權限集合不一致，請檢查 role_permissions／override 與 JSON mirror。',
    });
  }
  if (fallback.mismatch) {
    diagnostics.push({
      level: 'warning',
      code: 'PERMISSION_OVERRIDE_SOURCE_MISMATCH',
      message: 'Table 與 JSON 權限覆寫內容不一致（consistency.hasMismatch）。',
    });
  }
  if (fallback.required) {
    diagnostics.push({
      level: 'info',
      code: 'JSON_FALLBACK_IN_USE',
      message: fallback.reason || 'JSON fallback 使用中',
    });
  }

  const readMode = getAccessProfileReadMode();
  const canonical =
    readMode === 'table_first'
      ? sortUnique(tableFirst?.finalPermissions || [])
      : sortUnique(jsonFirst?.finalPermissions || []);

  return {
    teacher: {
      id: plain.id,
      username: plain.username,
      name: plain.name,
      email: plain.email,
      role: plain.role,
      teacherLevel: plain.teacherLevel || null,
      staffLevel: plain.staffLevel || null,
      isActive: !!plain.isActive,
      mustResetPassword: !!plain.mustResetPassword,
      accessVersion: Number(plain.accessVersion || 1),
      lastLoginAt: plain.lastLoginAt || null,
    },
    effectiveAccess: {
      readMode,
      permissions: sortUnique(profile.finalPermissions || canonical),
      scopes: profile.finalScopes || [],
    },
    sources: {
      roleBase,
      teacherLevelBase: [],
      rolePermissionsTable: sortUnique((rolePermissionsRows || []).map((r) => r.permission)),
      userPermissionOverridesAllow: sortUnique(allowList),
      userPermissionOverridesDeny: sortUnique(denyList),
      jsonPermissions: jsonPermKeys,
      jwtPermissions: null,
      scopeSources: {
        userScopeRows: (scopeRows || []).map((s) => `${s.scopeType}:${s.scopeValue}`),
        jsonScopes: Array.isArray(plain.scopes) ? plain.scopes : [],
      },
    },
    diagnostics,
    staleTokenCheck: {
      currentDbAccessVersion: Number(plain.accessVersion || 1),
      sampleJwtAccessVersion: null,
      note: 'JWT accessVersion 需由客戶端比對；此處僅顯示 DB 目前版本。',
    },
  };
}

function explainPermission(permission, ctx) {
  const base = sortUnique((ctx?.table?.rolePermissions || []).map((r) => r.permission));
  const overrides = ctx?.table?.overrides || [];
  const matchedOverride = overrides.find((o) => o.permission === permission);
  const tableEffective = sortUnique(ctx?.effective?.tableFirst?.finalPermissions || []);
  const jsonEffective = sortUnique(ctx?.effective?.jsonFirst?.finalPermissions || []);
  return {
    permission,
    inRoleBase: base.includes(permission),
    override: matchedOverride ? { value: matchedOverride.value, source: matchedOverride.source || null } : null,
    inTableFirstEffective: tableEffective.includes(permission),
    inJsonFirstEffective: jsonEffective.includes(permission),
  };
}

module.exports = {
  normalizeRoleKey,
  getUserBasicInfo,
  loadUserForAccessDebug,
  getRolePermissions,
  getUserOverrides,
  getUserScopes,
  getJsonPermissions,
  getJsonScopes,
  buildEffectiveAccessTableFirst,
  buildEffectiveAccessJsonFirst,
  buildAccessDebugApiPayload,
  diffAccess,
  analyzeFallback,
  generateSuggestion,
  explainPermission,
};

