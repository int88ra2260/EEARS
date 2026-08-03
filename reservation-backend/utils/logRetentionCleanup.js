const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { getLogRetentionConfig, cutoffDateFromDays } = require('./logRetentionConfig');

async function countOldRows(model, beforeDate) {
  return model.count({ where: { createdAt: { [Op.lt]: beforeDate } } });
}

async function deleteOldRows(model, beforeDate, dryRun) {
  const total = await countOldRows(model, beforeDate);
  if (!total || dryRun) {
    return { total, deleted: 0, dryRun };
  }
  const deleted = await model.destroy({ where: { createdAt: { [Op.lt]: beforeDate } } });
  return { total, deleted, dryRun: false };
}

async function archiveAuditLogsToFile({ AuditLog, beforeDate, outFile, batchSize = 1000, dryRun }) {
  const where = { createdAt: { [Op.lt]: beforeDate } };
  const total = await AuditLog.count({ where });
  if (!total) {
    return { total: 0, archived: 0, outFile: null, dryRun };
  }
  if (dryRun) {
    return { total, archived: 0, outFile, dryRun: true };
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  if (fs.existsSync(outFile)) fs.unlinkSync(outFile);

  let lastId = 0;
  let archived = 0;

  while (true) {
    const rows = await AuditLog.findAll({
      where: { ...where, id: { [Op.gt]: lastId } },
      order: [['id', 'ASC']],
      limit: batchSize,
    });
    if (!rows.length) break;
    const lines = rows.map((r) => JSON.stringify(r.get({ plain: true }))).join('\n') + '\n';
    fs.appendFileSync(outFile, lines, 'utf8');
    archived += rows.length;
    lastId = rows[rows.length - 1].id;
  }

  return { total, archived, outFile, dryRun: false };
}

/**
 * 規劃／執行日誌清理（不含密碼等敏感欄位處理；刪除僅在 dryRun=false）
 */
async function runLogRetentionCleanup({
  models,
  dryRun = true,
  now = new Date(),
  config = getLogRetentionConfig(),
  archivesDir = path.join(__dirname, '../archives/audit-logs'),
}) {
  const { AuditLog, EmailLog, SystemLog } = models;
  const systemBefore = cutoffDateFromDays(config.systemDays, now);
  const emailBefore = cutoffDateFromDays(config.emailDays, now);
  const auditBefore = cutoffDateFromDays(config.auditDays, now);

  const result = {
    dryRun,
    config,
    cutoffs: {
      systemBefore,
      emailBefore,
      auditBefore,
    },
    system_logs: null,
    email_logs: null,
    audit_logs: { mode: config.auditCleanupMode, skipped: false, action: null },
    warnings: [...(config.warnings || [])],
  };

  const [systemRes, emailRes] = await Promise.all([
    deleteOldRows(SystemLog, systemBefore, dryRun),
    deleteOldRows(EmailLog, emailBefore, dryRun),
  ]);
  result.system_logs = systemRes;
  result.email_logs = emailRes;

  if (config.auditCleanupMode === 'keep') {
    result.audit_logs = {
      mode: 'keep',
      skipped: true,
      action: 'none',
      message: 'audit_logs 依設定保留，未刪除也未匯出',
    };
    return result;
  }

  if (config.auditCleanupMode === 'archive') {
    const outFile = path.join(
      archivesDir,
      `audit-logs-before-${auditBefore.toISOString().slice(0, 10)}.jsonl`
    );
    const archiveRes = await archiveAuditLogsToFile({
      AuditLog,
      beforeDate: auditBefore,
      outFile,
      dryRun,
    });
    result.audit_logs = {
      mode: 'archive',
      skipped: false,
      action: dryRun ? 'would_archive' : 'archived',
      ...archiveRes,
    };

    if (config.auditDeleteAfterArchive && !dryRun) {
      const del = await deleteOldRows(AuditLog, auditBefore, false);
      result.audit_logs.deleteAfterArchive = del;
    }
    return result;
  }

  if (config.auditCleanupMode === 'delete') {
    const del = await deleteOldRows(AuditLog, auditBefore, dryRun);
    result.audit_logs = {
      mode: 'delete',
      skipped: false,
      action: dryRun ? 'would_delete' : 'deleted',
      ...del,
    };
    return result;
  }

  return result;
}

module.exports = {
  runLogRetentionCleanup,
  deleteOldRows,
  archiveAuditLogsToFile,
};
