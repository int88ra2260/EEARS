import React from 'react';
import StatusBadge from '../ui/StatusBadge';
import { formatMessage } from '../../utils/formatMessage';

/**
 * 日曆上方摘要與狀態圖例（Cal.com 式掃讀）
 */
export default function EventCalendarInsights({
  bookableCount = 0,
  totalCount = 0,
  hasNextBookable = false,
  hasNextEvent = false,
  onJumpNext,
  t,
}) {
  const jumpLabel = hasNextBookable ? t('page.calendarJumpNext') : t('page.calendarJumpNearest');
  const showJump = totalCount > 0 && hasNextEvent;

  return (
    <div className="event-calendar-insights" aria-label={t('page.calendarInsightsAria')}>
      <div className="event-calendar-insights__summary">
        <span className="event-calendar-insights__stat">
          {formatMessage(t('page.calendarSummaryBookable'), { count: bookableCount })}
        </span>
        {totalCount > 0 ? (
          <span className="event-calendar-insights__stat text-muted">
            {formatMessage(t('page.calendarSummaryTotal'), { count: totalCount })}
          </span>
        ) : null}
        {showJump ? (
          <button
            type="button"
            className="btn btn-link btn-sm event-calendar-insights__jump p-0"
            onClick={onJumpNext}
          >
            {jumpLabel}
          </button>
        ) : null}
        {totalCount > 0 && bookableCount === 0 ? (
          <span className="event-calendar-insights__stat text-muted small">
            {t('page.calendarNoBookableHint')}
          </span>
        ) : null}
      </div>
      <div className="event-calendar-legend" role="list" aria-label={t('page.calendarLegendTitle')}>
        <span className="event-calendar-legend__label">{t('page.calendarLegendTitle')}</span>
        <StatusBadge variant="success" size="sm" role="listitem">
          {t('home.eventHoverBadgeOpen')}
        </StatusBadge>
        <StatusBadge variant="danger" size="sm" role="listitem">
          {t('page.calendarLegendFull')}
        </StatusBadge>
        <StatusBadge variant="neutral" size="sm" role="listitem">
          {t('page.calendarLegendClosed')}
        </StatusBadge>
        <StatusBadge variant="info" size="sm" role="listitem">
          {t('home.eventHoverSurveyShort')}
        </StatusBadge>
      </div>
    </div>
  );
}
