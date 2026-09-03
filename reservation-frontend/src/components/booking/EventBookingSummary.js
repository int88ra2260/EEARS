/**
 * 活動預約 Modal 內的活動資訊（場次卡 + 關鍵狀態）
 */
import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-tw';
import { calculateReservationTime } from '../../utils/reservationTime';
import { getEventLocationDisplay } from '../../utils/eventLocation';
import { useLanguage } from '../../context/LanguageContext';
import EventDeadlineHint from '../events/EventDeadlineHint';
import StatusBadge from '../ui/StatusBadge';

const KNOWN_TYPES = ['English Table', 'Job Talk', 'English Club', 'International Forum'];

function formatSessionDate(dateStr, lang) {
  if (!dateStr) return '—';
  const parsed = dayjs(dateStr);
  if (!parsed.isValid()) return dateStr;
  return parsed.locale(lang === 'en' ? 'en' : 'zh-tw').format(
    lang === 'en' ? 'ddd, MMM D, YYYY' : 'YYYY/MM/DD dddd',
  );
}

export default function EventBookingSummary({
  event,
  surveyRequired = false,
}) {
  const { t, lang } = useLanguage();
  const spots = event ? Number(event.availableSpots) : 0;
  const sessionDateLabel = useMemo(
    () => (event ? formatSessionDate(event.date, lang) : '—'),
    [event, lang],
  );

  if (!event) return null;

  let timingSummary = null;
  try {
    const { openStart, openEnd } = calculateReservationTime(event);
    const isCustomType = !KNOWN_TYPES.includes(event.eventType);
    const dateFmt = lang === 'en' ? 'MMM D HH:mm' : 'MM/DD HH:mm';
    timingSummary = (
      <p className="event-booking-summary__timing-line">
        {openStart.locale(lang === 'en' ? 'en' : 'zh-tw').format(dateFmt)}
        {' — '}
        {openEnd.locale(lang === 'en' ? 'en' : 'zh-tw').format(dateFmt)}
        <span className="event-booking-summary__timing-note">
          {t('booking.timingCutoffNote')}
        </span>
        {isCustomType && event.customReservationRule && (
          <span className="event-booking-summary__timing-rule">
            {event.customReservationRule}
          </span>
        )}
      </p>
    );
  } catch {
    timingSummary = null;
  }

  const spotsClass = spots === 0
    ? 'event-booking-summary__spots--full'
    : spots <= 5
      ? 'event-booking-summary__spots--low'
      : 'event-booking-summary__spots--ok';

  return (
    <section className="event-booking-summary" aria-label={t('booking.summaryAria')}>
      <div className="event-booking-summary__status" role="status">
        <EventDeadlineHint event={event} t={t} showWindow={false} />
        {surveyRequired ? (
          <div className="event-booking-summary__extra-badges">
            <StatusBadge variant="info" size="md">
              {t('booking.badgeSurvey')}
            </StatusBadge>
          </div>
        ) : null}
      </div>

      <div className="event-booking-summary__hero">
        <aside className="event-booking-summary__slot-panel" aria-labelledby="booking-slot-title">
          <p id="booking-slot-title" className="event-booking-summary__slot-kicker">
            {t('booking.sessionPanelTitle')}
          </p>
          <p className="event-booking-summary__slot-name">{event.name}</p>
          <p className="event-booking-summary__slot-date">{sessionDateLabel}</p>
          <p className="event-booking-summary__slot-time">
            {event.startTime} – {event.endTime}
          </p>
          <p className="event-booking-summary__slot-location">{getEventLocationDisplay(event)}</p>
          <p className="event-booking-summary__slot-type">{event.eventType || 'English Table'}</p>
        </aside>

        <div className="event-booking-summary__quick-meta">
          <div className="event-booking-summary__meta-row">
            <span className="event-booking-summary__meta-label">{t('booking.labelSpots')}</span>
            <span className={`event-booking-summary__spots ${spotsClass}`}>
              {spots === 0 ? t('booking.spotsFull') : event.availableSpots}
            </span>
          </div>
          {timingSummary && (
            <div className="event-booking-summary__meta-row event-booking-summary__meta-row--timing">
              <span className="event-booking-summary__meta-label">{t('booking.sectionTiming')}</span>
              {timingSummary}
            </div>
          )}
        </div>
      </div>

      <details className="event-booking-summary__notes-details">
        <summary className="event-booking-summary__notes-summary">
          {t('booking.sectionNotes')}
        </summary>
        <ul className="event-booking-summary__notes">
          <li>{t('booking.note1')}</li>
          <li>{t('booking.note2')}</li>
          <li>{t('booking.note3')}</li>
        </ul>
      </details>
    </section>
  );
}
