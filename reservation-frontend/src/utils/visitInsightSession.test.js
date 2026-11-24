import {
  closingInsightEvents,
  createInsightState,
  finishScrollWorld,
  intentForLocation,
  markScrollWorldScrolled,
  markScrollWorldShown,
  reduceInsight,
} from './visitInsightSession';

describe('visit insight session', () => {
  it('classifies the first purpose and ignores later pages', () => {
    let state = createInsightState(false);
    const home = reduceInsight(state, { pathname: '/', search: '', loggedIn: false });
    state = home.state;
    expect(home.events.map((event) => event.type)).toEqual(['visit_hour']);

    const announcements = reduceInsight(state, {
      pathname: '/announcements',
      search: '',
      loggedIn: false,
    });
    state = announcements.state;
    expect(announcements.events).toEqual([{ type: 'intent', key: 'announcements' }]);

    const reserve = reduceInsight(state, { pathname: '/events', search: '', loggedIn: false });
    expect(reserve.events).toEqual([]);
    expect(reserve.state.intent).toBe('announcements');
  });

  it('records reserve then login, and login then reserve', () => {
    const openedReserve = reduceInsight(createInsightState(false), {
      pathname: '/events',
      search: '',
      loggedIn: false,
    });
    const afterLogin = reduceInsight(openedReserve.state, {
      pathname: '/events',
      search: '',
      loggedIn: true,
    });
    expect(afterLogin.events).toContainEqual({ type: 'login_order', key: 'reserve_then_login' });

    const loggedInFirst = reduceInsight(createInsightState(false), {
      pathname: '/student/login',
      search: '',
      loggedIn: true,
    });
    const thenReserve = reduceInsight(loggedInFirst.state, {
      pathname: '/events',
      search: '',
      loggedIn: true,
    });
    expect(thenReserve.events).toContainEqual({ type: 'login_order', key: 'login_then_reserve' });
  });

  it('reads class credit from the login next path', () => {
    expect(intentForLocation('/student/login', '?next=%2Fstudent%2Fclass-credit-allocation')).toBe('class_credit');
  });

  it('records the device once for the visit', () => {
    const opened = reduceInsight(createInsightState(false), {
      pathname: '/',
      search: '',
      loggedIn: false,
      isDesktop: false,
    });
    expect(opened.events).toContainEqual({ type: 'device', key: 'phone' });
    const again = reduceInsight(opened.state, {
      pathname: '/announcements',
      search: '',
      loggedIn: false,
      isDesktop: true,
    });
    expect(again.events.some((event) => event.type === 'device')).toBe(false);
  });

  it('counts scroll-world use separately from closing without using it', () => {
    const shown = markScrollWorldShown(createInsightState(false));
    expect(shown.events).toEqual([{ type: 'scroll_world', key: 'shown' }]);
    expect(markScrollWorldShown(shown.state).events).toEqual([]);

    const used = markScrollWorldScrolled(shown.state);
    expect(used.events).toEqual([{ type: 'scroll_world', key: 'scrolled' }]);
    expect(finishScrollWorld(used.state, 'closed_idle').events).toEqual([]);

    const closed = finishScrollWorld(shown.state, 'closed_idle');
    expect(closed.events).toEqual([{ type: 'scroll_world', key: 'closed_idle' }]);
    expect(finishScrollWorld(createInsightState(false), 'left_idle').events).toEqual([]);
  });

  it('counts a reserve visit that leaves without login', () => {
    const opened = reduceInsight(createInsightState(false), {
      pathname: '/events',
      search: '',
      loggedIn: false,
    });
    expect(closingInsightEvents(opened.state, false)).toEqual([
      { type: 'login_order', key: 'reserve_without_login' },
    ]);
  });
});
