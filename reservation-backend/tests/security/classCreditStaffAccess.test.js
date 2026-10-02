'use strict';

const { buildBasePermissionSet } = require('../../auth/accessProfile');
const { P } = require('../../auth/permissions');

describe('class credit staff access', () => {
  test('deputy manager and event lead can open class credit allocation', () => {
    const deputy = buildBasePermissionSet({ role: 'office_staff', staffLevel: 'deputy_manager' });
    const eventLead = buildBasePermissionSet({ role: 'office_staff', staffLevel: 'event_lead' });
    expect(deputy.has(P.CAN_MANAGE_CLASS_CREDIT)).toBe(true);
    expect(eventLead.has(P.CAN_MANAGE_CLASS_CREDIT)).toBe(true);
    expect(eventLead.has(P.CAN_MANAGE_CLASSES)).toBe(false);
    expect(deputy.has(P.CAN_MANAGE_CLASSES)).toBe(false);
  });

  test('bestep lead does not receive class credit allocation', () => {
    const bestep = buildBasePermissionSet({ role: 'office_staff', staffLevel: 'bestep_lead' });
    expect(bestep.has(P.CAN_MANAGE_CLASS_CREDIT)).toBe(false);
  });
});
