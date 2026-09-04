/* eslint-disable no-console */
/**
 * 維運：建立／更新 DEMO 與工讀生帳號（可略過 passwordPolicy，供中心指定短密碼）。
 *
 *   node scripts/upsert-demo-and-workers.js
 *   node scripts/upsert-demo-and-workers.js --dry-run
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Teacher, sequelize } = require('../models');
const { bumpAccessVersion } = require('../services/accessControl/writeService');

const DRY_RUN = process.argv.includes('--dry-run');

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
  },
  {
    username: 'emiptworker',
    password: '1215',
    name: '工讀生-活動',
    email: 'worker@emicenter.nsysu.edu.tw',
    role: 'worker',
    teacherLevel: null,
    staffLevel: null,
    workerLevel: 'event_ops',
    isDemo: false,
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
    isActive: true,
    mustResetPassword: false,
    disabledReason: null,
  };

  if (!existing) {
    if (DRY_RUN) {
      return { action: 'create', username: spec.username, role: spec.role, workerLevel: spec.workerLevel, isDemo: spec.isDemo };
    }
    const created = await Teacher.create(payload, { transaction });
    return {
      action: 'created',
      id: created.id,
      username: created.username,
      role: created.role,
      workerLevel: created.workerLevel,
      isDemo: created.isDemo,
    };
  }

  if (DRY_RUN) {
    return { action: 'update', id: existing.id, username: existing.username, role: spec.role, workerLevel: spec.workerLevel, isDemo: spec.isDemo };
  }

  await existing.update(payload, { transaction });
  await bumpAccessVersion(existing.id, 'ops_upsert_demo_workers', { transaction });
  await existing.reload({ transaction });
  return {
    action: 'updated',
    id: existing.id,
    username: existing.username,
    role: existing.role,
    workerLevel: existing.workerLevel,
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
