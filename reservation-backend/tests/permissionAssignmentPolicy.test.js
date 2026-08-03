'use strict';

const { P } = require('../auth/permissions');
const {
  validateCreatePermissionOverrides,
  resolveUpdatePermissionOverrides,
} = require('../auth/permissionAssignmentPolicy');

function adminReq() {
  return { user: { role: 'admin', id: 1 } };
}

function execReq() {
  return { user: { role: 'teacher', teacherLevel: 'executive', id: 2 } };
}

describe('permissionAssignmentPolicy', () => {
  test('admin create may include system-only keys', () => {
    expect(validateCreatePermissionOverrides(adminReq(), { [P.CAN_VIEW_AUDIT_LOGS]: true })).toBeNull();
  });

  test('non-admin create rejects system-only keys', () => {
    expect(validateCreatePermissionOverrides(execReq(), { [P.CAN_VIEW_AUDIT_LOGS]: true })).toBe(
      'PERMISSION_ASSIGNMENT_DENIED'
    );
  });

  test('non-admin update rejects new system-only allow', () => {
    const r = resolveUpdatePermissionOverrides(execReq(), { [P.CAN_MANAGE_SETTINGS]: true }, {});
    expect(r.ok).toBe(false);
  });

  test('non-admin update rejects change to existing system-only', () => {
    const before = { [P.CAN_VIEW_AUDIT_LOGS]: true };
    const r = resolveUpdatePermissionOverrides(execReq(), { [P.CAN_VIEW_AUDIT_LOGS]: false }, before);
    expect(r.ok).toBe(false);
  });

  test('non-admin update merges preserved system-only when clearing', () => {
    const before = { [P.CAN_VIEW_AUDIT_LOGS]: true, [P.CAN_MANAGE_EVENTS]: true };
    const r = resolveUpdatePermissionOverrides(execReq(), null, before);
    expect(r.ok).toBe(true);
    expect(r.merged).toEqual({ [P.CAN_VIEW_AUDIT_LOGS]: true });
  });

  test('non-admin update merges missing system-only from before', () => {
    const before = { [P.CAN_VIEW_AUDIT_LOGS]: true };
    const r = resolveUpdatePermissionOverrides(execReq(), { [P.CAN_MANAGE_EVENTS]: true }, before);
    expect(r.ok).toBe(true);
    expect(r.merged).toEqual({ [P.CAN_MANAGE_EVENTS]: true, [P.CAN_VIEW_AUDIT_LOGS]: true });
  });

  test('admin update passes through null', () => {
    const r = resolveUpdatePermissionOverrides(adminReq(), null, { [P.CAN_VIEW_AUDIT_LOGS]: true });
    expect(r.ok).toBe(true);
    expect(r.merged).toBeNull();
  });
});
