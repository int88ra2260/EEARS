const { P } = require('../auth/permissions');
const {
  canAccessEventByRecord,
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
    const user = { role: 'worker' };
    const result = canAccessEventByRecord(user, event('English Table'));
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('MISSING_EVENT_CONTEXT');
  });

  it('allows worker with explicit event context and operation permission', () => {
    const user = { role: 'worker' };
    const result = canAccessEventByRecord(user, event('English Table'), {
      explicitEventContext: true,
      anyPermissions: [P.CAN_CHECKIN_STUDENTS],
    });
    expect(result.allowed).toBe(true);
  });

  it('denies regular teacher without supported event scope', () => {
    const user = { role: 'teacher', teacherLevel: 'regular' };
    expect(canAccessEventByRecord(user, event('English Table')).allowed).toBe(false);
  });
});
