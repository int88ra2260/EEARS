const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { Op } = require('sequelize');
const { sequelize, LearningJourneyOperationRun } = require('../models');
const { syncEwlReservations } = require('../services/learningJourney/ewlSyncService');
const operationRuns = require('../services/learningJourney/learningJourneyOperationRunService');
const { TAIPEI_TIME_ZONE } = require('../utils/time');

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = process.env.TZ || TAIPEI_TIME_ZONE;
const LOCK_NAME = 'eears:ewl:daily-sync';
const CATCHUP_STALE_MS = 20 * 60 * 60 * 1000;

function isEnabled() {
  const raw = String(process.env.EWL_DAILY_SYNC_ENABLED ?? 'true').trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'off';
}

function scheduleClock() {
  const hour = Number(process.env.EWL_DAILY_SYNC_HOUR);
  const minute = Number(process.env.EWL_DAILY_SYNC_MINUTE);
  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 6,
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

async function acquireLock() {
  const rows = await sequelize.query('SELECT GET_LOCK(:name, 0) AS acquired', {
    replacements: { name: LOCK_NAME },
    type: sequelize.QueryTypes.SELECT,
  });
  const raw = rows && rows[0] ? rows[0].acquired : 0;
  return raw === 1 || raw === '1' || raw === true;
}

async function releaseLock() {
  try {
    await sequelize.query('SELECT RELEASE_LOCK(:name) AS released', {
      replacements: { name: LOCK_NAME },
      type: sequelize.QueryTypes.SELECT,
    });
  } catch {
    // 鎖在連線結束時會釋放；這裡失敗不擋下一次排程
  }
}

async function runScheduledEwlSync(logger) {
  const [runningSync, runningRebuild] = await Promise.all([
    operationRuns.findRunningByType(operationRuns.OPERATION_TYPES.SYNC_EWL),
    operationRuns.findRunningByType(operationRuns.OPERATION_TYPES.REBUILD_ANALYTICS),
  ]);
  if (runningSync || runningRebuild) {
    logger.info('[ewl-daily-sync] 已有同步或分析重建進行中，略過本次');
    return { skipped: true, reason: 'already_running' };
  }

  const locked = await acquireLock();
  if (!locked) {
    logger.info('[ewl-daily-sync] 另一程序正在同步，略過本次');
    return { skipped: true, reason: 'lock' };
  }

  const run = await operationRuns.createRun({
    operationType: operationRuns.OPERATION_TYPES.SYNC_EWL,
    executedByUsername: 'system:scheduler',
    source: 'scheduler',
    dryRun: false,
    confirm: true,
    startedAt: new Date(),
  });

  try {
    const result = await syncEwlReservations({
      dryRun: false,
      rebuildAnalytics: true,
    });
    const status = result.errorCount > 0
      ? operationRuns.STATUSES.PARTIAL
      : operationRuns.STATUSES.SUCCESS;
    await operationRuns.markSuccess(run, {
      status,
      resultSummary: {
        trigger: 'daily',
        dryRun: false,
        startDate: result.startDate,
        endDate: result.endDate,
        fetched: result.fetched,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        errorCount: result.errorCount,
        affectedStudentCount: result.affectedStudentCount || 0,
      },
    });
    logger.info(
      `[ewl-daily-sync] 完成 ${result.startDate}～${result.endDate}`
      + ` fetched=${result.fetched} inserted=${result.inserted}`
      + ` updated=${result.updated} errors=${result.errorCount}`
    );
    return { skipped: false, result };
  } catch (error) {
    await operationRuns.markFailed(run, {
      errorCode: 'EWL_SYNC_FAILED',
      errorMessage: error && error.message ? error.message : String(error),
    }).catch(() => {});
    throw error;
  } finally {
    await releaseLock();
  }
}

async function maybeCatchUp(logger) {
  const recent = await LearningJourneyOperationRun.findOne({
    where: {
      operationType: operationRuns.OPERATION_TYPES.SYNC_EWL,
      source: 'scheduler',
      status: { [Op.in]: [operationRuns.STATUSES.SUCCESS, operationRuns.STATUSES.PARTIAL] },
      startedAt: { [Op.gte]: new Date(Date.now() - CATCHUP_STALE_MS) },
    },
  });
  if (recent) return { skipped: true, reason: 'fresh' };
  logger.info('[ewl-daily-sync] 近 20 小時沒有成功的排程同步，啟動補跑');
  return runScheduledEwlSync(logger);
}

function startEwlDailySyncScheduler(logger) {
  if (!isEnabled()) {
    logger.info('[ewl-daily-sync] 已停用（EWL_DAILY_SYNC_ENABLED=false）');
    return;
  }

  const { hour, minute } = scheduleClock();
  const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const scheduleNext = () => {
    const delay = msUntilNextRun();
    setTimeout(async () => {
      try {
        await runScheduledEwlSync(logger);
      } catch (error) {
        logger.error('[ewl-daily-sync] 排程執行失敗', error);
      } finally {
        scheduleNext();
      }
    }, delay);
  };

  logger.info(`[ewl-daily-sync] 每日 ${label} (${TZ}) 同步排程已啟動（過去 14 天～未來 60 天）`);
  scheduleNext();

  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      maybeCatchUp(logger).catch((error) => {
        logger.error('[ewl-daily-sync] 啟動補跑失敗', error);
      });
    }, 30 * 1000);
  }
}

module.exports = {
  startEwlDailySyncScheduler,
  runScheduledEwlSync,
  maybeCatchUp,
  msUntilNextRun,
  isEnabled,
  scheduleClock,
};
