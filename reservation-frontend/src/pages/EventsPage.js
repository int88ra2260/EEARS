import React from 'react';
import EventList from '../components/EventList';
import '../styles/emi-brand.css';
import '../styles/student-events.css';
import { getReliabilityFault } from '../utils/reliabilityFaults';

/**
 * 日曆預約入口：/events = 依日曆選擇場次、預約或查詢／取消。
 * 與 /activities（活動總覽／分類導覽）互為導流。
 */
export default function EventsPage() {
  if (getReliabilityFault() === 'renderCrash') {
    throw new Error('test crash (reliabilityFault=renderCrash)');
  }

  return (
    <div className="events-page">
      <EventList />
    </div>
  );
}
