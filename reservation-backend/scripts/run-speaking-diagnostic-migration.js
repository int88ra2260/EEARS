'use strict';

require('dotenv').config();
const { sequelize } = require('../models');
const migration = require('../migrations/20261001170000-create-speaking-diagnostic-tables');

async function main() {
  const qi = sequelize.getQueryInterface();
  await migration.up(qi, sequelize.constructor);
  console.log('[speaking:diagnostic:migrate] speaking diagnostic tables are ready');
}

main()
  .catch((err) => {
    console.error('[speaking:diagnostic:migrate] failed:', err && err.message ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
