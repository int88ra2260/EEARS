/* eslint-disable no-console */
'use strict';

/**
 * 檢查 teachers JSON（legacy）與 table（SoT）是否語意一致。
 * 用法：
 *   npm run access:check-consistency
 *   npm run access:check-consistency -- --include-order-noise
 */
const { Teacher, UserPermissionOverride, UserScope } = require('../models');
const { P } = require('../auth/permissions');
const { ALL_SCOPES } = require('../auth/scopes');
const { buildEffectiveAccessFromSources } = require('../services/accessControl/readService');
const {
  buildSourceConsistency,
  canonicalizePermissionOverrides,
  canonicalizeScopes,
} = require('../services/accessControl/sourceConsistency');

function parseArgs(argv) {
  return {
    includeOrderNoise: argv.includes('--include-order-noise'),
  };
}

function jsonOverridesToBoolMap(json) {
  if (!json || typeof json !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(json)) {
    if (!Object.values(P).includes(k)) continue;
    if (v === true || v === false) out[k] = v;
  }
  return out;
}

function tableOverrideRowsToBoolMap(rows) {
  const out = {};
  for (const row of rows || []) {
    if (!Object.values(P).includes(row.permission)) continue;
    if (row.value === 'allow') out[row.permission] = true;
    else if (row.value === 'deny') out[row.permission] = false;
  }
  return out;
}

function normalizeJsonScopes(scopes) {
  if (!Array.isArray(scopes)) return [];
  return canonicalizeScopes(scopes.filter((s) => typeof s === 'string' && ALL_SCOPES.includes(s)));
}

async function run() {
  const { includeOrderNoise } = parseArgs(process.argv.slice(2));
  const teachers = await Teacher.findAll({
    attributes: ['id', 'role', 'teacherLevel', 'staffLevel', 'workerLevel', 'permissions', 'scopes'],
    order: [['id', 'ASC']],
  });
  const userIds = teachers.map((t) => t.id);

  const [overrideRows, scopeRows] = await Promise.all([
    UserPermissionOverride.findAll({ where: { userId: userIds }, attributes: ['userId', 'permission', 'value'] }),
    UserScope.findAll({ where: { userId: userIds }, attributes: ['userId', 'scopeType', 'scopeValue'] }),
  ]);

  const ovMap = new Map();
  for (const row of overrideRows) {
    if (!ovMap.has(row.userId)) ovMap.set(row.userId, []);
    ovMap.get(row.userId).push(row);
  }

  const scMap = new Map();
  for (const row of scopeRows) {
    if (row.scopeType !== 'event') continue;
    if (!scMap.has(row.userId)) scMap.set(row.userId, []);
    scMap.get(row.userId).push(row.scopeValue);
  }

  const semanticDiffs = [];
  const orderOnlyNoise = [];
  const effectiveDiffs = [];
  const staleJsonEqual = [];

  for (const t of teachers) {
    const jsonPerm = jsonOverridesToBoolMap(t.permissions);
    const tabPerm = tableOverrideRowsToBoolMap(ovMap.get(t.id) || []);
    const jsonScopes = normalizeJsonScopes(t.scopes);
    const tabScopes = canonicalizeScopes(scMap.get(t.id) || []);

    const consistency = buildSourceConsistency({
      tablePermissionOverrides: tabPerm,
      fallbackPermissionOverrides: jsonPerm,
      tableScopeOverrides: tabScopes,
      fallbackScopeOverrides: jsonScopes,
    });

    const rawOrderNoise =
      !consistency.hasMismatch
      && (
        JSON.stringify(t.permissions || {}) !== JSON.stringify(canonicalizePermissionOverrides(jsonPerm))
        || (Array.isArray(t.scopes) && JSON.stringify(t.scopes) !== JSON.stringify(jsonScopes))
      );

    if (consistency.hasMismatch) {
      semanticDiffs.push({
        userId: t.id,
        role: t.role,
        permissionOverrideKeyDiff: consistency.permissionOverrideKeyDiff,
        scopeKeyDiff: consistency.scopeKeyDiff,
        permissionOverrideDiff: consistency.permissionOverrideDiff,
        scopeDiff: consistency.scopeDiff,
      });
    } else if (
      (Object.keys(jsonPerm).length > 0 || jsonScopes.length > 0)
      && (Object.keys(tabPerm).length > 0 || tabScopes.length > 0)
    ) {
      // table 與 JSON 語意相同但仍殘留 JSON → Phase 3.3 可清掉以消 fallback 噪音
      staleJsonEqual.push({ userId: t.id, role: t.role });
    }

    if (includeOrderNoise && rawOrderNoise) {
      orderOnlyNoise.push({ userId: t.id });
    }

    const [jsonMode, tableMode] = await Promise.all([
      buildEffectiveAccessFromSources({
        userId: t.id,
        role: t.role,
        teacherLevel: t.teacherLevel,
        staffLevel: t.staffLevel,
        workerLevel: t.workerLevel,
        jsonPermissions: t.permissions || null,
        jsonScopes: Array.isArray(t.scopes) ? t.scopes : null,
        mode: 'json_first',
      }),
      buildEffectiveAccessFromSources({
        userId: t.id,
        role: t.role,
        teacherLevel: t.teacherLevel,
        staffLevel: t.staffLevel,
        workerLevel: t.workerLevel,
        jsonPermissions: t.permissions || null,
        jsonScopes: Array.isArray(t.scopes) ? t.scopes : null,
        mode: 'table_first',
      }),
    ]);

    const effectiveConsistency = buildSourceConsistency({
      tablePermissionOverrides: tableMode.permissionOverrides || {},
      fallbackPermissionOverrides: jsonMode.permissionOverrides || {},
      tableScopeOverrides: tableMode.scopeOverrides || [],
      fallbackScopeOverrides: jsonMode.scopeOverrides || [],
    });
    const finalPermEqual =
      JSON.stringify([...(tableMode.finalPermissions || [])].sort())
      === JSON.stringify([...(jsonMode.finalPermissions || [])].sort());

    if (effectiveConsistency.hasMismatch || !finalPermEqual) {
      effectiveDiffs.push({
        userId: t.id,
        role: t.role,
        teacherLevel: t.teacherLevel || null,
        diff: {
          permissionOverrideKeyDiff: effectiveConsistency.permissionOverrideKeyDiff,
          scopeKeyDiff: effectiveConsistency.scopeKeyDiff,
          finalPermissions: {
            jsonFirst: [...(jsonMode.finalPermissions || [])].sort(),
            tableFirst: [...(tableMode.finalPermissions || [])].sort(),
          },
        },
      });
    }
  }

  console.log(JSON.stringify({
    sourceOfTruth: 'table',
    totalUsers: teachers.length,
    semanticDiffUsers: semanticDiffs.length,
    effectiveDiffUsers: effectiveDiffs.length,
    staleJsonEqualUsers: staleJsonEqual.length,
    orderOnlyNoiseUsers: includeOrderNoise ? orderOnlyNoise.length : undefined,
    hint: staleJsonEqual.length
      ? '語意相同但仍有 JSON 殘留：可執行 npm run access:clear-stale-json:apply'
      : undefined,
    semanticDiffs: semanticDiffs.slice(0, 200),
    effectiveDiffs: effectiveDiffs.slice(0, 200),
    staleJsonEqual: staleJsonEqual.slice(0, 200),
    orderOnlyNoise: includeOrderNoise ? orderOnlyNoise.slice(0, 200) : undefined,
  }, null, 2));
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[consistency] fatal', err);
    process.exit(1);
  });
