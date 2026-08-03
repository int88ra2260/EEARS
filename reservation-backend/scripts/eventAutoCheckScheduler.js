const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { Op } = require('sequelize');
const { Event } = require('../models');
const { runEventAutoCheck } = require('../services/eventAutoCheckService');
const { TAIPEI_TIME_ZONE } = require('../utils/time');

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = process.env.TZ || 'Asia/Taipei';

function msUntilNextRun() {
  const now = dayjs().tz(TZ);
  let next = now.hour(23).minute(59).second(59).millisecond(0);
  if (!next.isAfter(now)) {
    next = next.add(1, 'day');
  }
  return Math.max(1000, next.diff(now));
}

async function runScheduledEventAutoCheck(logger) {
  const today = dayjs().tz(TZ).format('YYYY-MM-DD');
  const events = await Event.findAll({
    where: {
      date: {
        [Op.eq]: today,
      },
      autoCheckCompleted: false,
    },
    attributes: ['id', 'name'],
  });

  if (!events.length) {
    logger.info(`[event-auto-check] ${today} 無待處理活動`);
    return;
  }

  logger.info(`[event-auto-check] ${today} 啟動自動檢查，待處理 ${events.length} 場`);
  for (const event of events) {
    try {
      const result = await runEventAutoCheck({
        eventId: event.id,
        triggeredBy: 'scheduler_235959',
        recordedBy: 'system:scheduler',
      });
      if (result.ok) {
        logger.info(`[event-auto-check] 活動 ${event.id} (${event.name}) 完成`);
      } else if (result.alreadyCompleted) {
        logger.info(`[event-auto-check] 活動 ${event.id} (${event.name}) 已完成，略過`);
      } else {
        logger.warn(`[event-auto-check] 活動 ${event.id} (${event.name}) 未處理: ${result.error || 'unknown'}`);
      }
    } catch (error) {
      logger.error(`[event-auto-check] 活動 ${event.id} (${event.name}) 處理失敗`, error);
    }
  }
}

function startEventAutoCheckScheduler(logger) {
  const scheduleNext = () => {
    const delay = msUntilNextRun();
    setTimeout(async () => {
      try {
        await runScheduledEventAutoCheck(logger);
      } catch (error) {
        logger.error('[event-auto-check] 排程執行失敗', error);
      } finally {
        scheduleNext();
      }
    }, delay);
  };

  logger.info(`[event-auto-check] 每日 23:59:59 (${TAIPEI_TIME_ZONE}) 自動檢查排程已啟動`);
  scheduleNext();
}

module.exports = {
  startEventAutoCheckScheduler,
  runScheduledEventAutoCheck,
};
