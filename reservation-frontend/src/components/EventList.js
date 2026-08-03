// src/components/EventList.js
// 漸進式模組化：日曆、活動介紹、規則／通知已拆至 components/events/，此檔為 orchestration container
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import EventDetail from './EventDetail';
import {
  getEventBookingState,
  canReserveFromState,
  canWaitlistFromState,
} from '../utils/eventBookingState';
import { bookingStateToReasonCode } from './events/EventDeadlineHint';
import ReservationSearchModal from './ReservationSearchModal';
import { safeAPICall } from '../utils/errorHandler';
import { useLanguage } from '../context/LanguageContext';
import { fetchEvents } from '../services/eventService';
import { fetchEnabledSurveys } from '../services/surveyPublicApi';
import useToast from './ui/useToast';
import EventCalendarSection from './events/EventCalendarSection';
import EventCalendarInsights from './events/EventCalendarInsights';
import EmptyState from './ui/EmptyState';
import {
  parseEventTypeQueryParam,
  eventTypeFilterToQueryParam,
  isInvalidEventTypeQueryParam,
} from '../utils/eventTypeQuery';
import './EventList.css';
import './events/eventTypeFilter.css';
import '../styles/student-events.css';
import {
  createSimulatedApiError,
  createSimulatedNetworkError,
  createSimulatedTimeoutError,
  getReliabilityFault,
  makeDevRequestId,
} from '../utils/reliabilityFaults';

function getInitialEventFilter(initialTabProp) {
  if (typeof window === 'undefined') return 'all';
  if (window.location.pathname === '/events') {
    return parseEventTypeQueryParam(new URLSearchParams(window.location.search).get('type'));
  }
  if (initialTabProp) {
    const tabToType = {
      'english-table': 'English Table',
      'english-club': 'English Club',
      'international-forum': 'International Forum',
      'job-talk': 'Job Talk',
    };
    return tabToType[initialTabProp] || 'all';
  }
  return 'all';
}

function EventList({ initialTab: initialTabProp }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const toast = useToast();

  // 注意：/my-reservations 現由 MyReservationsPage 專用 UI 呈現，不再渲染 EventList

  const [events, setEvents]                         = useState([]);
  const [loading, setLoading]                       = useState(true);
  const [loadError, setLoadError]                   = useState('');
  const [selectedEvent, setSelectedEvent]           = useState(null);
  // 後台啟用中的活動問卷（用於顯示重要通知與問卷連結）
  const [enabledSurveys, setEnabledSurveys] = useState([]);

  const INITIAL_FILTER_FROM_TAB = useMemo(() => {
    const tabToType = {
      'english-table': 'English Table',
      'english-club': 'English Club',
      'international-forum': 'International Forum',
      'job-talk': 'Job Talk',
    };
    return tabToType[initialTabProp] || 'all';
  }, [initialTabProp]);

  const isEventsRoute = location.pathname === '/events';
  const recoveredQueryFlag = searchParams.get('recovered');
  const clearRecoveredQuery = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('recovered');
      next.delete('eventId');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const urlDerivedFilter = useMemo(
    () => parseEventTypeQueryParam(searchParams.get('type')),
    [searchParams],
  );

  const [eventTypeFilter, setEventTypeFilter] = useState(() => getInitialEventFilter(initialTabProp));

  useEffect(() => {
    if (isEventsRoute) {
      setEventTypeFilter(urlDerivedFilter);
    } else {
      setEventTypeFilter(INITIAL_FILTER_FROM_TAB);
    }
  }, [isEventsRoute, urlDerivedFilter, INITIAL_FILTER_FROM_TAB]);

  useEffect(() => {
    if (!isEventsRoute) return;
    const raw = searchParams.get('type');
    if (!isInvalidEventTypeQueryParam(raw)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('type', 'all');
        return next;
      },
      { replace: true },
    );
  }, [isEventsRoute, searchParams, setSearchParams]);

  const filterOptions = useMemo(() => {
    return [
      { value: 'all', labelKey: 'nav.activities', tabId: null },
      { value: 'English Table', labelKey: 'activities.englishTable', tabId: 'english-table' },
      { value: 'English Club', labelKey: 'activities.englishClub', tabId: 'english-club' },
      { value: 'Job Talk', labelKey: 'activities.jobTalk', tabId: 'job-talk' },
      { value: 'International Forum', labelKey: 'activities.internationalForum', tabId: 'international-forum' },
    ];
  }, []);

  // Phase 2.3：問卷完成後自動承接預約成功（自動開啟 booking modal）
  useEffect(() => {
    if (!isEventsRoute) return;
    if (!recoveredQueryFlag) return;
    const recoveredStr = sessionStorage.getItem('pendingReservationRecoveredSuccess');
    if (!recoveredStr) {
      toast.warning('已完成問卷，但找不到可承接的預約資料。請重新選擇活動。');
      clearRecoveredQuery();
      return;
    }
    if (!events || events.length === 0) return;
    try {
      const recovered = JSON.parse(recoveredStr);
      const eventId = recovered?.eventId;
      if (!eventId) {
        toast.warning('預約承接資料不完整，請重新選擇活動。');
        sessionStorage.removeItem('pendingReservationRecoveredSuccess');
        clearRecoveredQuery();
        return;
      }
      const found = events.find((evt) => String(evt.id) === String(eventId));
      if (found) {
        setSelectedEvent(found);
        clearRecoveredQuery(); // 承接成功後清掉 query，避免 refresh 重播
      } else {
        toast.warning('找不到對應活動，可能已下架或時段已更新，請重新選擇活動。');
        sessionStorage.removeItem('pendingReservationRecoveredSuccess');
        clearRecoveredQuery();
      }
    } catch (_) {
      toast.warning('承接資料格式異常，請重新選擇活動。');
      sessionStorage.removeItem('pendingReservationRecoveredSuccess');
      clearRecoveredQuery();
    }
  }, [isEventsRoute, recoveredQueryFlag, events, toast, clearRecoveredQuery]);

  const filteredEvents = useMemo(() => {
    if (eventTypeFilter === 'all') return events;
    return events.filter((evt) => evt.eventType === eventTypeFilter);
  }, [events, eventTypeFilter]);

  const applyEventTypeFilter = useCallback(
    (value) => {
      setEventTypeFilter(value);
      if (location.pathname === '/events') {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set('type', eventTypeFilterToQueryParam(value));
            return next;
          },
          { replace: true },
        );
      }
    },
    [location.pathname, setSearchParams],
  );

  // 載入後台啟用中的活動問卷（僅在啟用時顯示問卷通知）
  useEffect(() => {
    const loadEnabledSurveys = async () => {
      try {
        const data = await fetchEnabledSurveys();
        setEnabledSurveys(data);
      } catch (_) {
        setEnabledSurveys([]);
      }
    };
    loadEnabledSurveys();
  }, []);

  const loadEvents = useCallback(async () => {
    setLoadError('');
    const fault = getReliabilityFault();
    let apiFn = fetchEvents;
    const devRid = makeDevRequestId('DEV');
    if (fault === 'eventsApi500') {
      apiFn = async () => {
        throw createSimulatedApiError({ status: 500, requestId: devRid, message: 'test 500' });
      };
    } else if (fault === 'eventsNetworkError') {
      apiFn = async () => {
        throw createSimulatedNetworkError({ requestId: devRid, message: 'test network error' });
      };
    } else if (fault === 'eventsTimeout') {
      apiFn = async () => {
        throw createSimulatedTimeoutError({ requestId: devRid, message: 'test timeout' });
      };
    }

    const result = await safeAPICall(apiFn);
    if (result.success) {
      setEvents(result.data);
    } else {
      setEvents([]);
      const msg = result.error?.display || result.error?.zh || result.error?.message || '載入活動失敗';
      setLoadError(msg);
      toast.error(msg);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const fillTemplate = useCallback((tpl, vars) => {
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  }, []);

  const canReserveAndReason = useCallback(
    (evt) => {
      const state = getEventBookingState(evt);
      const reasonCode = bookingStateToReasonCode(state);

      if (canReserveFromState(state)) {
        return { canReserve: true, reasonCode: 'OK', reasonMessage: '', bookingState: state };
      }

      let reasonMessage = t('home.eventHoverBadgeUnavailable');
      if (reasonCode === 'FULL') reasonMessage = t('home.calendarAlertFull');
      else if (reasonCode === 'STARTED') reasonMessage = t('home.calendarAlertStarted');
      else if (reasonCode === 'PAST_DEADLINE') reasonMessage = t('home.calendarAlertPastDeadline');
      else if (reasonCode === 'NOT_YET_OPEN' && state.openStart && state.openEnd) {
        reasonMessage = fillTemplate(t('home.calendarAlertNotOpen'), {
          start: state.openStart.format('YYYY/MM/DD HH:mm'),
          end: state.openEnd.format('YYYY/MM/DD HH:mm'),
        });
      }

      return { canReserve: false, reasonCode, reasonMessage, bookingState: state };
    },
    [t, fillTemplate],
  );

  /** 額滿時，與正式預約相同的開放／截止時間窗內可候補 */
  const canWaitlistAndReason = useCallback(
    (evt) => {
      const state = getEventBookingState(evt);
      if (canWaitlistFromState(state)) {
        return { canWaitlist: true, reasonMessage: '', bookingState: state };
      }
      const { reasonMessage } = canReserveAndReason(evt);
      return { canWaitlist: false, reasonMessage, bookingState: state };
    },
    [canReserveAndReason],
  );

  const handleEventClick = (evt) => {
    setSelectedEvent(evt);
  };

  const calendarSectionRef = useRef(null);

  const calendarBookingMeta = useMemo(() => {
    const sortKey = (evt) => `${evt.date}T${evt.startTime}`;
    const sorted = [...filteredEvents].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    let bookableCount = 0;
    let nextBookable = null;
    for (const evt of sorted) {
      const { canReserve, reasonCode } = canReserveAndReason(evt);
      const wl = canWaitlistAndReason(evt);
      const isBookable = canReserve || (reasonCode === 'FULL' && wl.canWaitlist);
      if (canReserve) bookableCount += 1;
      if (!nextBookable && isBookable) nextBookable = evt;
    }
    return {
      bookableCount,
      totalCount: filteredEvents.length,
      nextBookable,
    };
  }, [filteredEvents, canReserveAndReason, canWaitlistAndReason]);

  const handleJumpToNextBookable = useCallback(() => {
    const { nextBookable } = calendarBookingMeta;
    if (!nextBookable) {
      toast.info(t('page.calendarJumpNone'));
      return;
    }
    calendarSectionRef.current?.gotoDate(nextBookable.date);
  }, [calendarBookingMeta, t, toast]);

  const filterBtnRefs = useRef([]);
  const activeFilterIndex = useMemo(() => {
    const i = filterOptions.findIndex((o) => o.value === eventTypeFilter);
    return i >= 0 ? i : 0;
  }, [filterOptions, eventTypeFilter]);

  const onFilterKeyDown = useCallback(
    (e, index) => {
      const len = filterOptions.length;
      let next = index;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        next = (index + 1) % len;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        next = (index - 1 + len) % len;
      } else if (e.key === 'Home') {
        e.preventDefault();
        next = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        next = len - 1;
      } else {
        return;
      }
      const opt = filterOptions[next];
      applyEventTypeFilter(opt.value);
      queueMicrotask(() => filterBtnRefs.current[next]?.focus());
    },
    [filterOptions, applyEventTypeFilter],
  );

  if (loading) {
    return (
      <div className="event-list-shell" role="status" aria-live="polite" aria-busy="true">
        <span className="visually-hidden">{t('home.loadingEvents')}</span>
        <div className="event-list-skeleton">
          <div className="event-list-skeleton__bar event-list-skeleton__bar--wide" />
          <div className="event-list-skeleton__bar event-list-skeleton__bar--med" />
          <div className="event-list-skeleton__bar event-list-skeleton__bar--short" />
          <div className="event-list-skeleton__bar event-list-skeleton__bar--wide" style={{ height: 320 }} />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-4">
        <EmptyState
          icon="⚠️"
          title="載入活動失敗"
          description={loadError}
          actions={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setLoading(true); loadEvents(); }}>
              重新嘗試
            </button>
          }
        />
      </div>
    );
  }

  // 移除errorMsg相關的錯誤頁面顯示

  return (
    <div className="event-list-shell event-list-shell--in-page">
      <div className="event-list-toolbar">
        <div className="event-type-filter mb-0">
        <div
          className="event-type-filter__segmented"
          role="group"
          aria-label={t('page.eventTypeFilterGroupAria')}
        >
          {filterOptions.map((opt, i) => {
            const isActive = eventTypeFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                ref={(el) => {
                  filterBtnRefs.current[i] = el;
                }}
                className={`event-type-filter__btn ${isActive ? 'is-active' : ''}`}
                aria-pressed={isActive}
                aria-label={`${t(opt.labelKey)}${isActive ? t('page.eventTypeFilterCurrentSuffix') : ''}`}
                tabIndex={activeFilterIndex === i ? 0 : -1}
                onKeyDown={(e) => onFilterKeyDown(e, i)}
                onClick={() => applyEventTypeFilter(opt.value)}
              >
                {isActive && (
                  <span className="event-type-filter__btn-check" aria-hidden="true">
                    ✓
                  </span>
                )}
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {events.length === 0 && (
        <div className="event-list-empty border rounded-3 bg-light mb-3 p-3">
          <EmptyState
            icon="📅"
            title={t('activities.noEventsTitle')}
            description={t('activities.noEventsDesc')}
          />
        </div>
      )}

      {events.length > 0 && filteredEvents.length === 0 && (
        <div className="event-list-empty border rounded-3 bg-light mb-3 p-3">
          <EmptyState
            icon="🔍"
            title={t('activities.filterEmptyTitle')}
            description={t('activities.filterEmptyDesc')}
            actions={
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => applyEventTypeFilter('all')}
              >
                {t('activities.showAllActivities')}
              </button>
            }
          />
        </div>
      )}

      {filteredEvents.length > 0 && (
        <EventCalendarInsights
          bookableCount={calendarBookingMeta.bookableCount}
          totalCount={calendarBookingMeta.totalCount}
          hasNextBookable={Boolean(calendarBookingMeta.nextBookable)}
          onJumpNext={handleJumpToNextBookable}
          t={t}
        />
      )}

      <EventCalendarSection
        ref={calendarSectionRef}
        events={filteredEvents}
        canReserveAndReason={canReserveAndReason}
        canWaitlistAndReason={canWaitlistAndReason}
        onEventClick={handleEventClick}
        t={t}
        surveyActive={enabledSurveys.length > 0}
      />

      {selectedEvent && (
        <EventDetail
          show={true}
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* 移除errorMsg modal，改用系統提示 */}
    </div>
  );
}

export default EventList;
