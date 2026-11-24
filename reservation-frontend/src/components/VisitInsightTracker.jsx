import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useStudentSession from '../hooks/useStudentSession';
import {
  closingInsightEvents,
  createInsightState,
  finishScrollWorld,
  loadInsightState,
  markScrollWorldScrolled,
  markScrollWorldShown,
  reduceInsight,
  saveInsightState,
} from '../utils/visitInsightSession';

const DESKTOP_MQ = '(min-width: 861px)';

function applyScrollWorld(state, marker) {
  const marked = marker(state);
  if (marked.events.length) saveInsightState(marked.state);
  return marked;
}

function postInsights(events, { beacon = false } = {}) {
  if (!events.length) return;
  const body = JSON.stringify({ events });
  if (beacon && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon('/api/stats/visit-insights', blob)) return;
  }
  fetch('/api/stats/visit-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

export default function VisitInsightTracker() {
  const location = useLocation();
  const session = useStudentSession();
  const loggedIn = !!session;

  useEffect(() => {
    const current = loadInsightState() || createInsightState(loggedIn);
    const reduced = reduceInsight(current, {
      pathname: location.pathname,
      search: location.search,
      loggedIn,
      isDesktop: window.matchMedia(DESKTOP_MQ).matches,
    });
    const shown = document.body.classList.contains('swt-overlay-open')
      ? markScrollWorldShown(reduced.state)
      : { state: reduced.state, events: [] };
    saveInsightState(shown.state);
    postInsights([...reduced.events, ...shown.events]);
  }, [location.pathname, location.search, loggedIn]);

  useEffect(() => {
    const sendScrollOutcome = (scrollKey, beacon) => {
      const current = loadInsightState();
      const scroll = finishScrollWorld(current, scrollKey);
      if (!scroll.events.length) return;
      saveInsightState(scroll.state);
      postInsights(scroll.events, { beacon });
    };
    const onHide = () => {
      const current = loadInsightState();
      const orderEvents = closingInsightEvents(current, !!session);
      const scroll = finishScrollWorld(current, 'left_idle');
      const events = [...orderEvents, ...scroll.events];
      if (!events.length || !current) return;
      saveInsightState({
        ...scroll.state,
        orderSent: orderEvents.length ? true : current.orderSent,
      });
      postInsights(events, { beacon: true });
    };
    const onOpened = () => {
      const marked = applyScrollWorld(loadInsightState() || createInsightState(!!session), markScrollWorldShown);
      postInsights(marked.events);
    };
    const onEngaged = () => {
      const marked = applyScrollWorld(loadInsightState(), markScrollWorldScrolled);
      postInsights(marked.events);
    };
    const onClosed = () => sendScrollOutcome('closed_idle', false);
    const onLeft = () => sendScrollOutcome('left_idle', true);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('eears-sw-overlay-opened', onOpened);
    window.addEventListener('eears-sw-engaged', onEngaged);
    window.addEventListener('eears-sw-overlay-closed', onClosed);
    window.addEventListener('eears-sw-overlay-left', onLeft);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('eears-sw-overlay-opened', onOpened);
      window.removeEventListener('eears-sw-engaged', onEngaged);
      window.removeEventListener('eears-sw-overlay-closed', onClosed);
      window.removeEventListener('eears-sw-overlay-left', onLeft);
    };
  }, [session]);

  return null;
}
