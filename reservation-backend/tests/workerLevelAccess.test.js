/**
 * workerLevel 權限矩陣（與 accessProfile 對齊）
 */
const { P } = require('../auth/permissions');
const { SCOPE } = require('../auth/scopes');
const { buildAccessProfile } = require('../auth/accessProfile');

function profileFor(workerLevel) {
  return buildAccessProfile({ role: 'worker', workerLevel });
}

describe('workerLevel access matrix', () => {
  it('defaults missing workerLevel to event_ops', () => {
    const p = buildAccessProfile({ role: 'worker' });
    expect(p.workerLevel).toBe('event_ops');
    expect(p.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)).toBe(true);
    expect(p.permissionSet.has(P.CAN_MANAGE_SETTINGS)).toBe(false);
    expect(p.permissionSet.has(P.CAN_MANAGE_ACCOUNTS)).toBe(false);
    expect(p.finalScopes).toEqual([SCOPE.ALL]);
  });

  it('event_ops: activity ops without settings/accounts', () => {
    const p = profileFor('event_ops');
    expect(p.permissionSet.has(P.CAN_MANAGE_EVENTS)).toBe(true);
    expect(p.permissionSet.has(P.CAN_CHECKIN_STUDENTS)).toBe(true);
    expect(p.permissionSet.has(P.CAN_MANAGE_VIOLATIONS)).toBe(true);
    expect(p.permissionSet.has(P.CAN_VIEW_ET_GROUPING)).toBe(true);
    expect(p.permissionSet.has(P.CAN_IMPORT_BESTEP)).toBe(false);
    expect(p.permissionSet.has(P.CAN_MANAGE_ANNOUNCEMENTS)).toBe(false);
    expect(p.permissionSet.has(P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS)).toBe(false);
    expect(p.permissionSet.has(P.CAN_MANAGE_SETTINGS)).toBe(false);
    expect(p.finalScopes).toEqual([SCOPE.ALL]);
  });

  it('bestep_ops: english test + BESTEP only', () => {
    const p = profileFor('bestep_ops');
    expect(p.permissionSet.has(P.CAN_VIEW_ENGLISH_TESTS)).toBe(true);
    expect(p.permissionSet.has(P.CAN_IMPORT_BESTEP)).toBe(true);
    expect(p.permissionSet.has(P.CAN_EXPORT_BESTEP)).toBe(true);
    expect(p.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)).toBe(false);
    expect(p.permissionSet.has(P.CAN_MANAGE_ANNOUNCEMENTS)).toBe(false);
    expect(p.permissionSet.has(P.CAN_MANAGE_ACCOUNTS)).toBe(false);
    expect(p.finalScopes).toEqual(expect.arrayContaining([SCOPE.ENGLISH_TEST, SCOPE.CLASS]));
  });

  it('content_editor: announcements + site content only', () => {
    const p = profileFor('content_editor');
    expect(p.permissionSet.has(P.CAN_MANAGE_ANNOUNCEMENTS)).toBe(true);
    expect(p.permissionSet.has(P.CAN_MANAGE_SITE_CONTENT)).toBe(true);
    expect(p.permissionSet.has(P.CAN_MANAGE_SETTINGS)).toBe(false);
    expect(p.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)).toBe(false);
    expect(p.permissionSet.has(P.CAN_IMPORT_BESTEP)).toBe(false);
    expect(p.finalScopes).toEqual([]);
  });

  it('passport_ops: English Learning Passport ops without rules', () => {
    const p = profileFor('passport_ops');
    expect(p.permissionSet.has(P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS)).toBe(true);
    expect(p.permissionSet.has(P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS)).toBe(true);
    expect(p.permissionSet.has(P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS)).toBe(true);
    expect(p.permissionSet.has(P.CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS)).toBe(true);
    expect(p.permissionSet.has(P.CAN_MANAGE_ENGLISH_LEARNING_RULES)).toBe(false);
    expect(p.permissionSet.has(P.CAN_MANAGE_SETTINGS)).toBe(false);
    expect(p.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)).toBe(false);
    expect(p.finalScopes).toEqual([]);
  });
});
