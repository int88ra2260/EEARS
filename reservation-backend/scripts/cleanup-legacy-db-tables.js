'use strict';

/**
 * 清理已確認不再使用的 legacy 資料表。
 *
 * 用法：
 *   node scripts/cleanup-legacy-db-tables.js --dry-run
 *   node scripts/cleanup-legacy-db-tables.js
 *
 * 不會刪除：sequelizemeta、Users/users、現行 model 對應表、空但仍在 schema 的功能表。
 */

const sequelize = require('../db');

/** @type {Array<{ name: string; reason: string }>} */
const LEGACY_TABLES = [
  { name: 'user', reason: '早期單數使用者表（2 筆測試資料），現行為 Users' },
  { name: 'classmemberships', reason: '舊版班級成員表（已無資料），現行為 class_memberships' },
  { name: 'systemsettings', reason: '空表，與 SystemSettings 重複' },
  { name: 'englishtablesurveyresponse', reason: '舊版問卷回應表（空），現行為 english_table_survey_responses' },
  { name: 'english_table_surveys', reason: '舊版問卷定義表（2 筆），已由 survey 模組取代' },
  {
    name: 'et_exam_attempts_dedupe_bak_20260420',
    reason: '20260420 英檢去重 migration 備份表',
  },
  {
    name: 'et_exam_attempt_scores_dedupe_bak_20260420',
    reason: '20260420 英檢去重 migration 備份表',
  },
  {
    name: 'et_exam_attempt_skill_scores_dedupe_bak_20260420',
    reason: '20260420 英檢去重 migration 備份表',
  },
];

async function tableExists(tableName) {
  const [rows] = await sequelize.query(
    `
    SELECT COUNT(*) AS cnt
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName
    `,
    { replacements: { tableName } }
  );
  return rows[0].cnt > 0;
}

async function getTableStats(tableName) {
  const [rows] = await sequelize.query(
    `
    SELECT TABLE_ROWS AS rowEstimate,
      ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS totalMB
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName
    `,
    { replacements: { tableName } }
  );
  return rows[0] || { rowEstimate: null, totalMB: 0 };
}

async function listForeignKeyNames(tableName) {
  const [rows] = await sequelize.query(
    `
    SELECT DISTINCT kcu.CONSTRAINT_NAME AS name
    FROM information_schema.KEY_COLUMN_USAGE kcu
    INNER JOIN information_schema.TABLE_CONSTRAINTS tc
      ON tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
      AND tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      AND tc.TABLE_NAME = kcu.TABLE_NAME
      AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
    WHERE kcu.TABLE_SCHEMA = DATABASE()
      AND kcu.TABLE_NAME = :tableName
    `,
    { replacements: { tableName } }
  );
  return rows.map((row) => row.name);
}

async function cleanupLegacyTables({ dryRun = false } = {}) {
  const dialect = sequelize.getDialect();
  if (dialect !== 'mysql') {
    console.log('非 MySQL，略過');
    return { dropped: [], skipped: [] };
  }

  const dropped = [];
  const skipped = [];
  let freedMB = 0;

  for (const { name, reason } of LEGACY_TABLES) {
    const exists = await tableExists(name);
    if (!exists) {
      skipped.push({ name, reason: '表已不存在' });
      continue;
    }

    const stats = await getTableStats(name);
    const incoming = await sequelize.query(
      `
      SELECT COUNT(*) AS cnt
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = :tableName
      `,
      { replacements: { tableName: name } }
    );
    const referencedBy = incoming[0][0].cnt;
    if (referencedBy > 0) {
      skipped.push({ name, reason: `仍有 ${referencedBy} 個外鍵指向此表，跳過` });
      continue;
    }

    const fkNames = await listForeignKeyNames(name);
    console.log(
      `${dryRun ? '[DRY RUN] ' : ''}DROP ${name} | rows~${stats.rowEstimate} | ${stats.totalMB}MB | outFK=${fkNames.length} | ${reason}`
    );

    if (!dryRun) {
      const transaction = await sequelize.transaction();
      try {
        for (const fkName of fkNames) {
          await sequelize.getQueryInterface().removeConstraint(name, fkName, { transaction });
        }
        await sequelize.getQueryInterface().dropTable(name, { transaction });
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }

    dropped.push({ name, rowEstimate: stats.rowEstimate, totalMB: stats.totalMB, reason });
    freedMB += Number(stats.totalMB) || 0;
  }

  const summary = { dryRun, dropped, skipped, freedMB: Number(freedMB.toFixed(2)) };
  console.log(`\n--- ${dryRun ? 'DRY RUN' : '清理'}摘要 ---`);
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await sequelize.authenticate();
  await cleanupLegacyTables({ dryRun });
  await sequelize.close();
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error('❌ 失敗:', error);
    await sequelize.close().catch(() => {});
    process.exit(1);
  });
}

module.exports = { cleanupLegacyTables, LEGACY_TABLES };
