import React from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import EventList from '../components/EventList';
import PageHeader from '../components/layout/PageHeader';
import ActivityPhrasebookPanel from '../components/guides/ActivityPhrasebookPanel';
import '../styles/student-events.css';
import '../components/guides/ActivityPhrasebook.css';
import { slugToTab, isValidActivitySlug, getCategoryTitleKey } from '../data/activitySlugs';
import { getEventsCalendarPath } from '../utils/eventTypeQuery';
import { BOOKABLE_ACTIVITY_CARDS } from '../constants/activityCatalog';

/**
 * 活動「分類頁」：依 slug 顯示該類型活動的日曆與預約入口（共用 EventList + initialTab）。
 * 語意為「此類型活動的導覽與預約」，而非單一活動的 detail。
 * TODO: 若未來需單一活動詳情頁（例如 /activities/:slug/events/:eventId），可另建 ActivityEventDetailPage 並由此頁連結。
 */
export default function ActivityCategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const initialTab = slugToTab(slug);
  const titleKey = getCategoryTitleKey(slug);

  if (!isValidActivitySlug(slug) || !initialTab || !titleKey) {
    return <Navigate to="/activities" replace />;
  }

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.activities'), path: '/activities' },
    { label: t(titleKey) },
  ];

  const catalogCard = BOOKABLE_ACTIVITY_CARDS.find((card) => card.slug === slug);
  const activityType = catalogCard?.type;

  return (
    <div className="activity-category-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={t(titleKey)}
        lead={t('page.activityCategoryLead')}
      />
      <div className="activity-category-cta mb-3">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => navigate(getEventsCalendarPath(slug))}
        >
          {t('page.calendarBookingTitle')} →
        </button>
      </div>
      {activityType ? (
        <ActivityPhrasebookPanel activityType={activityType} maxItems={3} compact />
      ) : null}
      <EventList initialTab={initialTab} />
    </div>
  );
}
