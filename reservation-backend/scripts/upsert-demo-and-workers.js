/* eslint-disable no-console */
/**
 * 維運：建立／更新 DEMO 與工讀生帳號（可略過 passwordPolicy，供中心指定短密碼）。
 *
 *   node scripts/upsert-demo-and-workers.js
 *   node scripts/upsert-demo-and-workers.js --dry-run
 *
 * 活動工讀已拆為 ET／EC／JT 三帳；原 emiptworker 會被停用。
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Teacher, sequelize } = require('../models');
const { P } = require('../auth/permissions');
const { SCOPE } = require('../auth/scopes');
const {
  bumpAccessVersion,
  syncPermissionOverrides,
  syncUserScopes,
} = require('../services/accessControl/writeService');

const DRY_RUN = process.argv.includes('--dry-run');

/** 活動工讀：關閉寫入／簽到／違規／ET 分組（與 accessProfile event_ops 範本對齊） */
const EVENT_OPS_DENY = {
  [P.CAN_MANAGE_EVENTS]: false,
  [P.CAN_MANAGE_RESERVATIONS]: false,
  [P.CAN_EXPORT_RESERVATIONS]: false,
  [P.CAN_CHECKIN_STUDENTS]: false,
  [P.CAN_VIEW_BLACKLIST]: false,
  [P.CAN_RECORD_VIOLATIONS]: false,
  [P.CAN_MANAGE_VIOLATIONS]: false,
  [P.CAN_VIEW_ET_GROUPING]: false,
  [P.CAN_EXPORT_ET_GROUPING]: false,
};

const ACCOUNTS = [
  {
    username: 'DEMO1',
    password: 'demo123',
    name: 'DEMO 展示帳號',
    email: 'demo1@emicenter.demo',
    role: 'admin',
    teacherLevel: null,
    staffLevel: null,
    workerLevel: null,
    isDemo: true,
    isActive: true,
  },
  {
    username: 'emietworker',
    password: '1219',
    name: '工讀生-ET',
    email: 'etworker@emicenter.nsysu.edu.tw',
    role: 'worker',
    teacherLevel: null,
    staffLevel: null,
    workerLevel: 'event_ops',
    isDemo: false,
    isActive: true,
    scopes: [SCOPE.ENGLISH_TABLE],
    permissions: EVENT_OPS_DENY,
  },
  {
    username: 'emiecworker',
    password: '1220',
    name: '工讀生-EC',
    email: 'ecworker@emicenter.nsysu.edu.tw',
    role: 'worker',
    teacherLevel: null,
    staffLevel: null,
    workerLevel: 'event_ops',
    isDemo: false,
    isActive: true,
    scopes: [SCOPE.ENGLISH_CLUB],
    permissions: EVENT_OPS_DENY,
  },
  {
    username: 'emijtworker',
    password: '1221',
    name: '工讀生-JT',
    email: 'jtworker@emicenter.nsysu.edu.tw',
    role: 'worker',
    teacherLevel: null,
    staffLevel: null,
    workerLevel: 'event_ops',
    isDemo: false,
    isActive: true,
    scopes: [SCOPE.JOB_TALK],
    permissions: EVENT_OPS_DENY,
  },
  {
    username: 'emiptworker',
    password: '1215',
    name: '工讀生-活動（已停用）',
    email: 'worker@emicenter.nsysu.edu.tw',
    role: 'worker',
    teacherLevel: null,
    staffLevel: null,
    workerLevel: 'event_ops',
    isDemo: false,
    isActive: false,
    disabledReason: '已拆分為 emietworker / emiecworker / emijtworker',
  },
  {
    username: 'emiptworker1',
    password: '1216',
    name: '工讀生-培力',
    email: 'worker1@emicenter.nsysu.edu.tw',
    role: 'worker',
    teacherLevel: null,
    staffLevel: null,
    workerLevel: 'bestep_ops',
    isDemo: false,
    isActive: true,
  },
  {
    username: 'emiptworker2',
    password: '1217',
    name: '工讀生-小編',
    email: 'worker2@emicenter.nsysu.edu.tw',
    role: 'worker',
    teacherLevel: null,
    staffLevel: null,
    workerLevel: 'content_editor',
    isDemo: false,
    isActive: true,
  },
  {
    username: 'emiptworker3',
    password: '1218',
    name: '工讀生-實踐歷程',
    email: 'worker3@emicenter.nsysu.edu.tw',
    role: 'worker',
    teacherLevel: null,
    staffLevel: null,
    workerLevel: 'passport_ops',
    isDemo: false,
    isActive: true,
  },
];

async function findByUsername(username, transaction) {
  const normalized = String(username).trim().toLowerCase();
  return Teacher.findOne({
    where: sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), normalized),
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

async function upsertOne(spec, transaction) {
  const hashed = await bcrypt.hash(spec.password, 12);
  const existing = await findByUsername(spec.username, transaction);
  const isActive = spec.isActive !== false;
  const scopeOverrides = Array.isArray(spec.scopes) ? spec.scopes : null;
  const permissionOverrides = spec.permissions && typeof spec.permissions === 'object'
    ? spec.permissions
    : null;

  const payload = {
    name: spec.name,
    email: spec.email,
    username: spec.username,
    password: hashed,
    role: spec.role,
    teacherLevel: spec.teacherLevel,
    staffLevel: spec.staffLevel,
    workerLevel: spec.workerLevel,
    isDemo: !!spec.isDemo,
    isActive,
    mustResetPassword: false,
    disabledReason: isActive ? null : (spec.disabledReason || null),
    scopes: scopeOverrides,
    permissions: permissionOverrides,
  };

  if (!existing) {
    if (DRY_RUN) {
      return {
        action: 'create',
        username: spec.username,
        role: spec.role,
        workerLevel: spec.workerLevel,
        isActive,
        scopes: scopeOverrides,
        isDemo: spec.isDemo,
      };
    }
    const created = await Teacher.create(payload, { transaction });
    await syncUserScopes(created.id, scopeOverrides, null, {
      transaction,
      source: 'ops_upsert_demo_workers',
    });
    await syncPermissionOverrides(created.id, permissionOverrides, null, {
      transaction,
      source: 'ops_upsert_demo_workers',
    });
    return {
      action: 'created',
      id: created.id,
      username: created.username,
      role: created.role,
      workerLevel: created.workerLevel,
      isActive: created.isActive,
      scopes: scopeOverrides,
      isDemo: created.isDemo,
    };
  }

  if (DRY_RUN) {
    return {
      action: 'update',
      id: existing.id,
      username: existing.username,
      role: spec.role,
      workerLevel: spec.workerLevel,
      isActive,
      scopes: scopeOverrides,
      isDemo: spec.isDemo,
    };
  }

  await existing.update(payload, { transaction });
  await syncUserScopes(existing.id, scopeOverrides, null, {
    transaction,
    source: 'ops_upsert_demo_workers',
  });
  await syncPermissionOverrides(existing.id, permissionOverrides, null, {
    transaction,
    source: 'ops_upsert_demo_workers',
  });
  await bumpAccessVersion(existing.id, 'ops_upsert_demo_workers', { transaction });
  await existing.reload({ transaction });
  return {
    action: 'updated',
    id: existing.id,
    username: existing.username,
    role: existing.role,
    workerLevel: existing.workerLevel,
    isActive: existing.isActive,
    scopes: scopeOverrides,
    isDemo: existing.isDemo,
    accessVersion: existing.accessVersion,
  };
}

async function run() {
  const tx = await sequelize.transaction();
  try {
    // email 衝突時：若同 email 不同 username，改用專用 email（僅新帳號）
    const summary = [];
    for (const spec of ACCOUNTS) {
      const emailOwner = await Teacher.findOne({
        where: {
          email: spec.email,
          username: { [Op.ne]: spec.username },
        },
        transaction: tx,
      });
      const effective = { ...spec };
      if (emailOwner) {
        effective.email = `${spec.username.toLowerCase()}.ops@emicenter.nsysu.edu.tw`;
      }
      summary.push(await upsertOne(effective, tx));
    }
    if (DRY_RUN) {
      await tx.rollback();
      console.log(JSON.stringify({ ok: true, dryRun: true, summary }, null, 2));
      return;
    }
    await tx.commit();
    console.log(JSON.stringify({ ok: true, dryRun: false, summary }, null, 2));
  } catch (err) {
    await tx.rollback();
    console.error('[upsert-demo-and-workers] fatal', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
