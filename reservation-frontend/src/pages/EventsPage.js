import React, { useMemo } from 'react';
import EventList from '../components/EventList';
import PageHeader from '../components/layout/PageHeader';
import { useLanguage } from '../context/LanguageContext';
import '../styles/emi-brand.css';
import '../styles/student-events.css';
import { getReliabilityFault } from '../utils/reliabilityFaults';

/**
 * 日曆預約入口：/events = 依日曆選擇場次、預約或查詢／取消。
 * 與 /activities（活動總覽／分類導覽）互為導流。
 */
export default function EventsPage() {
  const { t } = useLanguage();
  const breadcrumbs = useMemo(() => [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.eventsBooking') },
  ], [t]);

  if (getReliabilityFault() === 'renderCrash') {
    throw new Error('test crash (reliabilityFault=renderCrash)');
  }

  return (
    <div className="events-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={t('page.calendarBookingTitle')}
        lead={t('page.calendarBookingLead')}
      />
      <EventList />
    </div>
  );
}
