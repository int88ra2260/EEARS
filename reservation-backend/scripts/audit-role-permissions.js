/* eslint-disable no-console */
/**
 * 唯讀比對：後端 permission keys、accessProfile 預設、DB role_permissions、前端分組。
 * 不寫入 DB。用法：node scripts/audit-role-permissions.js [--json]
 */
const path = require('path');
const fs = require('fs');
const { P, ALL_PERMISSION_KEYS } = require('../auth/permissions');
const { buildBasePermissionSet } = require('../auth/accessProfile');
const ROLE_SEEDS = [
  { role: 'admin', teacherLevel: null, staffLevel: null, roleKey: 'admin' },
  { role: 'worker', teacherLevel: null, staffLevel: null, roleKey: 'worker' },
  { role: 'leader', teacherLevel: null, staffLevel: null, roleKey: 'leader' },
  { role: 'teacher', teacherLevel: 'executive', staffLevel: null, roleKey: 'teacher:executive' },
  { role: 'teacher', teacherLevel: 'et_manager', staffLevel: null, roleKey: 'teacher:et_manager' },
  { role: 'teacher', teacherLevel: 'if_manager', staffLevel: null, roleKey: 'teacher:if_manager' },
  { role: 'teacher', teacherLevel: 'jt_manager', staffLevel: null, roleKey: 'teacher:jt_manager' },
  { role: 'teacher', teacherLevel: 'regular', staffLevel: null, roleKey: 'teacher:regular' },
  { role: 'office_staff', teacherLevel: null, staffLevel: 'event_lead', roleKey: 'office_staff:event_lead' },
  { role: 'office_staff', teacherLevel: null, staffLevel: 'curriculum_lead', roleKey: 'office_staff:curriculum_lead' },
  { role: 'office_staff', teacherLevel: null, staffLevel: 'bestep_lead', roleKey: 'office_staff:bestep_lead' },
  { role: 'office_staff', teacherLevel: null, staffLevel: 'deputy_manager', roleKey: 'office_staff:deputy_manager' },
];

/** 絕不可出現在非 admin 的 role_permissions 或程式預設 base 內（稽核／診斷／旗標） */
const STRICT_ADMIN_ONLY_KEYS = [
  P.CAN_VIEW_AUDIT_LOGS,
  P.CAN_VIEW_INTERNAL_DIAGNOSTICS,
  P.CAN_MANAGE_FEATURE_FLAGS,
];

function parseArgs(argv) {
  return argv.slice(2).includes('--json');
}

function loadGroupedKeysFromFrontendFile() {
  const fgPath = path.join(__dirname, '../../reservation-frontend/src/constants/permissionGroups.js');
  if (!fs.existsSync(fgPath)) {
    return { grouped: new Set(), error: `找不到前端 permissionGroups：${fgPath}` };
  }
  const text = fs.readFileSync(fgPath, 'utf8');
  const start = text.indexOf('export const PERMISSION_GROUPS =');
  const end = text.indexOf('export function getPermissionGroupBuckets', start);
  if (start < 0 || end < 0) {
    return { grouped: new Set(), error: '無法解析 PERMISSION_GROUPS 區塊' };
  }
  const slice = text.slice(start, end);
  const grouped = new Set();
  const re = /\bP\.(CAN_[A-Z0-9_]+)\b/g;
  let m;
  while ((m = re.exec(slice)) !== null) {
    const v = P[m[1]];
    if (v) grouped.add(v);
  }
  return { grouped, error: null };
}

function setDiff(a, b) {
  const sb = new Set(b);
  return [...a].filter((x) => !sb.has(x));
}

async function loadDbRolePermissions() {
  let RolePermission;
  try {
    ({ RolePermission } = require('../models'));
  } catch (e) {
    return { ok: false, error: `載入 models 失敗：${e.message}`, byRole: {} };
  }
  try {
    const rows = await RolePermission.findAll({
      attributes: ['role', 'permission'],
      order: [['role', 'ASC'], ['permission', 'ASC']],
    });
    const byRole = {};
    for (const r of rows) {
      const plain = r.get ? r.get({ plain: true }) : r;
      const rk = plain.role;
      if (!byRole[rk]) byRole[rk] = [];
      byRole[rk].push(plain.permission);
    }
    for (const k of Object.keys(byRole)) {
      byRole[k] = [...new Set(byRole[k])].sort();
    }
    return { ok: true, error: null, byRole };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    return {
      ok: false,
      error: `無法連線或查詢 role_permissions（請確認 .env 與 DB）：${msg}`,
      byRole: {},
    };
  }
}

function main() {
  const wantJson = parseArgs(process.argv);
  const warnings = [];
  const errors = [];
  const tables = [];

  const { grouped: groupedKeys, error: fgErr } = loadGroupedKeysFromFrontendFile();
  if (fgErr) warnings.push(fgErr);

  const orphans = ALL_PERMISSION_KEYS.filter((k) => !groupedKeys.has(k));
  if (orphans.length) {
    warnings.push(`後端有定義但前端 PERMISSION_GROUPS 未分組：${orphans.join(', ')}`);
  }

  const hardcodedByRoleKey = {};
  for (const seed of ROLE_SEEDS) {
    const set = buildBasePermissionSet({
      role: seed.role,
      teacherLevel: seed.teacherLevel,
      staffLevel: seed.staffLevel,
    });
    hardcodedByRoleKey[seed.roleKey] = sortSet(set);
  }

  for (const seed of ROLE_SEEDS) {
    if (seed.roleKey === 'admin') continue;
    const set = new Set(hardcodedByRoleKey[seed.roleKey]);
    for (const k of STRICT_ADMIN_ONLY_KEYS) {
      if (set.has(k)) {
        errors.push(`[fatal] 程式預設 base 含嚴格 admin-only 鍵「${k}」於 roleKey=${seed.roleKey}`);
      }
    }
  }

  const executiveSet = new Set(hardcodedByRoleKey['teacher:executive']);
  const adminSet = new Set(hardcodedByRoleKey.admin);
  const execExtraVsAdmin = [...executiveSet].filter((k) => !adminSet.has(k));
  if (execExtraVsAdmin.length) {
    warnings.push(`executive 較 admin 多出的鍵（僅供檢視，不一定為錯）：${execExtraVsAdmin.join(', ')}`);
  }

  const workerSet = new Set(hardcodedByRoleKey.worker);
  if (workerSet.has(P.CAN_MANAGE_ACCOUNTS) || workerSet.has(P.CAN_MANAGE_SETTINGS)) {
    warnings.push('worker 預設含帳號或系統設定類高權限，請人工複核');
  }

  const regularSet = new Set(hardcodedByRoleKey['teacher:regular']);
  const mgmtKeys = [P.CAN_MANAGE_EVENTS, P.CAN_MANAGE_ACCOUNTS, P.CAN_MANAGE_ENGLISH_TESTS];
  for (const mk of mgmtKeys) {
    if (regularSet.has(mk)) warnings.push(`teacher:regular 預設含管理鍵 ${mk}，請複核`);
  }

  return (async () => {
    try {
      const db = await loadDbRolePermissions();
      if (!db.ok) {
        warnings.push(db.error);
        tables.push({ name: 'DB', rows: [{ status: 'SKIP', detail: db.error }] });
      } else {
        const allDbPerms = new Set();
        for (const perms of Object.values(db.byRole)) {
          perms.forEach((p) => allDbPerms.add(p));
        }
        for (const p of allDbPerms) {
          if (!ALL_PERMISSION_KEYS.includes(p)) {
            errors.push(`[fatal] role_permissions 含後端未定義的 permission：${p}`);
          }
        }
        for (const [roleKey, perms] of Object.entries(db.byRole)) {
          if (roleKey === 'admin') continue;
          for (const k of STRICT_ADMIN_ONLY_KEYS) {
            if (perms.includes(k)) {
              errors.push(`[fatal] DB role_permissions 將嚴格 admin-only「${k}」給了 roleKey=${roleKey}`);
            }
          }
        }

        for (const seed of ROLE_SEEDS) {
          const hc = new Set(hardcodedByRoleKey[seed.roleKey]);
          const dbp = new Set(db.byRole[seed.roleKey] || []);
          if (dbp.size === 0 && db.ok) {
            warnings.push(`DB 無 role_permissions 列於 roleKey=${seed.roleKey}（可能尚未 seed，執行時將依 accessProfile / JSON fallback）`);
          }
          const onlyDb = sortSet(setDiff(dbp, hc));
          const onlyHc = sortSet(setDiff(hc, dbp));
          if (onlyDb.length || onlyHc.length) {
            warnings.push(
              `accessProfile 預設 vs DB「${seed.roleKey}」不一致：僅 DB 有 [${onlyDb.join(', ')}]；僅 hardcoded 有 [${onlyHc.join(', ')}]`
            );
          }
        }

        const onlyDbRoles = Object.keys(db.byRole).filter((rk) => !ROLE_SEEDS.some((s) => s.roleKey === rk));
        if (onlyDbRoles.length) {
          warnings.push(`DB 含未定義於 seed 腳本的 role 鍵：${onlyDbRoles.join(', ')}`);
        }

        const tableRows = ROLE_SEEDS.map((s) => ({
          roleKey: s.roleKey,
          dbCount: (db.byRole[s.roleKey] || []).length,
          hcCount: hardcodedByRoleKey[s.roleKey].length,
        }));
        tables.push({ name: 'roleKey 列數（DB vs hardcoded）', rows: tableRows });
      }

      const exitCode = errors.length ? 1 : 0;
      const out = {
        ok: errors.length === 0,
        exitCode,
        errors,
        warnings,
        orphans,
        tables,
        hardcodedByRoleKey,
        dbByRole: db.byRole,
      };

      if (wantJson) {
        console.log(JSON.stringify(out, null, 2));
      } else {
        console.log('=== EEARS role_permissions / accessProfile 稽核 ===\n');
        if (errors.length) {
          console.log('【錯誤】');
          errors.forEach((e) => console.log(' ', e));
          console.log('');
        }
        if (warnings.length) {
          console.log('【警告 / 資訊】');
          warnings.forEach((w) => console.log(' ', w));
          console.log('');
        }
        for (const t of tables) {
          console.log(`— ${t.name} —`);
          console.table(t.rows);
          console.log('');
        }
        console.log(`結束碼：${exitCode}（有 fatal 錯誤為 1，僅警告為 0）`);
      }
      process.exit(exitCode);
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      console.error('[audit-role-permissions] 未預期錯誤：', msg);
      process.exit(1);
    }
  })();
}

main();

function sortSet(set) {
  return Array.from(set).sort();
}
