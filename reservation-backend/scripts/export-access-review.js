/* eslint-disable no-console */
/**
 * 匯出帳號權限審查資料（唯讀）。不含 password hash、token、secret。
 * node scripts/export-access-review.js --format=csv
 * node scripts/export-access-review.js --format=json
 */
const { Teacher } = require('../models');
const { resolveEffectiveAccessSources, buildAccessProfile } = require('../auth/accessProfile');
const { SYSTEM_ONLY_ASSIGNMENT_KEYS } = require('../auth/permissionAssignmentPolicy');
const { getUserOverrides } = require('../services/accessControl/readService');
const { formatTaipeiTime } = require('../utils/time');

function parseArgs(argv) {
  const out = { format: 'csv' };
  for (const raw of argv.slice(2)) {
    if (raw.startsWith('--format=')) out.format = raw.slice('--format='.length).toLowerCase();
  }
  if (!['csv', 'json'].includes(out.format)) {
    console.error('請使用 --format=csv 或 --format=json');
    process.exit(1);
  }
  return out;
}

function csvEscape(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function summarizeOverrides(ovObj) {
  if (!ovObj || typeof ovObj !== 'object' || !Object.keys(ovObj).length) return '';
  return Object.entries(ovObj)
    .map(([k, v]) => `${k}:${v === true ? 'allow' : v === false ? 'deny' : String(v)}`)
    .join(';');
}

async function run() {
  const { format } = parseArgs(process.argv);
  try {
    const rows = await Teacher.findAll({
      attributes: [
        'id',
        'username',
        'name',
        'email',
        'role',
        'teacherLevel',
        'staffLevel',
        'workerLevel',
        'isActive',
        'mustResetPassword',
        'lastLoginAt',
        'accessVersion',
        'permissions',
        'scopes',
      ],
      order: [['id', 'ASC']],
    });

    const systemSet = new Set(SYSTEM_ONLY_ASSIGNMENT_KEYS);
    const records = [];

    for (const t of rows) {
      const plain = t.get({ plain: true });
      const resolved = await resolveEffectiveAccessSources(plain);
      const profile = buildAccessProfile(resolved);
      const effective = (profile.finalPermissions || []).sort();
      const systemOnlyHeld = effective.filter((p) => systemSet.has(p));
      const tableOverrides = await getUserOverrides(plain.id);
      const overrideSummary = summarizeOverrides(tableOverrides);

      records.push({
        id: plain.id,
        username: plain.username,
        name: plain.name || '',
        email: plain.email || '',
        role: plain.role || '',
        teacherLevel: plain.teacherLevel || '',
        staffLevel: plain.staffLevel || '',
        workerLevel: plain.workerLevel || '',
        isActive: plain.isActive ? 'true' : 'false',
        mustResetPassword: plain.mustResetPassword ? 'true' : 'false',
        lastLoginAt: plain.lastLoginAt ? new Date(plain.lastLoginAt).toISOString() : '',
        accessVersion: plain.accessVersion != null ? String(plain.accessVersion) : '',
        effectivePermissionsSummary: effective.join(';'),
        systemOnlyPermissions: systemOnlyHeld.join(';'),
        overridesSummary: overrideSummary || '(none)',
      });
    }

    if (format === 'json') {
      console.log(JSON.stringify({ exportedAt: formatTaipeiTime(), count: records.length, teachers: records }, null, 2));
      process.exit(0);
      return;
    }

    const headers = [
      'id',
      'username',
      'name',
      'email',
      'role',
      'teacherLevel',
      'staffLevel',
      'workerLevel',
      'isActive',
      'mustResetPassword',
      'lastLoginAt',
      'accessVersion',
      'effectivePermissionsSummary',
      'systemOnlyPermissions',
      'overridesSummary',
    ];
    const lines = [headers.join(',')];
    for (const r of records) {
      lines.push(headers.map((h) => csvEscape(r[h])).join(','));
    }
    process.stdout.write(`\ufeff${lines.join('\n')}\n`);
    process.exit(0);
  } catch (e) {
    const name = e && e.name ? e.name : '';
    const msg = e && e.message ? e.message : String(e);
    console.error('[export-access-review] 無法完成匯出（請確認 .env 與資料庫可連線）。');
    if (name) console.error('錯誤類型：', name);
    console.error('詳情：', msg);
    process.exit(1);
  }
}

run();
