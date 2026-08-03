/* eslint-disable no-console */
const {
  normalizeRoleKey,
  getUserBasicInfo,
  getRolePermissions,
  getUserOverrides,
  getUserScopes,
  buildEffectiveAccessTableFirst,
  buildEffectiveAccessJsonFirst,
  buildAccessDebugApiPayload,
  diffAccess,
  analyzeFallback,
  generateSuggestion,
  explainPermission,
} = require('../services/accessControl/debugService');

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith('--')) continue;
    const [k, v] = raw.slice(2).split('=');
    args[k] = v === undefined ? true : v;
  }
  return args;
}

function printList(title, list, prefix = '  - ') {
  console.log(title);
  if (!list || !list.length) {
    console.log('  (none)');
    return;
  }
  list.forEach((v) => console.log(`${prefix}${v}`));
}

function kv(title, value) {
  console.log(`${title}: ${value != null ? value : '(null)'}`);
}

async function run() {
  const args = parseArgs(process.argv);
  const userId = Number(args.userId);
  const verbose = Boolean(args.verbose);
  const asJson = Boolean(args.json);
  const permission = args.permission ? String(args.permission) : null;
  const tokenVersion = args.tokenVersion != null ? Number(args.tokenVersion) : null;

  if (!Number.isFinite(userId) || userId <= 0) {
    console.error(
      '用法：node scripts/debug-access.js --userId=123 [--verbose] [--json] [--permission=can_xxx] [--tokenVersion=5]'
    );
    process.exit(1);
  }

  if (asJson) {
    const apiPayload = await buildAccessDebugApiPayload(userId);
    if (!apiPayload) {
      console.error(`找不到 userId=${userId}`);
      process.exit(2);
    }
    console.log(JSON.stringify(apiPayload, null, 2));
    return;
  }

  const basic = await getUserBasicInfo(userId);
  if (!basic) {
    console.error(`找不到 userId=${userId}`);
    process.exit(2);
  }

  const roleKey = normalizeRoleKey(basic.role, basic.teacherLevel, basic.staffLevel);
  const [rolePermissionsRows, overrideRows, scopeRows, tableFirst, jsonFirst] = await Promise.all([
    getRolePermissions(roleKey),
    getUserOverrides(userId),
    getUserScopes(userId),
    buildEffectiveAccessTableFirst({
      userId,
      role: basic.role,
      teacherLevel: basic.teacherLevel,
      staffLevel: basic.staffLevel,
      jsonPermissions: basic.permissions || null,
      jsonScopes: Array.isArray(basic.scopes) ? basic.scopes : null,
    }),
    buildEffectiveAccessJsonFirst({
      userId,
      role: basic.role,
      teacherLevel: basic.teacherLevel,
      staffLevel: basic.staffLevel,
      jsonPermissions: basic.permissions || null,
      jsonScopes: Array.isArray(basic.scopes) ? basic.scopes : null,
    }),
  ]);

  const diff = diffAccess(tableFirst, jsonFirst);
  const fallback = analyzeFallback(tableFirst, jsonFirst);
  const data = {
    basic,
    tokenVersion,
    table: { rolePermissions: rolePermissionsRows, overrides: overrideRows, scopes: scopeRows },
    effective: { tableFirst, jsonFirst },
  };
  const suggestions = generateSuggestion(diff, data);

  console.log('========== EEARS ACCESS DEBUG ==========');
  kv('User', basic.id);
  kv('Role', basic.role);
  kv('TeacherLevel', basic.teacherLevel || 'regular');
  kv('StaffLevel', basic.staffLevel || '(null)');
  kv('RoleKey', roleKey);
  kv('AccessVersion(DB)', basic.accessVersion);
  if (tokenVersion != null) kv('TokenVersion(input)', tokenVersion);
  console.log('');

  console.log('---------- TABLE SOURCE ----------');
  printList('RolePermissions:', rolePermissionsRows.map((r) => r.permission));
  console.log('Overrides:');
  if (!overrideRows.length) {
    console.log('  (none)');
  } else {
    overrideRows.forEach((o) => console.log(`  ${o.value === 'allow' ? '+' : '-'} ${o.permission} (${o.value})`));
  }
  printList('Scopes:', scopeRows.map((s) => `${s.scopeType}:${s.scopeValue}`));
  console.log('');

  console.log('---------- JSON SOURCE ----------');
  printList('Permissions(JSON overrides):', Object.entries(basic.permissions || {}).map(([k, v]) => `${k}=${v}`));
  printList('Scopes(JSON):', Array.isArray(basic.scopes) ? basic.scopes : []);
  console.log('');

  console.log('---------- EFFECTIVE ACCESS ----------');
  printList('Table-first:', tableFirst.finalPermissions || []);
  printList('Json-first:', jsonFirst.finalPermissions || []);
  console.log('');

  console.log('---------- DIFF ----------');
  printList('Permissions only in table:', diff.permissionsOnlyInTable, '  + ');
  printList('Permissions only in JSON:', diff.permissionsOnlyInJson, '  + ');
  printList('Scopes only in table:', diff.scopesOnlyInTable, '  + ');
  printList('Scopes only in JSON:', diff.scopesOnlyInJson, '  + ');
  console.log('');

  console.log('---------- FALLBACK ANALYSIS ----------');
  kv('JSON fallback', fallback.required ? 'REQUIRED' : 'NOT REQUIRED');
  kv('Table source', fallback.source);
  kv('Reason', fallback.reason);
  kv('Table/JSON mismatch', fallback.mismatch ? 'YES' : 'NO');
  console.log('');

  if (permission) {
    const explain = explainPermission(permission, data);
    console.log('---------- PERMISSION EXPLAIN ----------');
    kv('Permission', explain.permission);
    kv('In role base', explain.inRoleBase ? 'YES' : 'NO');
    kv('Override', explain.override ? `${explain.override.value}${explain.override.source ? ` / ${explain.override.source}` : ''}` : '(none)');
    kv('In table-first effective', explain.inTableFirstEffective ? 'YES' : 'NO');
    kv('In json-first effective', explain.inJsonFirstEffective ? 'YES' : 'NO');
    console.log('');
  }

  console.log('---------- SUGGESTION ----------');
  suggestions.forEach((s) => console.log(`- ${s}`));
  console.log('');

  if (verbose) {
    console.log('---------- VERBOSE RAW ----------');
    console.log(JSON.stringify({
      basic,
      roleKey,
      rolePermissionsRows,
      overrideRows,
      scopeRows,
      tableFirst,
      jsonFirst,
      diff,
      fallback,
    }, null, 2));
  }
}

run().catch((err) => {
  console.error('[debug-access] fatal', err);
  process.exit(99);
});

