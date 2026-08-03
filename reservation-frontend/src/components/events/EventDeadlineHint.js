import React from 'react';
import {
  getEventBookingState,
  formatHoursUntilDeadline,
  RESERVATION_CUTOFF_HOURS,
} from '../../utils/eventBookingState';
import StatusBadge from '../ui/StatusBadge';

const VARIANT_BY_CODE = {
  OPEN: 'success',
  CLOSING_SOON: 'warning',
  NOT_YET_OPEN: 'warning',
  PAST_DEADLINE: 'danger',
  STARTED: 'neutral',
  FULL: 'danger',
  UNKNOWN: 'neutral',
};

/**
 * 活動預約截止／開放時間提示（列表、日曆展開、預約 Modal 共用）
 */
export default function EventDeadlineHint({
  event,
  t,
  compact = false,
  showWindow = true,
  className = '',
}) {
  const state = getEventBookingState(event);
  if (!event || state.code === 'UNKNOWN') return null;

  const badgeKey = `events.state.${state.code}`;
  const badgeLabel = t(badgeKey);

  const countdown =
    state.code === 'OPEN' || state.code === 'CLOSING_SOON' || state.code === 'FULL'
      ? formatHoursUntilDeadline(state.hoursUntilDeadline, t)
      : '';

  let detail = '';
  if (state.code === 'NOT_YET_OPEN' && state.openStart) {
    detail = t('events.opensAt', { time: state.openStart.format('YYYY/MM/DD HH:mm') });
  } else if ((state.code === 'PAST_DEADLINE' || state.code === 'STARTED') && state.openEnd) {
    detail = t('events.cutoffRule', { hours: RESERVATION_CUTOFF_HOURS });
  } else if (state.code === 'FULL') {
    detail = t('events.fullDetail');
  } else if (state.code === 'CLOSING_SOON' && countdown) {
    detail = countdown;
  } else if (state.code === 'OPEN' && countdown) {
    detail = t('events.openUntil', {
      time: state.openEnd?.format('YYYY/MM/DD HH:mm') || '',
      countdown,
    });
  }

  const windowLine =
    showWindow && state.openStart && state.openEnd
      ? t('events.reservationWindow', {
          start: state.openStart.format('MM/DD HH:mm'),
          end: state.openEnd.format('MM/DD HH:mm'),
        })
      : '';

  return (
    <div
      className={`event-deadline-hint${compact ? ' event-deadline-hint--compact' : ''} ${className}`.trim()}
      role="status"
    >
      <div className="event-deadline-hint__badges">
        <StatusBadge variant={VARIANT_BY_CODE[state.code] || 'neutral'} size={compact ? 'sm' : 'md'}>
          {badgeLabel}
        </StatusBadge>
      </div>
      {detail && <p className="event-deadline-hint__detail">{detail}</p>}
      {!compact && windowLine && (
        <p className="event-deadline-hint__window">
          <span className="event-deadline-hint__window-label">{t('events.windowLabel')}</span>
          {windowLine}
        </p>
      )}
    </div>
  );
}

/** 供 canReserveAndReason 對照用的 reasonCode */
export function bookingStateToReasonCode(state) {
  switch (state.code) {
    case 'OPEN':
    case 'CLOSING_SOON':
      return 'OK';
    case 'FULL':
      return 'FULL';
    case 'NOT_YET_OPEN':
      return 'NOT_YET_OPEN';
    case 'PAST_DEADLINE':
      return 'PAST_DEADLINE';
    case 'STARTED':
      return 'STARTED';
    default:
      return 'UNAVAILABLE';
  }
}
