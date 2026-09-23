const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { startBackupJob } = require('../services/opsScriptsService');
const { evaluateBackupHealth } = require('../utils/backupHealthCheck');
const { TAIPEI_TIME_ZONE } = require('../utils/time');

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = process.env.TZ || TAIPEI_TIME_ZONE;

function isEnabled() {
  const raw = String(process.env.BACKUP_DAILY_ENABLED ?? 'true').trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'off';
}

function scheduleClock() {
  const hour = Number(process.env.BACKUP_DAILY_HOUR);
  const minute = Number(process.env.BACKUP_DAILY_MINUTE);
  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 2,
    minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 0,
  };
}

function msUntilNextRun(now = dayjs().tz(TZ)) {
  const { hour, minute } = scheduleClock();
  let next = now.hour(hour).minute(minute).second(0).millisecond(0);
  if (!next.isAfter(now)) {
    next = next.add(1, 'day');
  }
  return Math.max(1000, next.diff(now));
}

function runScheduledBackup(logger) {
  try {
    const job = startBackupJob({
      trigger: 'scheduler',
      requestId: `ops-backup-schedule-${Date.now()}`,
    });
    logger.info(`[backup-daily] 已啟動備份 ${job.scriptPath || ''}`);
    return { skipped: false, job };
  } catch (error) {
    if (error && error.code === 'BACKUP_JOB_RUNNING') {
      logger.info('[backup-daily] 備份作業執行中，略過本次');
      return { skipped: true, reason: 'already_running' };
    }
    throw error;
  }
}

function maybeCatchUp(logger) {
  const health = evaluateBackupHealth();
  if (health.ok) return { skipped: true, reason: 'fresh' };
  logger.info(`[backup-daily] 最近備份未通過健康檢查（${health.code}），啟動補跑`);
  return runScheduledBackup(logger);
}

function startBackupDailyScheduler(logger) {
  if (!isEnabled()) {
    logger.info('[backup-daily] 已停用（BACKUP_DAILY_ENABLED=false）');
    return;
  }

  const { hour, minute } = scheduleClock();
  const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const scheduleNext = () => {
    const delay = msUntilNextRun();
    setTimeout(async () => {
      try {
        runScheduledBackup(logger);
      } catch (error) {
        logger.error('[backup-daily] 排程執行失敗', error);
      } finally {
        scheduleNext();
      }
    }, delay);
  };

  logger.info(`[backup-daily] 每日 ${label} (${TZ}) 資料庫備份排程已啟動`);
  scheduleNext();

  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      try {
        maybeCatchUp(logger);
      } catch (error) {
        logger.error('[backup-daily] 啟動補跑失敗', error);
      }
    }, 45 * 1000);
  }
}

module.exports = {
  startBackupDailyScheduler,
  runScheduledBackup,
  maybeCatchUp,
  msUntilNextRun,
  isEnabled,
  scheduleClock,
};
