/* eslint-disable no-console */
'use strict';

/**
 * 清除與 table 語意等價的 legacy JSON（teachers.permissions / scopes）。
 * Phase 3.3：table 為 SoT、JSON 停寫後，等價殘留只會製造 fallback 比對噪音。
 *
 * 預設 dry-run；實際寫入：
 *   npm run access:clear-stale-json:apply
 *   node scripts/clear-stale-access-json.js --apply
 * （Windows 上 `npm run … -- --apply` 有時不會把參數傳進腳本）
 */
const { Teacher, UserPermissionOverride, UserScope, sequelize } = require('../models');
const { P } = require('../auth/permissions');
const { ALL_SCOPES } = require('../auth/scopes');
const {
  isSemanticallyEqualAccess,
  canonicalizeScopes,
} = require('../services/accessControl/sourceConsistency');

function parseArgs(argv) {
  const envApply = String(process.env.ACCESS_CLEAR_STALE_JSON_APPLY || '').toLowerCase();
  const apply =
    argv.includes('--apply')
    || envApply === '1'
    || envApply === 'true';
  return { apply };
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

async function run() {
  const { apply } = parseArgs(process.argv.slice(2));
  const teachers = await Teacher.findAll({
    attributes: ['id', 'username', 'role', 'permissions', 'scopes'],
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

  const candidates = [];
  const skippedSemanticMismatch = [];

  for (const t of teachers) {
    const hasJson =
      (t.permissions && typeof t.permissions === 'object' && Object.keys(t.permissions).length > 0)
      || (Array.isArray(t.scopes) && t.scopes.length > 0);
    if (!hasJson) continue;

    const tabPerm = tableOverrideRowsToBoolMap(ovMap.get(t.id) || []);
    const tabScopes = canonicalizeScopes(
      (scMap.get(t.id) || []).filter((s) => ALL_SCOPES.includes(s))
    );
    const jsonPerm = jsonOverridesToBoolMap(t.permissions);
    const jsonScopes = canonicalizeScopes(
      Array.isArray(t.scopes) ? t.scopes.filter((s) => ALL_SCOPES.includes(s)) : []
    );

    // 僅清「語意等價」者，避免誤刪仍只存在於 JSON 的 fallback 資料
    if (!isSemanticallyEqualAccess(tabPerm, jsonPerm, tabScopes, jsonScopes)) {
      skippedSemanticMismatch.push({ userId: t.id, username: t.username, role: t.role });
      continue;
    }

    // 至少一邊有 table 資料，或兩邊皆空覆寫但 JSON 仍非 null → 可清
    candidates.push({ userId: t.id, username: t.username, role: t.role });
  }

  if (!apply) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      wouldClear: candidates.length,
      skippedSemanticMismatch: skippedSemanticMismatch.length,
      candidates: candidates.slice(0, 200),
      skipped: skippedSemanticMismatch.slice(0, 50),
      hint: '請改跑 npm run access:clear-stale-json:apply（Windows 上 -- --apply 可能傳不進腳本）',
    }, null, 2));
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    for (const c of candidates) {
      await Teacher.update(
        { permissions: null, scopes: null },
        { where: { id: c.userId }, transaction }
      );
    }
    await transaction.commit();
    console.log(JSON.stringify({
      mode: 'applied',
      cleared: candidates.length,
      skippedSemanticMismatch: skippedSemanticMismatch.length,
      clearedUserIds: candidates.map((c) => c.userId),
    }, null, 2));
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[clear-stale-access-json] fatal', err);
    process.exit(1);
  });
