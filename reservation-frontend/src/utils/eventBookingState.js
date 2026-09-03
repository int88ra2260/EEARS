import dayjs from 'dayjs';
import { calculateReservationTime, RESERVATION_CUTOFF_HOURS } from './reservationTime';

/** 距離截止少於此時數視為「即將截止」 */
export const CLOSING_SOON_HOURS = 24;

/**
 * @typedef {'OPEN'|'CLOSING_SOON'|'NOT_YET_OPEN'|'PAST_DEADLINE'|'STARTED'|'FULL'|'UNKNOWN'} BookingStateCode
 */

/**
 * @param {object|null|undefined} event
 * @returns {{
 *   code: BookingStateCode,
 *   openStart: import('dayjs').Dayjs|null,
 *   openEnd: import('dayjs').Dayjs|null,
 *   eventStart: import('dayjs').Dayjs|null,
 *   spots: number,
 *   hoursUntilDeadline: number|null,
 *   isClosingSoon: boolean,
 * }}
 */
export function getEventBookingState(event) {
  const base = {
    code: 'UNKNOWN',
    openStart: null,
    openEnd: null,
    eventStart: null,
    spots: 0,
    hoursUntilDeadline: null,
    isClosingSoon: false,
  };

  if (!event) return base;

  const now = dayjs();
  const eventStart = dayjs(`${event.date}T${event.startTime}`);
  const spots = Number(event.availableSpots);

  if (!eventStart.isValid()) {
    return { ...base, spots: Number.isFinite(spots) ? spots : 0 };
  }

  if (now.isAfter(eventStart)) {
    return { ...base, code: 'STARTED', eventStart, spots };
  }

  let openStart;
  let openEnd;
  try {
    ({ openStart, openEnd } = calculateReservationTime(event));
  } catch {
    return { ...base, eventStart, spots };
  }

  if (now.isBefore(openStart)) {
    return {
      ...base,
      code: 'NOT_YET_OPEN',
      openStart,
      openEnd,
      eventStart,
      spots,
    };
  }

  if (now.isAfter(openEnd)) {
    return {
      ...base,
      code: 'PAST_DEADLINE',
      openStart,
      openEnd,
      eventStart,
      spots,
      hoursUntilDeadline: 0,
    };
  }

  const hoursUntilDeadline = openEnd.diff(now, 'hour', true);
  const isClosingSoon = hoursUntilDeadline <= CLOSING_SOON_HOURS;

  if (spots === 0) {
    return {
      code: 'FULL',
      openStart,
      openEnd,
      eventStart,
      spots,
      hoursUntilDeadline,
      isClosingSoon,
    };
  }

  return {
    code: isClosingSoon ? 'CLOSING_SOON' : 'OPEN',
    openStart,
    openEnd,
    eventStart,
    spots,
    hoursUntilDeadline,
    isClosingSoon,
  };
}

export function canReserveFromState(state) {
  return state.code === 'OPEN' || state.code === 'CLOSING_SOON';
}

export function canWaitlistFromState() {
  return false;
}

/**
 * @param {number|null|undefined} hours
 * @param {(key: string, vars?: object) => string} t
 */
export function formatHoursUntilDeadline(hours, t) {
  if (hours == null || !Number.isFinite(hours)) return '';
  if (hours <= 0) return t('events.deadlinePassed');
  if (hours < 1) {
    const minutes = Math.max(1, Math.ceil(hours * 60));
    return t('events.deadlineMinutesLeft', { minutes });
  }
  if (hours < 24) {
    return t('events.deadlineHoursLeft', { hours: Math.ceil(hours) });
  }
  const days = Math.ceil(hours / 24);
  return t('events.deadlineDaysLeft', { days });
}

export { RESERVATION_CUTOFF_HOURS };
