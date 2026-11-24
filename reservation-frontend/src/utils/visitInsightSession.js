const STORAGE_KEY = 'eears-visit-insight';

export function intentForLocation(pathname, search = '') {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const next = params.get('next') || '';
  const candidates = [pathname, next.split('?')[0]];
  for (const raw of candidates) {
    const path = String(raw || '');
    if (!path.startsWith('/')) continue;
    if (path.startsWith('/student/class-credit-allocation')) return 'class_credit';
    if (path.startsWith('/announcements')) return 'announcements';
    if (path === '/events' || path.startsWith('/events/') || path === '/my-reservations') return 'reserve';
  }
  return null;
}

export function createInsightState(loggedIn) {
  return {
    hourSent: false,
    deviceSent: false,
    intent: null,
    sawReserveLoggedOut: false,
    loggedInThisVisit: false,
    arrivedLoggedIn: !!loggedIn,
    orderSent: false,
    scrollWorld: null,
  };
}

export function loadInsightState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.hourSent == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveInsightState(state) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 隱私模式或容量不足時放棄這次紀錄
  }
}

export function reduceInsight(state, input) {
  const { pathname, search, loggedIn } = input;
  const events = [];
  const next = { ...state };
  if (!next.hourSent) {
    events.push({ type: 'visit_hour' });
    next.hourSent = true;
  }
  if (!next.deviceSent && typeof input.isDesktop === 'boolean') {
    events.push({ type: 'device', key: input.isDesktop ? 'desktop' : 'phone' });
    next.deviceSent = true;
  }
  const intent = intentForLocation(pathname, search);
  if (intent && !next.intent) {
    events.push({ type: 'intent', key: intent });
    next.intent = intent;
  }
  if (intent === 'reserve' && !loggedIn) next.sawReserveLoggedOut = true;
  if (loggedIn && !next.arrivedLoggedIn) next.loggedInThisVisit = true;
  if (!next.orderSent) {
    if (next.sawReserveLoggedOut && loggedIn) {
      events.push({ type: 'login_order', key: 'reserve_then_login' });
      next.orderSent = true;
    } else if (next.arrivedLoggedIn && intent === 'reserve') {
      events.push({ type: 'login_order', key: 'already_logged_in' });
      next.orderSent = true;
    } else if (next.loggedInThisVisit && !next.sawReserveLoggedOut && intent === 'reserve') {
      events.push({ type: 'login_order', key: 'login_then_reserve' });
      next.orderSent = true;
    }
  }
  return { state: next, events };
}

export function markScrollWorldShown(state) {
  if (!state || state.scrollWorld) return { state, events: [] };
  return {
    state: { ...state, scrollWorld: 'shown' },
    events: [{ type: 'scroll_world', key: 'shown' }],
  };
}

export function markScrollWorldScrolled(state) {
  if (!state || state.scrollWorld === 'scrolled' || state.scrollWorld === 'closed') {
    return { state, events: [] };
  }
  const events = [];
  if (!state.scrollWorld) events.push({ type: 'scroll_world', key: 'shown' });
  events.push({ type: 'scroll_world', key: 'scrolled' });
  return { state: { ...state, scrollWorld: 'scrolled' }, events };
}

export function finishScrollWorld(state, key) {
  if (!state || state.scrollWorld !== 'shown') return { state, events: [] };
  return {
    state: { ...state, scrollWorld: 'closed' },
    events: [{ type: 'scroll_world', key }],
  };
}

export function closingInsightEvents(state, loggedIn) {
  if (!state || state.orderSent) return [];
  if (state.sawReserveLoggedOut && !loggedIn) {
    return [{ type: 'login_order', key: 'reserve_without_login' }];
  }
  if (state.loggedInThisVisit && state.intent !== 'reserve') {
    return [{ type: 'login_order', key: 'login_without_reserve' }];
  }
  return [];
}
