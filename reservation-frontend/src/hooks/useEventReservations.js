import { useState, useEffect, useCallback, useRef } from 'react';
import { EVENT_DETAIL_COPY } from '../constants/adminEventDetailCopy';
import { debugEventDetail } from '../utils/eventDetailDebug';
import { fetchEventReservations } from '../services/eventAdminService';

/**
 * 活動預約／簽到用名單（GET /api/events/:id/reservations）— 依 tab lazy load
 */
export function useEventReservations({ token, eventId, enabled }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  const loadReservations = useCallback(async () => {
    if (!eventId || !token) return null;
    return fetchEventReservations(token, eventId);
  }, [eventId, token]);

  const load = useCallback(
    async (force = false) => {
      if (!eventId || !token) return;
      if (loadedRef.current && !force) return;
      setLoading(true);
      setError('');
      try {
        const data = await loadReservations();
        setPayload(data);
        loadedRef.current = true;
        setLoaded(true);
        debugEventDetail('reservations:loaded', { eventId, count: data?.reservations?.length ?? 0 });
      } catch (e) {
        setError(e.message || EVENT_DETAIL_COPY.reservationsLoadFailed);
        if (force) {
          setPayload(null);
          setLoaded(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [eventId, token, loadReservations]
  );

  useEffect(() => {
    if (!enabled || !eventId || !token) return;
    if (loadedRef.current) return;
    load(false);
  }, [enabled, eventId, token, load]);

  /** 變更後強制重抓（仍不重複觸發 idle loading 若已載入） */
  const refresh = useCallback(async () => {
    if (!eventId || !token) return;
    setLoading(true);
    setError('');
    try {
      const data = await loadReservations();
      setPayload(data);
      loadedRef.current = true;
      setLoaded(true);
      debugEventDetail('reservations:refresh', { eventId, count: data?.reservations?.length ?? 0 });
    } catch (e) {
      setError(e.message || EVENT_DETAIL_COPY.reservationsLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [eventId, token, loadReservations]);

  const invalidateCache = useCallback(() => {
    loadedRef.current = false;
    setLoaded(false);
    setPayload(null);
  }, []);

  const reservations = payload?.reservations ?? [];
  const eventDate = payload?.eventDate ?? '';
  const eventStartTime = payload?.eventStartTime ?? '';
  const eventName = payload?.eventName ?? '';
  const eventType = payload?.eventType ?? 'English Table';
  const autoCheckCompleted = payload?.autoCheckCompleted ?? false;

  return {
    loading,
    error,
    loaded,
    load,
    refresh,
    invalidateCache,
    reservations,
    setPayload,
    eventDate,
    eventStartTime,
    eventName,
    eventType,
    autoCheckCompleted,
  };
}
