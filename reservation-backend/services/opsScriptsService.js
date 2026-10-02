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

const BACKEND_DIR = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(BACKEND_DIR, 'migrations');

/** @type {{
 *   status: 'idle'|'running'|'success'|'failed',
 *   startedAt: string|null,
 *   finishedAt: string|null,
 *   exitCode: number|null,
 *   message: string,
 *   output: string,
 *   pending: string[],
 * }} */
let migrateJob = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  message: '尚未執行',
  output: '',
  pending: [],
};

function diffPendingMigrations(fileNames, executedNames) {
  const done = new Set((executedNames || []).map((name) => String(name || '').trim()).filter(Boolean));
  return (fileNames || [])
    .map((name) => String(name || '').trim())
    .filter((name) => name.endsWith('.js') && !done.has(name))
    .sort();
}

function listMigrationFileNames() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.js'));
}

async function readExecutedMigrationNames() {
  const { sequelize } = require('../models');
  try {
    const rows = await sequelize.query('SELECT name FROM SequelizeMeta', {
      type: sequelize.QueryTypes.SELECT,
    });
    return (rows || []).map((row) => row.name);
  } catch (error) {
    const code = error?.original?.code || error?.parent?.code;
    const message = String(error?.message || '');
    if (code === 'ER_NO_SUCH_TABLE' || /SequelizeMeta/i.test(message)) return [];
    throw error;
  }
}

async function getMigrationStatus() {
  const pending = diffPendingMigrations(listMigrationFileNames(), await readExecutedMigrationNames());
  return {
    pending,
    pendingCount: pending.length,
    job: getMigrateJobStatus(),
  };
}

function getMigrateJobStatus() {
  return {
    ...migrateJob,
    pending: [...migrateJob.pending],
  };
}

function operatorFromUser(user, requestId) {
  return {
    auditRequestId: requestId || `ops-migrate-${Date.now()}`,
    operator: {
      operatorId: user?.id ?? null,
      operatorRole: user?.role ?? null,
      operatorName: user?.name || user?.user || null,
    },
  };
}

/**
 * 只執行 sequelize-cli db:migrate（往上套用尚未執行的 migration）。
 * 不接受客戶端參數，也不提供 undo。
 */
async function startMigrateJob({ user, requestId } = {}) {
  if (migrateJob.status === 'running') {
    const err = new Error('資料庫 migration 執行中，請稍後再試');
    err.status = 409;
    err.code = 'MIGRATE_JOB_RUNNING';
    throw err;
  }

  const pending = diffPendingMigrations(listMigrationFileNames(), await readExecutedMigrationNames());
  const { auditRequestId, operator } = operatorFromUser(user, requestId);
  const startedAt = new Date().toISOString();

  if (!pending.length) {
    migrateJob = {
      status: 'success',
      startedAt,
      finishedAt: startedAt,
      exitCode: 0,
      message: '沒有尚未執行的 migration',
      output: '',
      pending: [],
    };
    return getMigrateJobStatus();
  }

  migrateJob = {
    status: 'running',
    startedAt,
    finishedAt: null,
    exitCode: null,
    message: `正在套用 ${pending.length} 個 migration`,
    output: '',
    pending,
  };

  logAuditAsync({
    module: 'ops',
    action: 'db_migrate_start',
    entityType: 'OpsScript',
    entityId: 'db-migrate',
    targetSummary: `套用尚未執行的 migration（${pending.length}）`,
    afterData: { pending, startedAt },
    requestId: auditRequestId,
    ...operator,
  });

  const child = spawn('npx', ['sequelize-cli', 'db:migrate'], {
    cwd: BACKEND_DIR,
    windowsHide: true,
    shell: true,
    env: process.env,
  });

  let output = '';
  const append = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-12000);
    migrateJob = { ...migrateJob, output };
  };
  if (child.stdout) child.stdout.on('data', append);
  if (child.stderr) child.stderr.on('data', append);

  const finalize = (exitCode, message, status) => {
    const finishedAt = new Date().toISOString();
    migrateJob = {
      ...migrateJob,
      status,
      finishedAt,
      exitCode,
      message,
      output,
    };
    logAuditAsync({
      module: 'ops',
      action: status === 'success' ? 'db_migrate_success' : 'db_migrate_failed',
      entityType: 'OpsScript',
      entityId: 'db-migrate',
      targetSummary: message,
      afterData: { exitCode, status, finishedAt, pending },
      status: status === 'success' ? 'success' : 'failed',
      errorMessage: status === 'success' ? null : message,
      requestId: auditRequestId,
      ...operator,
    });
  };

  child.on('error', (err) => {
    finalize(null, `無法啟動 migration：${err.message}`, 'failed');
  });
  child.on('close', (code) => {
    const exitCode = typeof code === 'number' ? code : null;
    if (exitCode === 0) {
      finalize(exitCode, 'migration 已套用', 'success');
    } else {
      finalize(exitCode, `migration 失敗（exit ${exitCode ?? 'null'}）`, 'failed');
    }
  });

  return getMigrateJobStatus();
}

function _resetMigrateJobForTests() {
  migrateJob = {
    status: 'idle',
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    message: '尚未執行',
    output: '',
    pending: [],
  };
}

module.exports = {
  getBackupHealthSnapshot,
  getBackupJobStatus,
  startBackupJob,
  getBackupScriptPath,
  _resetBackupJobForTests,
  diffPendingMigrations,
  getMigrationStatus,
  getMigrateJobStatus,
  startMigrateJob,
  _resetMigrateJobForTests,
};
