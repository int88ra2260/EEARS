import { useEffect, useState } from 'react';
import {
  buildBookableActivityCards,
  CATALOG_DISPLAY_CARDS,
  WRITING_WORKSHOP_CARD,
} from '../constants/activityCatalog';
import { DEFAULT_EVENT_TYPES } from '../constants/eventTypeCatalog';
import { fetchPublicEventTypes } from '../services/eventTypeApi';

const FALLBACK_BOOKABLE = buildBookableActivityCards(
  DEFAULT_EVENT_TYPES.filter((r) => r.isActive !== false)
);

/**
 * 學生端活動目錄：可預約類型來自 /api/event-types，並固定附加寫作工坊外部卡。
 */
export default function useBookableActivityCatalog() {
  const [bookableCards, setBookableCards] = useState(FALLBACK_BOOKABLE);
  const [catalogDisplayCards, setCatalogDisplayCards] = useState(CATALOG_DISPLAY_CARDS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchPublicEventTypes({ force: true });
        if (cancelled) return;
        const bookable = buildBookableActivityCards(
          Array.isArray(list) && list.length ? list : DEFAULT_EVENT_TYPES
        );
        setBookableCards(bookable);
        setCatalogDisplayCards([...bookable, WRITING_WORKSHOP_CARD]);
      } catch {
        if (!cancelled) {
          setBookableCards(FALLBACK_BOOKABLE);
          setCatalogDisplayCards([...FALLBACK_BOOKABLE, WRITING_WORKSHOP_CARD]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { bookableCards, catalogDisplayCards, loading };
}
