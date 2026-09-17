'use strict';

const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');
const {
  OPEN_RULE_TYPES,
  DEFAULT_EVENT_TYPE_CODE,
} = require('../constants/eventTypeCatalog');
const eventTypeService = require('../services/eventTypeService');

dayjs.extend(utc);
dayjs.extend(timezone);

/** @deprecated 預設 fallback；實際截止以活動類型 cutoffHours 為準 */
const RESERVATION_CUTOFF_HOURS = 2;

function resolveCutoffHours(typeConfig) {
  const n = Number(typeConfig?.cutoffHours);
  if (Number.isFinite(n) && n >= 0) return n;
  return RESERVATION_CUTOFF_HOURS;
}

/**
 * 依 openRule 計算 openStart。
 * @param {dayjs.Dayjs} eventStart
 * @param {object} openRule
 */
function computeOpenStart(eventStart, openRule) {
  const rule = openRule && typeof openRule === 'object' ? openRule : {};
  const type = String(rule.type || OPEN_RULE_TYPES.DAY_BEFORE);
  const hour = Number.isFinite(Number(rule.hour)) ? Number(rule.hour) : 12;
  const minute = Number.isFinite(Number(rule.minute)) ? Number(rule.minute) : 0;

  if (type === OPEN_RULE_TYPES.DAYS_BEFORE) {
    const days = Number.isFinite(Number(rule.days)) ? Number(rule.days) : 7;
    return eventStart.subtract(days, 'day').hour(hour).minute(minute).second(0);
  }

  if (type === OPEN_RULE_TYPES.PREV_WEEKDAY) {
    const weekday = Number.isInteger(Number(rule.weekday)) ? Number(rule.weekday) : 3;
    // dayjs startOf('week') = 週日；與既有 EC/IF 行為一致：當週該日再減 7 天
    return eventStart.startOf('week').add(weekday, 'day').subtract(7, 'day').hour(hour).minute(minute).second(0);
  }

  // day_before（預設）
  const days = Number.isFinite(Number(rule.days)) ? Number(rule.days) : 1;
  return eventStart.subtract(days, 'day').hour(hour).minute(minute).second(0);
}

/**
 * 根據活動類型設定計算預約開放窗。
 * @param {Object} event - { date, startTime, eventType }
 * @param {Object} [typeConfig] - event_types 列；省略時從快取／seed 解析
 * @returns {{ openStart: dayjs.Dayjs, openEnd: dayjs.Dayjs, cutoffHours: number, typeConfig: object }}
 */
function calculateReservationTime(event, typeConfig) {
  const eventStart = dayjs(`${event.date}T${event.startTime}`);
  const cfg = typeConfig || eventTypeService.resolveTypeConfigSync(event?.eventType || DEFAULT_EVENT_TYPE_CODE);
  const cutoffHours = resolveCutoffHours(cfg);
  const openStart = computeOpenStart(eventStart, cfg.openRule);
  const openEnd = eventStart.subtract(cutoffHours, 'hour');
  return { openStart, openEnd, cutoffHours, typeConfig: cfg };
}

async function calculateReservationTimeAsync(event) {
  const cfg = await eventTypeService.resolveTypeConfig(event?.eventType);
  return calculateReservationTime(event, cfg);
}

function getCancellationDeadline(event, typeConfig) {
  const { openEnd, cutoffHours, typeConfig: cfg } = calculateReservationTime(event, typeConfig);
  return { deadline: openEnd, cutoffHours, typeConfig: cfg };
}

/**
 * 取得指定日期前最近的指定星期幾（上週）
 * @param {dayjs.Dayjs} targetDate
 * @param {number} weekday - 1=星期一 … 7=星期日
 */
function getLastWeekday(targetDate, weekday) {
  const startOfWeek = targetDate.startOf('week');
  let targetDayThisWeek;
  if (weekday === 7) {
    targetDayThisWeek = startOfWeek;
  } else {
    targetDayThisWeek = startOfWeek.add(weekday, 'day');
  }
  return targetDayThisWeek.subtract(7, 'day');
}

function getCurrentWeekday(targetDate, weekday) {
  const startOfWeek = targetDate.startOf('week');
  let targetDay;
  if (weekday === 7) {
    targetDay = startOfWeek;
  } else {
    targetDay = startOfWeek.add(weekday, 'day');
  }
  const now = dayjs();
  if (targetDay.isBefore(now)) {
    return targetDay.add(7, 'day');
  }
  return targetDay;
}

module.exports = {
  RESERVATION_CUTOFF_HOURS,
  calculateReservationTime,
  calculateReservationTimeAsync,
  getCancellationDeadline,
  resolveCutoffHours,
  computeOpenStart,
  getLastWeekday,
  getCurrentWeekday,
};
