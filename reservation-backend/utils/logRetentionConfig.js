/**
 * 日誌保留天數與 audit 清理模式（env-driven）
 */

const VALID_AUDIT_CLEANUP_MODES = ['keep', 'archive', 'delete'];

function parseEnvInt(name, defaultValue, env = process.env) {
  const v = env[name];
  if (v == null || v === '') return defaultValue;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

function parseEnvBool(name, defaultValue, env = process.env) {
  const v = env[name];
  if (v == null || v === '') return defaultValue;
  return String(v).toLowerCase() === 'true' || String(v) === '1';
}

function getLogRetentionConfig(env = process.env) {
  const warnings = [];
  const rawMode = String(env.AUDIT_LOG_CLEANUP_MODE || 'keep').trim().toLowerCase();
  let auditCleanupMode = rawMode;
  if (!VALID_AUDIT_CLEANUP_MODES.includes(auditCleanupMode)) {
    warnings.push(
      `AUDIT_LOG_CLEANUP_MODE="${rawMode}" 無效，已 fallback 為 keep（有效值：${VALID_AUDIT_CLEANUP_MODES.join(', ')}）`
    );
    auditCleanupMode = 'keep';
  }

  if (auditCleanupMode === 'archive') {
    warnings.push(
      'audit_logs 無 archived 欄位；archive 模式僅匯出 JSONL 至 archives/audit-logs/，不更新 DB 欄位。'
    );
  }

  return {
    systemDays: parseEnvInt('SYSTEM_LOG_RETENTION_DAYS', 180, env),
    emailDays: parseEnvInt('EMAIL_LOG_RETENTION_DAYS', 180, env),
    auditDays: parseEnvInt('AUDIT_LOG_RETENTION_DAYS', 365, env),
    auditCleanupMode,
    auditDeleteAfterArchive: parseEnvBool('AUDIT_LOG_DELETE_AFTER_ARCHIVE', false, env),
    warnings,
  };
}

function daysToMs(days) {
  return Number(days) * 24 * 60 * 60 * 1000;
}

function cutoffDateFromDays(days, now = new Date()) {
  return new Date(now.getTime() - daysToMs(days));
}

module.exports = {
  VALID_AUDIT_CLEANUP_MODES,
  getLogRetentionConfig,
  daysToMs,
  cutoffDateFromDays,
};
