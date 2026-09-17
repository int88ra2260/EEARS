import React, { useCallback, useMemo, useState } from 'react';
import EventList from '../components/EventList';
import PageHeader from '../components/layout/PageHeader';
import ReservationUsageModal from '../components/modals/ReservationUsageModal';
import { useLanguage } from '../context/LanguageContext';
import '../styles/emi-brand.css';
import '../styles/student-events.css';
import { getReliabilityFault } from '../utils/reliabilityFaults';

/** 同一次瀏覽分頁內按過「我知道了」就不再跳出，避免擋住問卷回流自動開預約。 */
const EVENTS_USAGE_DISMISSED_KEY = 'eears-events-usage-dismissed';

function readUsageDismissed() {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(EVENTS_USAGE_DISMISSED_KEY) === '1';
  } catch (_) {
    return false;
  }
}

/**
 * 日曆預約入口：/events = 依日曆選擇場次、預約或查詢／取消。
 * 與 /activities（活動總覽／分類導覽）互為導流。
 */
export default function EventsPage() {
  const { t } = useLanguage();
  const [showUsageModal, setShowUsageModal] = useState(() => !readUsageDismissed());
  const breadcrumbs = useMemo(() => [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.eventsBooking') },
  ], [t]);

  const handleCloseUsageModal = useCallback(() => {
    try {
      sessionStorage.setItem(EVENTS_USAGE_DISMISSED_KEY, '1');
    } catch (_) {
      /* ignore */
    }
    setShowUsageModal(false);
  }, []);

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
      <ReservationUsageModal show={showUsageModal} onClose={handleCloseUsageModal} />
    </div>
  );
}
