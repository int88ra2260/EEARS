/**
 * 管理後台 legacy 總覽（AdminDashboard.jsx）
 * 並行載入 KPI，單一來源失敗不影響其他區塊。
 */
import { useEffect, useMemo, useState } from 'react';
import {
  fetchBlacklistAll,
  fetchDashboardEvents,
  fetchDashboardReservations,
  fetchLegacyDraftAnnouncementCount,
  fetchLegacyEnglishPendingCount,
} from '../services/adminDashboardApi';

const INITIAL_SOURCE_STATUS = {
  events: 'unknown',
  reservations: 'unknown',
  english: 'unknown',
  announcements: 'unknown',
  violations: 'unknown',
};

export function useAdminDashboard({ token, userRole, toast }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [englishPendingCount, setEnglishPendingCount] = useState(null);
  const [announcementDraftCount, setAnnouncementDraftCount] = useState(null);
  const [violations, setViolations] = useState([]);
  const [sourceStatus, setSourceStatus] = useState(INITIAL_SOURCE_STATUS);

  useEffect(() => {
    let ignore = false;

    if (!token) {
      setLoading(false);
      setError('尚未登入，請先登入後查看總覽。');
      return () => { ignore = true; };
    }

    const load = async () => {
      setLoading(true);
      setError('');

      const tasks = await Promise.allSettled([
        fetchDashboardEvents(token, userRole),
        fetchDashboardReservations(token, userRole),
        fetchLegacyEnglishPendingCount(token, userRole),
        fetchLegacyDraftAnnouncementCount(token),
        fetchBlacklistAll(token, userRole),
      ]);

      if (ignore) return;

      const eventData = tasks[0].status === 'fulfilled' && Array.isArray(tasks[0].value) ? tasks[0].value : [];
      const reservationData = tasks[1].status === 'fulfilled' && Array.isArray(tasks[1].value) ? tasks[1].value : [];
      const englishCount = tasks[2].status === 'fulfilled' ? tasks[2].value : null;
      const draftCount = tasks[3].status === 'fulfilled' ? tasks[3].value : null;
      const violationData = tasks[4].status === 'fulfilled' && Array.isArray(tasks[4].value) ? tasks[4].value : [];

      setSourceStatus({
        events: tasks[0].status === 'fulfilled' ? 'ok' : 'fail',
        reservations: tasks[1].status === 'fulfilled' ? 'ok' : 'fail',
        english: tasks[2].status === 'fulfilled' ? 'ok' : 'fail',
        announcements: tasks[3].status === 'fulfilled' ? 'ok' : 'fail',
        violations: tasks[4].status === 'fulfilled' ? 'ok' : 'fail',
      });

      setEvents(eventData);
      setReservations(reservationData);
      setViolations(violationData);
      setEnglishPendingCount(englishCount);
      setAnnouncementDraftCount(draftCount);

      if (tasks.every((t) => t.status === 'rejected')) {
        setError('目前無法載入總覽資料，請稍後再試。');
        toast?.warning?.('總覽資料載入失敗，請稍後重試');
      }

      setLoading(false);
    };

    load();
    return () => { ignore = true; };
  }, [token, userRole, toast]);

  const todayReservations = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return reservations.filter((r) => String(r.createdAt || r.timestamp || '').startsWith(today)).length;
  }, [reservations]);

  const recentEvents = useMemo(() => events.slice(0, 5), [events]);
  const recentViolations = useMemo(() => violations.slice(0, 5), [violations]);

  return {
    loading,
    error,
    events,
    todayReservations,
    englishPendingCount,
    announcementDraftCount,
    sourceStatus,
    recentEvents,
    recentViolations,
  };
}
