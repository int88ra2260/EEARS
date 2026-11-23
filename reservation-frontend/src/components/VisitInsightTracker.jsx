import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useStudentSession from '../hooks/useStudentSession';
import {
  closingInsightEvents,
  createInsightState,
  loadInsightState,
  reduceInsight,
  saveInsightState,
} from '../utils/visitInsightSession';

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
    const { state, events } = reduceInsight(current, {
      pathname: location.pathname,
      search: location.search,
      loggedIn,
    });
    saveInsightState(state);
    postInsights(events);
  }, [location.pathname, location.search, loggedIn]);

  useEffect(() => {
    const onHide = () => {
      const current = loadInsightState();
      const events = closingInsightEvents(current, !!session);
      if (!events.length || !current) return;
      saveInsightState({ ...current, orderSent: true });
      postInsights(events, { beacon: true });
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [session]);

  return null;
}
