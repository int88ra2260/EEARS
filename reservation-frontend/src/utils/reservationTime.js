// src/utils/reservationTime.js
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import {
  DEFAULT_EVENT_TYPE_CODE,
  OPEN_RULE_TYPES,
  getDefaultTypeConfig,
} from '../constants/eventTypeCatalog';
import {
  getCachedPublicEventTypes,
  resolveTypeConfigFromList,
} from '../services/eventTypeApi';

dayjs.extend(utc);
dayjs.extend(timezone);

/** @deprecated 預設 fallback；實際以類型 cutoffHours 為準 */
export const RESERVATION_CUTOFF_HOURS = 2;

function resolveCutoffHours(typeConfig) {
  const n = Number(typeConfig?.cutoffHours);
  if (Number.isFinite(n) && n >= 0) return n;
  return RESERVATION_CUTOFF_HOURS;
}

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
    return eventStart.startOf('week').add(weekday, 'day').subtract(7, 'day').hour(hour).minute(minute).second(0);
  }

  const days = Number.isFinite(Number(rule.days)) ? Number(rule.days) : 1;
  return eventStart.subtract(days, 'day').hour(hour).minute(minute).second(0);
}

/**
 * @param {Object} event - { date, startTime, eventType }
 * @param {Object} [typeConfig] - 來自 /api/event-types；省略時用公開快取或 seed fallback
 */
export function calculateReservationTime(event, typeConfig) {
  const eventStart = dayjs(`${event.date}T${event.startTime}`);
  const fromCache = !typeConfig
    ? resolveTypeConfigFromList(getCachedPublicEventTypes() || [], event?.eventType)
    : null;
  const cfg = typeConfig
    || fromCache
    || getDefaultTypeConfig(event?.eventType || DEFAULT_EVENT_TYPE_CODE);
  const cutoffHours = resolveCutoffHours(cfg);
  const openStart = computeOpenStart(eventStart, cfg.openRule);
  const openEnd = eventStart.subtract(cutoffHours, 'hour');
  return { openStart, openEnd, cutoffHours, typeConfig: cfg };
}

export function getCancellationDeadline(event, typeConfig) {
  const { openEnd, cutoffHours, typeConfig: cfg } = calculateReservationTime(event, typeConfig);
  return { deadline: openEnd, cutoffHours, typeConfig: cfg };
}

export function getLastWeekday(targetDate, weekday) {
  const startOfWeek = targetDate.startOf('week');
  let targetDayThisWeek;
  if (weekday === 7) {
    targetDayThisWeek = startOfWeek;
  } else {
    targetDayThisWeek = startOfWeek.add(weekday, 'day');
  }
  return targetDayThisWeek.subtract(7, 'day');
}

export function getCurrentWeekday(targetDate, weekday) {
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
