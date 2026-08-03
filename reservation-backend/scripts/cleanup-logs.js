/**
 * 日誌保留清理（env-driven；預設 dry-run，需 --apply 才寫入／刪除）
 *
 * 環境變數：
 *   SYSTEM_LOG_RETENTION_DAYS（預設 180）
 *   EMAIL_LOG_RETENTION_DAYS（預設 180）
 *   AUDIT_LOG_RETENTION_DAYS（預設 365）
 *   AUDIT_LOG_CLEANUP_MODE=keep|archive|delete（預設 keep）
 *   AUDIT_LOG_DELETE_AFTER_ARCHIVE（預設 false；僅 archive 模式且 --apply）
 *
 * 使用方式：
 *   node scripts/cleanup-logs.js              # dry-run（預設）
 *   node scripts/cleanup-logs.js --dry-run    # dry-run
 *   node scripts/cleanup-logs.js --apply      # 實際執行
 */

require('dotenv').config();
const { AuditLog, EmailLog, SystemLog } = require('../models');
const { formatTaipeiTime } = require('../utils/time');
const { getLogRetentionConfig } = require('../utils/logRetentionConfig');
const { runLogRetentionCleanup } = require('../utils/logRetentionCleanup');

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function getArg(name, defaultValue) {
  const key = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(key));
  if (!found) return defaultValue;
  return found.slice(key.length);
}

function printSection(title, data) {
  console.log(`[cleanup-logs] ${title}:`, JSON.stringify(data, null, 2));
}

async function main() {
  if (hasFlag('dry-run') && hasFlag('apply')) {
    console.error('[cleanup-logs] 不可同時使用 --dry-run 與 --apply');
    process.exit(1);
  }

  const apply = hasFlag('apply');
  const dryRun = !apply;

  const config = getLogRetentionConfig();
  const systemDaysOverride = getArg('system-days', null);
  const emailDaysOverride = getArg('email-days', null);
  const auditDaysOverride = getArg('audit-days', null);
  if (systemDaysOverride != null && systemDaysOverride !== '') {
    config.systemDays = Number(systemDaysOverride);
  }
  if (emailDaysOverride != null && emailDaysOverride !== '') {
    config.emailDays = Number(emailDaysOverride);
  }
  if (auditDaysOverride != null && auditDaysOverride !== '') {
    config.auditDays = Number(auditDaysOverride);
  }

  console.log('[cleanup-logs] mode=', dryRun ? 'DRY-RUN（未刪除資料）' : 'APPLY（將執行刪除／匯出）');
  console.log('[cleanup-logs] retention config:', config);
  for (const w of config.warnings || []) {
    console.warn('[cleanup-logs] 注意:', w);
  }

  const result = await runLogRetentionCleanup({
    models: { AuditLog, EmailLog, SystemLog },
    dryRun,
    config,
  });

  console.log('[cleanup-logs] system_logs cutoff:', formatTaipeiTime(result.cutoffs.systemBefore));
  console.log('[cleanup-logs] email_logs cutoff:', formatTaipeiTime(result.cutoffs.emailBefore));
  console.log('[cleanup-logs] audit_logs cutoff:', formatTaipeiTime(result.cutoffs.auditBefore));

  printSection('system_logs', result.system_logs);
  printSection('email_logs', result.email_logs);
  printSection('audit_logs', result.audit_logs);

  if (dryRun) {
    console.log('[cleanup-logs] 完成（dry-run）。若要實際清理請加上 --apply');
  } else {
    console.log('[cleanup-logs] 完成（已套用）');
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('[cleanup-logs] failed:', e);
      process.exit(1);
    });
}

module.exports = { main, hasFlag };
