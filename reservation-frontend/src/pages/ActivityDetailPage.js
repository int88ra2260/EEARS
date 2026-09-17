import React, { useEffect, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import EventList from '../components/EventList';
import PageHeader from '../components/layout/PageHeader';
import ActivityPhrasebookPanel from '../components/guides/ActivityPhrasebookPanel';
import Spinner from 'react-bootstrap/Spinner';
import '../styles/student-events.css';
import '../components/guides/ActivityPhrasebook.css';
import { resolveBookableSlug, slugToTab } from '../data/activitySlugs';
import { getEventsCalendarPath } from '../utils/eventTypeQuery';
import { fetchPublicEventTypes } from '../services/eventTypeApi';
import { DEFAULT_EVENT_TYPES } from '../constants/eventTypeCatalog';

/**
 * 活動「分類頁」：依 slug 顯示該類型活動的日曆與預約入口（共用 EventList + initialTab）。
 */
export default function ActivityCategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [eventTypes, setEventTypes] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchPublicEventTypes({ force: true });
      if (!cancelled) {
        setEventTypes(Array.isArray(list) && list.length ? list : DEFAULT_EVENT_TYPES);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (eventTypes === null) {
    return (
      <div className="py-5 text-center">
        <Spinner animation="border" />
      </div>
    );
  }

  const resolved = resolveBookableSlug(slug, eventTypes);
  const initialTab = slugToTab(slug);

  if (!resolved || !initialTab) {
    return <Navigate to="/activities" replace />;
  }

  const pageTitle = resolved.titleKey ? t(resolved.titleKey) : resolved.displayName;

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.activities'), path: '/activities' },
    { label: pageTitle },
  ];

  return (
    <div className="activity-category-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={pageTitle}
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
      {resolved.phrasebookActivityType ? (
        <ActivityPhrasebookPanel activityType={resolved.phrasebookActivityType} maxItems={3} compact />
      ) : null}
      <EventList initialTab={initialTab} />
    </div>
  );
}
