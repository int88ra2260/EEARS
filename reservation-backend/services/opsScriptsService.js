'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { evaluateBackupHealth, getBackupHealthConfig } = require('../utils/backupHealthCheck');
const { logAuditAsync } = require('./auditLogService');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** @type {{
 *   status: 'idle'|'running'|'success'|'failed',
 *   startedAt: string|null,
 *   finishedAt: string|null,
 *   exitCode: number|null,
 *   message: string,
 *   scriptPath: string|null,
 *   triggeredBy: { id: number|null, name: string|null }|null,
 * }} */
let backupJob = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  message: '尚未執行',
  scriptPath: null,
  triggeredBy: null,
};

function getBackupScriptPath(env = process.env) {
  if (env.OPS_BACKUP_SCRIPT && String(env.OPS_BACKUP_SCRIPT).trim()) {
    return path.resolve(String(env.OPS_BACKUP_SCRIPT).trim());
  }
  return path.join(REPO_ROOT, 'scripts', 'backup-db.bat');
}

function serializeLatestFile(latestFile) {
  if (!latestFile) return null;
  return {
    name: latestFile.name,
    mtime: latestFile.mtime instanceof Date ? latestFile.mtime.toISOString() : latestFile.mtime,
    ageHours: latestFile.ageHours,
    sizeBytes: latestFile.sizeBytes,
  };
}

function getBackupHealthSnapshot() {
  const health = evaluateBackupHealth();
  const config = getBackupHealthConfig();
  return {
    ok: health.ok,
    code: health.code,
    message: health.message,
    dir: health.dir,
    pattern: health.pattern,
    maxAgeHours: health.maxAgeHours,
    latestFile: serializeLatestFile(health.latestFile),
    scriptPath: getBackupScriptPath(),
    scriptExists: fs.existsSync(getBackupScriptPath()),
    config,
  };
}

function getBackupJobStatus() {
  return { ...backupJob };
}

/**
 * 以正式 Windows 備份批次（scripts/backup-db.bat）觸發備份。
 * 非同步執行；同時間僅允許一個 job。
 */
function startBackupJob({ user, requestId, trigger = 'manual' } = {}) {
  if (process.platform !== 'win32') {
    const err = new Error('資料庫備份腳本僅支援 Windows 伺服器');
    err.status = 400;
    err.code = 'BACKUP_PLATFORM_UNSUPPORTED';
    throw err;
  }

  if (backupJob.status === 'running') {
    const err = new Error('備份作業執行中，請稍後再試');
    err.status = 409;
    err.code = 'BACKUP_JOB_RUNNING';
    throw err;
  }

  const scriptPath = getBackupScriptPath();
  if (!fs.existsSync(scriptPath)) {
    const err = new Error(`找不到備份腳本：${scriptPath}`);
    err.status = 500;
    err.code = 'BACKUP_SCRIPT_MISSING';
    throw err;
  }

  const startedAt = new Date().toISOString();
  const scheduled = trigger === 'scheduler';
  backupJob = {
    status: 'running',
    startedAt,
    finishedAt: null,
    exitCode: null,
    message: '備份作業執行中',
    scriptPath,
    triggeredBy: user
      ? { id: user.id != null ? user.id : null, name: user.name || user.user || null }
      : (scheduled ? { id: null, name: 'system:scheduler' } : null),
  };

  const auditRequestId = requestId || `ops-backup-${Date.now()}`;
  const operator = {
    operatorId: user?.id ?? null,
    operatorRole: user?.role ?? (scheduled ? 'system' : null),
    operatorName: user?.name || user?.user || (scheduled ? 'system:scheduler' : null),
  };

  logAuditAsync({
    module: 'ops',
    action: 'backup_start',
    entityType: 'OpsScript',
    entityId: 'backup-db',
    targetSummary: `${scheduled ? '排程' : '手動'}觸發備份：${scriptPath}`,
    afterData: { scriptPath, startedAt },
    requestId: auditRequestId,
    ...operator,
  });

  const child = spawn('cmd.exe', ['/c', scriptPath], {
    cwd: path.dirname(scriptPath),
    windowsHide: true,
    stdio: 'ignore',
  });

  const finalize = (exitCode, message, status) => {
    const finishedAt = new Date().toISOString();
    backupJob = {
      ...backupJob,
      status,
      finishedAt,
      exitCode,
      message,
    };
    logAuditAsync({
      module: 'ops',
      action: status === 'success' ? 'backup_success' : 'backup_failed',
      entityType: 'OpsScript',
      entityId: 'backup-db',
      targetSummary: message,
      afterData: {
        scriptPath,
        exitCode,
        status,
        finishedAt,
      },
      status: status === 'success' ? 'success' : 'failed',
      errorMessage: status === 'success' ? null : message,
      requestId: auditRequestId,
      ...operator,
    });
  };

  child.on('error', (err) => {
    finalize(null, `無法啟動備份腳本：${err.message}`, 'failed');
  });

  child.on('close', (code) => {
    const exitCode = typeof code === 'number' ? code : null;
    if (exitCode === 0) {
      finalize(exitCode, '備份作業完成', 'success');
    } else {
      finalize(exitCode, `備份作業失敗（exit ${exitCode ?? 'null'}）`, 'failed');
    }
  });

  return getBackupJobStatus();
}

/** @internal 測試用重置 */
function _resetBackupJobForTests() {
  backupJob = {
    status: 'idle',
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    message: '尚未執行',
    scriptPath: null,
    triggeredBy: null,
  };
}

module.exports = {
  getBackupHealthSnapshot,
  getBackupJobStatus,
  startBackupJob,
  getBackupScriptPath,
  _resetBackupJobForTests,
};
