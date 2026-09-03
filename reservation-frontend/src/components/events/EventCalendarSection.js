/**
 * 活動日曆區塊：FullCalendar 顯示與單一活動點擊
 * 不負責資料取得，由父層傳入 events、canReserveAndReason、onEventClick
 */
import React, { useMemo, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import useMediaQuery from '../../hooks/useMediaQuery';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import { getEventAbbreviation } from '../../constants/eventTypes';
import { getEventLocationDisplay } from '../../utils/eventLocation';
import StatusBadge from '../ui/StatusBadge';
import EventDeadlineHint from './EventDeadlineHint';
import useToast from '../ui/useToast';
import './eventHoverCard.css';

/** 日曆可預約狀態 → StatusBadge variant（與預約卡語意對齊） */
function calendarAvailabilityVariant(canReserve, reasonCode) {
  if (canReserve) return 'success';
  if (reasonCode === 'FULL') return 'danger';
  return 'neutral';
}

function hoverBadgeLabel(reasonCode, t) {
  switch (reasonCode) {
    case 'FULL':
      return t('home.eventHoverBadgeFull');
    case 'NOT_YET_OPEN':
      return t('home.eventHoverBadgeNotOpenYet');
    case 'PAST_DEADLINE':
      return t('home.eventHoverBadgeReservationEnded');
    case 'STARTED':
      return t('home.eventHoverBadgeEventStarted');
    default:
      return t('home.eventHoverBadgeUnavailable');
  }
}

export default forwardRef(function EventCalendarSection({
  events,
  canReserveAndReason,
  onEventClick,
  t,
  surveyActive = false,
}, ref) {
  const toast = useToast();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isNarrow = useMediaQuery('(max-width: 575px)');
  const enableHover = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    }
    return window.innerWidth >= 768;
  }, []);

  const [hoverPreview, setHoverPreview] = useState(null);
  /** 手機／窄螢幕清單檢視：展開列內摘要（不依賴 hover） */
  const [expandedEventId, setExpandedEventId] = useState(null);
  const calendarRef = useRef(null);

  useImperativeHandle(ref, () => ({
    gotoDate(dateStr) {
      const api = calendarRef.current?.getApi?.();
      if (!api || !dateStr) return;
      api.gotoDate(dateStr);
    },
  }), []);

  const calendarEvents = events.map((evt) => ({
    id: evt.id,
    title: evt.name,
    start: `${evt.date}T${evt.startTime}`,
    end: `${evt.date}T${evt.endTime}`,
    extendedProps: { originalEvent: evt },
  }));

  const handleClick = (info) => {
    const evt = info.event.extendedProps.originalEvent;
    const { canReserve, reasonMessage, reasonCode } = canReserveAndReason(evt);
    if (canReserve || reasonCode === 'FULL') {
      onEventClick(evt);
      return;
    }
    toast.warning(reasonMessage);
  };

  const handleMouseEnter = (info) => {
    if (!enableHover) return;
    const evt = info.event.extendedProps.originalEvent;
    const rect = info.el?.getBoundingClientRect?.();
    if (!evt || !rect) return;
    const { canReserve, reasonCode, reasonMessage } = canReserveAndReason(evt);

    const surveyRequired =
      surveyActive &&
      (evt.eventType === 'English Table' || evt.eventType === 'English Club');

    const statusLabel = canReserve ? t('home.eventHoverBadgeOpen') : hoverBadgeLabel(reasonCode, t);

    const reasonShort = (() => {
      if (!reasonMessage || canReserve) return '';
      const withoutParen = reasonMessage.split('(')[0]?.trim() || reasonMessage;
      return withoutParen.length > 44 ? `${withoutParen.slice(0, 44)}…` : withoutParen;
    })();

    const locationLine = getEventLocationDisplay(evt);

    // Clamp card position to viewport（寬度與 .event-hover-card 一致）
    const cardWidth = 300;
    const rawX = rect.left + rect.width / 2;
    const rawY = rect.top;
    const x = Math.min(
      Math.max(rawX, cardWidth / 2 + 12),
      window.innerWidth - cardWidth / 2 - 12
    );
    const y = Math.min(Math.max(rawY, 12), window.innerHeight - 12);

    setHoverPreview({
      evt,
      canReserve,
      reasonCode,
      reasonShort,
      surveyRequired,
      statusLabel,
      locationLine,
      x,
      y,
    });
  };

  const handleMouseLeave = () => {
    setHoverPreview(null);
  };

  const renderEventContent = (info) => {
    const evt = info.event.extendedProps.originalEvent;
    const showMobileExpand = isMobile;
    const { canReserve, reasonMessage, reasonCode } = canReserveAndReason(evt);
    const dotColor = canReserve ? 'text-success' : 'text-danger';
    const nameLabel = isNarrow ? getEventAbbreviation(evt.eventType || evt.name) : evt.name;

    const surveyRequired =
      surveyActive &&
      (evt.eventType === 'English Table' || evt.eventType === 'English Club');

    const reasonShort = (() => {
      if (!reasonMessage || typeof reasonMessage !== 'string') return '';
      const withoutParen = reasonMessage.split('(')[0]?.trim() || reasonMessage;
      return withoutParen.length > 80 ? `${withoutParen.slice(0, 80)}…` : withoutParen;
    })();

    const expanded = expandedEventId === evt.id;
    const statusLabel = canReserve ? t('home.eventHoverBadgeOpen') : hoverBadgeLabel(reasonCode, t);
    const showBookCta = canReserve;

    if (showMobileExpand) {
      return (
        <div className="fc-event-mobile-wrap px-2 py-1">
          <div className="fc-event-mobile-row d-flex align-items-center justify-content-between gap-1">
            <span className="flex-grow-1 text-truncate" style={{ fontSize: '0.75rem' }}>
              <span className={dotColor}>●</span> {nameLabel}
            </span>
            <button
              type="button"
              className="btn btn-link fc-event-mobile-expand p-0"
              aria-expanded={expanded}
              aria-label={t('home.eventDetailsToggle')}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedEventId((prev) => (prev === evt.id ? null : evt.id));
              }}
            >
              {expanded ? '▲' : '▼'}
            </button>
          </div>
          {expanded && (
            <div
              className="fc-event-mobile-detail text-muted small mt-1 ps-1"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="presentation"
            >
              <div className="text-body">{evt.startTime} – {evt.endTime}</div>
              <div className="fc-event-mobile-status d-flex flex-wrap gap-1 align-items-center">
                <StatusBadge
                  variant={calendarAvailabilityVariant(canReserve, reasonCode)}
                  size="sm"
                >
                  {statusLabel}
                </StatusBadge>
              </div>
              {surveyRequired && (
                <div className="fc-event-mobile-survey">
                  <StatusBadge variant="info" size="sm">
                    {t('home.surveyRequiredBadge')}
                  </StatusBadge>
                </div>
              )}
              <div>
                {t('home.eventHoverLocationLabel')} {getEventLocationDisplay(evt)}
              </div>
              <div>
                {t('home.eventHoverSpotsPrefix')}
                {typeof evt.availableSpots === 'number' ? evt.availableSpots : '—'}
              </div>
              <EventDeadlineHint event={evt} t={t} compact showWindow={!canReserve} className="mt-2" />
              {!canReserve && reasonShort && (
                <div className="event-deadline-hint__reason-fallback small mt-1">{reasonShort}</div>
              )}
              <button
                type="button"
                className={`btn btn-sm mt-2 ${showBookCta ? 'btn-primary' : 'btn-outline-primary'} fc-event-mobile-cta`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(evt);
                }}
              >
                {showBookCta ? t('home.eventCtaBookNow') : t('home.eventCtaViewDetail')}
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="fc-event-desktop-pill" title={evt.name}>
        <span
          className={`fc-event-desktop-dot fc-event-desktop-dot--${
            canReserve ? 'open' : reasonCode === 'FULL' ? 'full' : 'closed'
          }`}
          aria-hidden="true"
        />
        <span className="fc-event-desktop-time">{evt.startTime}</span>
        <span className="fc-event-desktop-title">{nameLabel}</span>
      </div>
    );
  };

  const resolveEventClassNames = (arg) => {
    const evt = arg.event.extendedProps.originalEvent;
    if (!evt) return ['calendar-event'];
    const { canReserve, reasonCode } = canReserveAndReason(evt);
    const classes = ['calendar-event'];
    if (canReserve) classes.push('calendar-event--open');
    else if (reasonCode === 'FULL') classes.push('calendar-event--full');
    else classes.push('calendar-event--closed');
    return classes;
  };

  return (
    <>
      <div className="event-calendar-wrap">
      <FullCalendar
        ref={calendarRef}
        key={isMobile ? 'mobile-list' : 'desktop-month'}
        plugins={[dayGridPlugin, listPlugin]}
        initialView="dayGridMonth"
        events={calendarEvents}
        eventContent={renderEventContent}
        eventClick={handleClick}
        eventMouseEnter={handleMouseEnter}
        eventMouseLeave={handleMouseLeave}
        height={isMobile ? 'auto' : 600}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,listWeek',
        }}
        views={{
          dayGridMonth: {
            buttonText: t('home.month'),
            eventDisplay: 'block',
            eventTimeFormat: { hour: '2-digit', minute: '2-digit' },
          },
          listWeek: {
            buttonText: t('home.list'),
            eventDisplay: 'list-item',
            listDayFormat: { weekday: 'long', month: 'long', day: 'numeric' },
            listDaySideFormat: false,
          },
        }}
        eventClassNames={resolveEventClassNames}
        dayHeaderClassNames="calendar-day-header"
        dayCellClassNames="calendar-day-cell"
        noEventsText={t('page.calendarListNoEventsInRange')}
      />
      </div>

      {enableHover && hoverPreview && (
        <div
          className="event-hover-card"
          style={{
            left: hoverPreview.x,
            top: hoverPreview.y,
            transform: 'translate(-50%, -8px)',
          }}
          role="status"
          aria-live="polite"
          aria-label={t('home.eventHoverCardAria')}
        >
          <div className="event-hover-card__title">{hoverPreview.evt.name}</div>
          <div className="event-hover-card__time">
            {hoverPreview.evt.date} {hoverPreview.evt.startTime} – {hoverPreview.evt.endTime}
          </div>
          {hoverPreview.locationLine && (
            <div className="event-hover-card__location">
              <span className="event-hover-card__location-label">{t('home.eventHoverLocationLabel')}</span>
              {hoverPreview.locationLine}
            </div>
          )}
          <div className="event-hover-card__meta">
            <StatusBadge
              variant={calendarAvailabilityVariant(hoverPreview.canReserve, hoverPreview.reasonCode)}
              size="md"
              className="event-hover-card__status-pill"
            >
              {hoverPreview.statusLabel}
            </StatusBadge>
            <span className="event-hover-card__type">
              {hoverPreview.evt.eventType || hoverPreview.evt.name}
            </span>
            {hoverPreview.surveyRequired && (
              <StatusBadge variant="info" size="md" title={t('home.eventHoverSurveyAria')}>
                {t('home.eventHoverSurveyShort')}
              </StatusBadge>
            )}
            <span className="event-hover-card__spots">
              {t('home.eventHoverSpotsPrefix')}
              {typeof hoverPreview.evt.availableSpots === 'number' ? hoverPreview.evt.availableSpots : '—'}
            </span>
          </div>
          <EventDeadlineHint
            event={hoverPreview.evt}
            t={t}
            compact
            showWindow={!hoverPreview.canReserve}
            className="event-hover-card__deadline"
          />
        </div>
      )}
    </>
  );
});
