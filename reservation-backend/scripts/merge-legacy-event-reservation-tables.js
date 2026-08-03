'use strict';

/**
 * 整併 legacy event/reservation 表至 events/reservations，並清除重複 FK。
 *
 * 用法：
 *   node scripts/merge-legacy-event-reservation-tables.js --dry-run
 *   node scripts/merge-legacy-event-reservation-tables.js
 */

const sequelize = require('../db');
const migration = require('../migrations/20260605120000-merge-legacy-event-reservation-tables');

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  await sequelize.authenticate();
  console.log(dryRun ? '開始 DRY RUN（不會寫入）…' : '開始整併 legacy event/reservation…');

  const queryInterface = sequelize.getQueryInterface();
  await migration.mergeLegacyTables(queryInterface, { dryRun });

  await sequelize.close();
}

main().catch(async (error) => {
  console.error('❌ 失敗:', error);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
