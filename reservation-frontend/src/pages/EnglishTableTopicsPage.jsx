import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-tw';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/layout/PageHeader';
import EnglishTableTopicPanel from '../components/events/EnglishTableTopicPanel';
import { listEnglishTableTopics } from '../data/englishTableTopics1151';
import { getEventsCalendarPath } from '../utils/eventTypeQuery';
import './EnglishTableTopicsPage.css';

function todayKey() {
  return dayjs().format('YYYY-MM-DD');
}

function focusWeekNumber(sessions, today) {
  const currentOrPast = [...sessions].reverse().find((session) => session.date <= today);
  return currentOrPast?.week || sessions[0]?.week;
}

export default function EnglishTableTopicsPage() {
  const { t, lang } = useLanguage();
  const today = todayKey();
  const sessions = useMemo(() => listEnglishTableTopics(), []);
  const focusWeek = focusWeekNumber(sessions, today);
  const weeks = useMemo(() => {
    const grouped = new Map();
    sessions.forEach((session) => {
      const bucket = grouped.get(session.week) || [];
      bucket.push(session);
      grouped.set(session.week, bucket);
    });
    return [...grouped.entries()].map(([week, items]) => ({ week, items }));
  }, [sessions]);

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.activities'), path: '/activities' },
    { label: t('activities.englishTable'), path: '/activities/english-table' },
    { label: t('etTopics.pageTitle') },
  ];

  return (
    <div className="et-topics-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={t('etTopics.pageTitle')}
        lead={t('etTopics.pageLead')}
      />

      <div className="et-topics-page__weeks">
        {weeks.map((week) => (
          <section key={week.week} className="et-topics-week" aria-labelledby={`et-week-${week.week}`}>
            <h2 id={`et-week-${week.week}`}>
              {t('booking.etTopicWeek', { week: week.week })}
              {week.week === focusWeek ? <span>{t('etTopics.thisWeek')}</span> : null}
            </h2>
            <div className="et-topics-week__grid">
              {week.items.map((session) => {
                const dateLabel = dayjs(session.date)
                  .locale(lang === 'en' ? 'en' : 'zh-tw')
                  .format(lang === 'en' ? 'ddd, MMM D' : 'MM/DD ddd');
                const timing = session.date === today
                  ? 'today'
                  : session.date < today
                    ? 'past'
                    : 'upcoming';
                return (
                  <article key={session.date} className={`et-topics-day et-topics-day--${timing}`}>
                    <p className="et-topics-day__date">
                      {dateLabel}
                      {timing === 'today' ? <span>{t('etTopics.today')}</span> : null}
                    </p>
                    <EnglishTableTopicPanel
                      date={session.date}
                      eventType="english_table"
                      defaultOpen={week.week === focusWeek}
                      showPracticeLinks
                    />
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="et-topics-page__actions">
        <Link to="/activities/english-table" className="btn btn-outline-primary">
          {t('etTopics.backToEnglishTable')}
        </Link>
        <Link to={getEventsCalendarPath('english-table')} className="btn btn-primary">
          {t('page.calendarBookingTitle')}
        </Link>
      </div>
    </div>
  );
}
