import { useState, useEffect, useCallback, useMemo } from 'react';
import { EVENT_DETAIL_COPY } from '../constants/adminEventDetailCopy';
import { debugEventDetail } from '../utils/eventDetailDebug';
import { fetchEventMeta as fetchEventMetaApi } from '../services/eventService';

/**
 * 活動基本資料（GET /api/events/:id/meta）— Phase 5 輕量 payload + aggregate 統計
 */
export function useEventMeta({ token, eventId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const eid = useMemo(() => {
    const n = Number(eventId);
    return Number.isFinite(n) ? n : null;
  }, [eventId]);

  const load = useCallback(async () => {
    if (!eid || !token) {
      setLoading(false);
      if (!eid) setError('無效的活動編號');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const j = await fetchEventMetaApi(token, eid);
      setData(j);
      debugEventDetail('meta:loaded', { eventId: eid });
    } catch (e) {
      setError(e.message || EVENT_DETAIL_COPY.metaLoadFailed);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [eid, token]);

  useEffect(() => {
    load();
  }, [load]);

  const ready = !loading && !error && data != null;

  return {
    loading,
    error,
    reload: load,
    ready,
    eventId: eid,
    name: data?.name ?? '',
    date: data?.date ?? '',
    startTime: data?.startTime ?? '',
    endTime: data?.endTime ?? '',
    location: data?.location ?? '',
    maxCapacity: data?.maxCapacity != null ? Number(data.maxCapacity) : null,
    eventType: data?.eventType || 'English Table',
    reservedCount: data?.reserved != null ? Number(data.reserved) : null,
    availableSpots: data?.availableSpots != null ? Number(data.availableSpots) : null,
    checkedInCount: data?.checkedInCount != null ? Number(data.checkedInCount) : null,
    uncheckedCount: data?.uncheckedCount != null ? Number(data.uncheckedCount) : null,
    violationRegisteredCount: data?.violationRegisteredCount != null ? Number(data.violationRegisteredCount) : null,
    autoCheckCompleted: Boolean(data?.autoCheckCompleted),
  };
}
