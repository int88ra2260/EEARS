const { P } = require('../auth/permissions');
const { SCOPE } = require('../auth/scopes');
const { canAccessEventType } = require('../auth/accessProfile');
const {
  canAccessEventByRecord,
  buildEventScopeWhere,
  normalizeEventTypeForScope,
} = require('../services/accessControl/eventScopeGuard');

const event = (eventType) => ({ id: 1, eventType });

describe('eventScopeGuard', () => {
  it('normalizes supported event types', () => {
    expect(normalizeEventTypeForScope('English Table').scope).toBe('english_table');
    expect(normalizeEventTypeForScope('International Forum').scope).toBe('international_forum');
    expect(normalizeEventTypeForScope('Job Talk').scope).toBe('job_talk');
  });

  it('allows admin to access all events including unknown event types', () => {
    const user = { role: 'admin' };
    expect(canAccessEventByRecord(user, event('English Table')).allowed).toBe(true);
    expect(canAccessEventByRecord(user, event('Unknown')).allowed).toBe(true);
  });

  it('allows executive to access supported event types', () => {
    const user = { role: 'teacher', teacherLevel: 'executive' };
    expect(canAccessEventByRecord(user, event('Job Talk')).allowed).toBe(true);
  });

  it('denies executive on unknown event types by fail-close rule', () => {
    const user = { role: 'teacher', teacherLevel: 'executive' };
    const result = canAccessEventByRecord(user, event('Unknown'));
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('EVENT_SCOPE_DENIED');
  });

  it('allows et_manager to access English Table, Job Talk, English Club', () => {
    const user = { role: 'teacher', teacherLevel: 'et_manager' };
    expect(canAccessEventByRecord(user, event('English Table')).allowed).toBe(true);
    expect(canAccessEventByRecord(user, event('Job Talk')).allowed).toBe(true);
    expect(canAccessEventByRecord(user, event('English Club')).allowed).toBe(true);
    expect(canAccessEventByRecord(user, event('International Forum')).allowed).toBe(false);
  });

  it('denies if_manager on Job Talk', () => {
    const user = { role: 'teacher', teacherLevel: 'if_manager' };
    expect(canAccessEventByRecord(user, event('Job Talk')).allowed).toBe(false);
  });

  it('denies jt_manager on English Table', () => {
    const user = { role: 'teacher', teacherLevel: 'jt_manager' };
    expect(canAccessEventByRecord(user, event('English Table')).allowed).toBe(false);
  });

  it('denies worker without explicit event context', () => {
    const user = { role: 'worker', workerLevel: 'event_ops' };
    const result = canAccessEventByRecord(user, event('English Table'));
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('MISSING_EVENT_CONTEXT');
  });

  it('allows event_ops worker with ALL scope and explicit event context', () => {
    const user = { role: 'worker', workerLevel: 'event_ops' };
    const result = canAccessEventByRecord(user, event('English Table'), {
      explicitEventContext: true,
      anyPermissions: [P.CAN_VIEW_RESERVATIONS],
    });
    expect(result.allowed).toBe(true);
  });

  it('allows ET-scoped worker only on English Table with explicit context', () => {
    const user = {
      role: 'worker',
      workerLevel: 'event_ops',
      scopes: [SCOPE.ENGLISH_TABLE],
    };
    const opts = {
      explicitEventContext: true,
      anyPermissions: [P.CAN_VIEW_RESERVATIONS],
    };
    expect(canAccessEventByRecord(user, event('English Table'), opts).allowed).toBe(true);
    expect(canAccessEventByRecord(user, event('English Club'), opts).allowed).toBe(false);
    expect(canAccessEventByRecord(user, event('Job Talk'), opts).allowed).toBe(false);
  });

  it('allows EC-scoped worker only on English Club with explicit context', () => {
    const user = {
      role: 'worker',
      workerLevel: 'event_ops',
      scopes: [SCOPE.ENGLISH_CLUB],
    };
    const opts = {
      explicitEventContext: true,
      anyPermissions: [P.CAN_VIEW_RESERVATIONS],
    };
    expect(canAccessEventByRecord(user, event('English Club'), opts).allowed).toBe(true);
    expect(canAccessEventByRecord(user, event('English Table'), opts).allowed).toBe(false);
    expect(canAccessEventByRecord(user, event('Job Talk'), opts).allowed).toBe(false);
  });

  it('allows JT-scoped worker only on Job Talk with explicit context', () => {
    const user = {
      role: 'worker',
      workerLevel: 'event_ops',
      scopes: [SCOPE.JOB_TALK],
    };
    const opts = {
      explicitEventContext: true,
      anyPermissions: [P.CAN_VIEW_RESERVATIONS],
    };
    expect(canAccessEventByRecord(user, event('Job Talk'), opts).allowed).toBe(true);
    expect(canAccessEventByRecord(user, event('English Table'), opts).allowed).toBe(false);
    expect(canAccessEventByRecord(user, event('English Club'), opts).allowed).toBe(false);
  });

  it('buildEventScopeWhere filters by worker scopes', () => {
    const etWorker = {
      role: 'worker',
      workerLevel: 'event_ops',
      scopes: [SCOPE.ENGLISH_TABLE],
    };
    const where = buildEventScopeWhere(etWorker);
    expect(where).toEqual({
      eventType: expect.arrayContaining(['english_table', 'English Table', 'ET']),
    });

    const allWorker = { role: 'worker', workerLevel: 'event_ops' };
    expect(buildEventScopeWhere(allWorker)).toEqual({});
  });

  it('denies regular teacher without supported event scope', () => {
    const user = { role: 'teacher', teacherLevel: 'regular' };
    expect(canAccessEventByRecord(user, event('English Table')).allowed).toBe(false);
  });
});

describe('canAccessEventType for scoped workers', () => {
  it('restricts ET-scoped worker to English Table', () => {
    const user = {
      role: 'worker',
      workerLevel: 'event_ops',
      scopes: [SCOPE.ENGLISH_TABLE],
    };
    expect(canAccessEventType(user, 'English Table')).toBe(true);
    expect(canAccessEventType(user, 'english_table')).toBe(true);
    expect(canAccessEventType(user, 'English Club')).toBe(false);
    expect(canAccessEventType(user, 'Job Talk')).toBe(false);
  });

  it('restricts EC-scoped worker to English Club', () => {
    const user = {
      role: 'worker',
      workerLevel: 'event_ops',
      scopes: [SCOPE.ENGLISH_CLUB],
    };
    expect(canAccessEventType(user, 'English Club')).toBe(true);
    expect(canAccessEventType(user, 'English Table')).toBe(false);
  });

  it('restricts JT-scoped worker to Job Talk', () => {
    const user = {
      role: 'worker',
      workerLevel: 'event_ops',
      scopes: [SCOPE.JOB_TALK],
    };
    expect(canAccessEventType(user, 'Job Talk')).toBe(true);
    expect(canAccessEventType(user, 'English Table')).toBe(false);
  });

  it('allows unscoped event_ops worker (ALL) on supported types', () => {
    const user = { role: 'worker', workerLevel: 'event_ops' };
    expect(canAccessEventType(user, 'English Table')).toBe(true);
    expect(canAccessEventType(user, 'Job Talk')).toBe(true);
    expect(canAccessEventType(user, 'English Club')).toBe(true);
  });
});
