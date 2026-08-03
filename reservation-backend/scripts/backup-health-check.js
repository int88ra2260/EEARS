#!/usr/bin/env node
/**
 * 備份健康檢查：確認最近 mysqldump 備份檔存在且未逾期。
 * 不讀取備份內容、不輸出 DB 密碼。
 *
 * 使用方式：
 *   node scripts/backup-health-check.js
 *   node scripts/backup-health-check.js --verbose
 *
 * 環境變數：BACKUP_HEALTH_DIR、BACKUP_HEALTH_MAX_AGE_HOURS、BACKUP_HEALTH_PATTERN
 */

require('dotenv').config();
const {
  evaluateBackupHealth,
  formatBackupHealthReport,
} = require('../utils/backupHealthCheck');

const verbose = process.argv.includes('--verbose');

function main() {
  const result = evaluateBackupHealth();
  console.log(formatBackupHealthReport(result, { verbose }));
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { main };
