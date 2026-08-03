/* eslint-disable no-console */
/**
 * 開發／維運用：直接調整 admin 帳號（username、密碼、姓名、Email 等）
 *
 * 用法：
 *   node scripts/admin-account-cli.js --list
 *   node scripts/admin-account-cli.js --username=admin --new-password='YourNewPass12!@'
 *   node scripts/admin-account-cli.js --id=1 --new-username=eears-admin --generate-password
 *   node scripts/admin-account-cli.js --username=admin --dry-run --new-password='TestPass12!@#'
 *
 * 選項：
 *   --list                 列出所有 role=admin 帳號（不含密碼）
 *   --id=N                 以 id 指定帳號
 *   --username=NAME        以 username 指定帳號（不分大小寫）
 *   --new-username=NAME    變更登入帳號
 *   --new-password=PWD     設定新密碼（須符合 passwordPolicy）
 *   --generate-password    自動產生 14 碼臨時密碼（與後台重設邏輯一致）
 *   --name=TEXT            變更顯示姓名
 *   --email=ADDR           變更 Email
 *   --must-reset-password=true|false  是否強制下次登入改密（預設：generate-password 時 true，自訂密碼時 false）
 *   --inactive             停用帳號
 *   --active               啟用帳號
 *   --dry-run              只顯示將變更的欄位，不寫入 DB
 *   --show-password        成功時印出明文密碼（預設 generate-password 時會印一次）
 *
 * 注意：明文密碼不會寫入稽核；請勿將輸出貼到版控或公開頻道。
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Teacher, sequelize } = require('../models');
const { bumpAccessVersion } = require('../services/accessControl/writeService');
const {
  validatePasswordPolicy,
  generateCompliantTempPassword,
  buildPasswordPolicyContext,
  PASSWORD_POLICY_USER_MESSAGE,
} = require('../utils/passwordPolicy');

function parseArgs(argv) {
  const args = { _: [] };
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith('--')) {
      args._.push(raw);
      continue;
    }
    const body = raw.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) {
      args[body] = true;
    } else {
      args[body.slice(0, eq)] = body.slice(eq + 1);
    }
  }
  return args;
}

function parseBoolFlag(value, defaultValue) {
  if (value === true || value === undefined) return defaultValue;
  const s = String(value).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return defaultValue;
}

function usage(exitCode = 1) {
  console.error(`
用法：
  npm run admin:account -- --list
  npm run admin:account -- --username=admin --new-password='YourNewPass12!@'
  npm run admin:account -- --id=1 --generate-password
  npm run admin:account -- --username=admin --new-username=eears-admin --dry-run

密碼政策：${PASSWORD_POLICY_USER_MESSAGE}
`);
  process.exit(exitCode);
}

async function listAdmins() {
  const rows = await Teacher.findAll({
    where: { role: 'admin' },
    attributes: [
      'id',
      'username',
      'name',
      'email',
      'isActive',
      'mustResetPassword',
      'lastLoginAt',
      'passwordChangedAt',
      'accessVersion',
      'createdAt',
    ],
    order: [['id', 'ASC']],
  });
  if (!rows.length) {
    console.log('目前沒有 role=admin 的帳號。');
    return;
  }
  console.log(`共 ${rows.length} 個 admin 帳號：\n`);
  for (const row of rows) {
    const t = row.get ? row.get({ plain: true }) : row;
    console.log([
      `id=${t.id}`,
      `username=${t.username}`,
      `name=${t.name}`,
      `email=${t.email}`,
      `active=${t.isActive}`,
      `mustReset=${t.mustResetPassword}`,
      `accessVersion=${t.accessVersion}`,
      `lastLogin=${t.lastLoginAt || '(never)'}`,
    ].join(' | '));
  }
}

async function resolveAdmin(args) {
  if (args.id != null) {
    const id = Number(args.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('--id 必須為正整數');
    }
    const teacher = await Teacher.findByPk(id);
    if (!teacher) throw new Error(`找不到 id=${id}`);
    if (teacher.role !== 'admin') {
      throw new Error(`id=${id} 的 role 為 ${teacher.role}，此腳本僅處理 admin`);
    }
    return teacher;
  }

  if (args.username != null) {
    const normalized = String(args.username).trim().toLowerCase();
    if (!normalized) throw new Error('--username 不可為空');
    const teacher = await Teacher.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('username')),
        normalized
      ),
    });
    if (!teacher) throw new Error(`找不到 username=${args.username}`);
    if (teacher.role !== 'admin') {
      throw new Error(`username=${teacher.username} 的 role 為 ${teacher.role}，此腳本僅處理 admin`);
    }
    return teacher;
  }

  throw new Error('請指定 --id 或 --username');
}

function buildPatch(args, teacher, plainPassword) {
  const patch = {};
  const changes = [];

  if (args['new-username'] != null) {
    const next = String(args['new-username']).trim();
    if (!next) throw new Error('--new-username 不可為空');
    if (next !== teacher.username) {
      patch.username = next;
      changes.push(`username: ${teacher.username} -> ${next}`);
    }
  }

  if (args.name != null) {
    const next = String(args.name).trim();
    if (!next) throw new Error('--name 不可為空');
    if (next !== teacher.name) {
      patch.name = next;
      changes.push(`name: ${teacher.name} -> ${next}`);
    }
  }

  if (args.email != null) {
    const next = String(args.email).trim();
    if (!next) throw new Error('--email 不可為空');
    if (next !== teacher.email) {
      patch.email = next;
      changes.push(`email: ${teacher.email} -> ${next}`);
    }
  }

  if (args.inactive) {
    if (teacher.isActive !== false) {
      patch.isActive = false;
      changes.push('isActive: true -> false');
    }
  } else if (args.active) {
    if (teacher.isActive !== true) {
      patch.isActive = true;
      patch.disabledReason = null;
      changes.push('isActive: false -> true');
    }
  }

  if (plainPassword != null) {
    patch.password = plainPassword;
    changes.push('password: (hashed update)');
    const defaultMustReset = args['generate-password'] ? true : false;
    const mustReset = parseBoolFlag(args['must-reset-password'], defaultMustReset);
    if (teacher.mustResetPassword !== mustReset) {
      patch.mustResetPassword = mustReset;
      changes.push(`mustResetPassword: ${teacher.mustResetPassword} -> ${mustReset}`);
    }
    patch.passwordChangedAt = mustReset ? null : new Date();
    changes.push(`passwordChangedAt: ${mustReset ? 'null' : 'now'}`);
  } else if (args['must-reset-password'] != null) {
    const mustReset = parseBoolFlag(args['must-reset-password'], false);
    if (teacher.mustResetPassword !== mustReset) {
      patch.mustResetPassword = mustReset;
      changes.push(`mustResetPassword: ${teacher.mustResetPassword} -> ${mustReset}`);
    }
  }

  return { patch, changes };
}

async function ensureUniqueFields(teacher, patch) {
  if (patch.username && patch.username !== teacher.username) {
    const taken = await Teacher.findOne({
      where: {
        username: patch.username,
        id: { [Op.ne]: teacher.id },
      },
    });
    if (taken) throw new Error(`username 已被使用：${patch.username}`);
  }
  if (patch.email && patch.email !== teacher.email) {
    const taken = await Teacher.findOne({
      where: {
        email: patch.email,
        id: { [Op.ne]: teacher.id },
      },
    });
    if (taken) throw new Error(`email 已被使用：${patch.email}`);
  }
}

function resolvePlainPassword(args, teacher) {
  const hasCustom = args['new-password'] != null;
  const hasGenerate = Boolean(args['generate-password']);
  if (hasCustom && hasGenerate) {
    throw new Error('不可同時使用 --new-password 與 --generate-password');
  }
  if (!hasCustom && !hasGenerate) return null;

  const context = buildPasswordPolicyContext({
    username: args['new-username'] != null ? String(args['new-username']).trim() : teacher.username,
    email: args.email != null ? String(args.email).trim() : teacher.email,
    name: args.name != null ? String(args.name).trim() : teacher.name,
    displayName: args.name != null ? String(args.name).trim() : teacher.name,
    role: teacher.role,
  });

  const plain = hasGenerate
    ? generateCompliantTempPassword(14, context)
    : String(args['new-password']);

  const policy = validatePasswordPolicy(plain, context);
  if (!policy.valid) {
    const detail = (policy.errors || []).map((e) => e.message).join('; ');
    throw new Error(`密碼不符合政策：${policy.message}${detail ? `（${detail}）` : ''}`);
  }
  return plain;
}

async function applyAdminPatch(teacher, patch, plainPassword, dryRun) {
  const sensitiveKeys = new Set(['password']);
  const displayPatch = { ...patch };
  if (displayPatch.password) displayPatch.password = '(bcrypt hash)';

  console.log(`目標：id=${teacher.id} username=${teacher.username}`);
  console.log('將寫入：', JSON.stringify(displayPatch, null, 2));

  if (dryRun) {
    console.log('\n[dry-run] 未寫入資料庫。');
    return { plainPassword };
  }

  const transaction = await sequelize.transaction();
  try {
    const updatePayload = { ...patch };
    if (plainPassword != null) {
      updatePayload.password = await bcrypt.hash(plainPassword, 12);
    }

    await teacher.update(updatePayload, { transaction });
    await bumpAccessVersion(teacher.id, 'admin_account_cli', { transaction });
    await transaction.commit();
    await teacher.reload();

    console.log(`\n已更新 admin 帳號 id=${teacher.id} username=${teacher.username} accessVersion=${teacher.accessVersion}`);
    return { plainPassword };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help || args.h) usage(0);
  if (args.list) {
    await listAdmins();
    return;
  }

  if (!args.id && !args.username) usage();

  const dryRun = Boolean(args['dry-run']);
  const teacher = await resolveAdmin(args);
  const plainPassword = resolvePlainPassword(args, teacher);
  const { patch, changes } = buildPatch(args, teacher, plainPassword);

  if (!changes.length) {
    console.log('沒有需要變更的欄位。');
    return;
  }

  console.log('變更摘要：');
  changes.forEach((line) => console.log(`  - ${line}`));

  await ensureUniqueFields(teacher, patch);
  const result = await applyAdminPatch(teacher, patch, plainPassword, dryRun);

  const showPassword = Boolean(args['show-password'] || args['generate-password']);
  if (result.plainPassword && showPassword && !dryRun) {
    console.log(`\n新密碼（請妥善保存，系統不會再次顯示）：\n${result.plainPassword}\n`);
  } else if (result.plainPassword && !dryRun) {
    console.log('\n密碼已更新（未顯示明文；可加 --show-password 於產生密碼時查看）。');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n錯誤：${err.message}`);
    process.exit(1);
  });
