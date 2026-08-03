/* eslint-disable no-console */
const { Teacher, UserPermissionOverride, UserScope } = require('../models');
const { P } = require('../auth/permissions');
const { ALL_SCOPES } = require('../auth/scopes');
const { buildEffectiveAccessFromSources } = require('../services/accessControl/readService');

function normalizeJsonPermissions(json) {
  if (!json || typeof json !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(json)) {
    if (!Object.values(P).includes(k)) continue;
    if (v === true || v === false) out[k] = v ? 'allow' : 'deny';
  }
  return out;
}

function normalizeJsonScopes(scopes) {
  if (!Array.isArray(scopes)) return [];
  return Array.from(new Set(scopes.filter((s) => typeof s === 'string' && ALL_SCOPES.includes(s)))).sort();
}

async function run() {
  const teachers = await Teacher.findAll({
    attributes: ['id', 'role', 'teacherLevel', 'staffLevel', 'permissions', 'scopes'],
    order: [['id', 'ASC']],
  });
  const userIds = teachers.map((t) => t.id);

  const [overrideRows, scopeRows] = await Promise.all([
    UserPermissionOverride.findAll({ where: { userId: userIds }, attributes: ['userId', 'permission', 'value'] }),
    UserScope.findAll({ where: { userId: userIds }, attributes: ['userId', 'scopeType', 'scopeValue'] }),
  ]);

  const ovMap = new Map();
  for (const row of overrideRows) {
    if (!ovMap.has(row.userId)) ovMap.set(row.userId, {});
    ovMap.get(row.userId)[row.permission] = row.value;
  }

  const scMap = new Map();
  for (const row of scopeRows) {
    if (row.scopeType !== 'event') continue;
    if (!scMap.has(row.userId)) scMap.set(row.userId, []);
    scMap.get(row.userId).push(row.scopeValue);
  }

  const diffs = [];
  const effectiveDiffs = [];
  for (const t of teachers) {
    const jsonPerm = normalizeJsonPermissions(t.permissions);
    const tabPerm = ovMap.get(t.id) || {};
    const jsonScopes = normalizeJsonScopes(t.scopes);
    const tabScopes = Array.from(new Set(scMap.get(t.id) || [])).sort();

    if (JSON.stringify(jsonPerm) !== JSON.stringify(tabPerm) || JSON.stringify(jsonScopes) !== JSON.stringify(tabScopes)) {
      diffs.push({
        userId: t.id,
        permissionDiff: { json: jsonPerm, table: tabPerm },
        scopeDiff: { json: jsonScopes, table: tabScopes },
      });
    }

    const [jsonMode, tableMode] = await Promise.all([
      buildEffectiveAccessFromSources({
        userId: t.id,
        role: t.role,
        teacherLevel: t.teacherLevel,
        staffLevel: t.staffLevel,
        jsonPermissions: t.permissions || null,
        jsonScopes: Array.isArray(t.scopes) ? t.scopes : null,
        mode: 'json_first',
      }),
      buildEffectiveAccessFromSources({
        userId: t.id,
        role: t.role,
        teacherLevel: t.teacherLevel,
        staffLevel: t.staffLevel,
        jsonPermissions: t.permissions || null,
        jsonScopes: Array.isArray(t.scopes) ? t.scopes : null,
        mode: 'table_first',
      }),
    ]);
    if (
      JSON.stringify(jsonMode.permissionOverrides || {}) !== JSON.stringify(tableMode.permissionOverrides || {}) ||
      JSON.stringify(jsonMode.scopeOverrides || []) !== JSON.stringify(tableMode.scopeOverrides || []) ||
      JSON.stringify(jsonMode.finalPermissions || []) !== JSON.stringify(tableMode.finalPermissions || [])
    ) {
      effectiveDiffs.push({
        userId: t.id,
        role: t.role,
        teacherLevel: t.teacherLevel || null,
        diff: {
          permissionOverrides: { jsonFirst: jsonMode.permissionOverrides || {}, tableFirst: tableMode.permissionOverrides || {} },
          scopeOverrides: { jsonFirst: jsonMode.scopeOverrides || [], tableFirst: tableMode.scopeOverrides || [] },
          finalPermissions: { jsonFirst: jsonMode.finalPermissions || [], tableFirst: tableMode.finalPermissions || [] },
        },
      });
    }
  }

  console.log(JSON.stringify({
    totalUsers: teachers.length,
    diffUsers: diffs.length,
    effectiveDiffUsers: effectiveDiffs.length,
    diffs: diffs.slice(0, 200),
    effectiveDiffs: effectiveDiffs.slice(0, 200),
  }, null, 2));
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[consistency] fatal', err);
    process.exit(1);
  });

