import { describe, expect, test } from 'vitest';
import { P } from '../../constants/permissions';
import { canAccessAdminRoute, getAdminRouteAccess } from '../../constants/adminRouteAccess';
import { buildAccessProfile } from '../../utils/accessControl';
import {
  OPERATIONS_FOLLOW_UPS,
  buildOperationsObservation,
  describeReservationConcentration,
} from './operationsObservation';

function token(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `e30.${body}.sig`;
}

function profile(payload) {
  return buildAccessProfile(token(payload), payload.role || '');
}

const types = [
  { eventType: 'English Table', totalReservations: 7, totalEventCapacity: 40, bookingRate: 17.5 },
  { eventType: 'Job Talk', totalReservations: 2, totalEventCapacity: 10, bookingRate: 20 },
];

describe('operations observation', () => {
  test('names the type with more reservation rows and keeps the population', () => {
    const text = describeReservationConcentration(types);
    expect(text).toContain('「English Table」');
    expect(text).toContain('7 筆預約列');
    expect(text).toContain('不是不重複學生人數');
    expect(text).not.toMatch(/供給不足|成效最好|造成能力/);
  });

  test('does not invent a rate when attendance is missing', () => {
    const model = buildOperationsObservation({
      semester: '114-2',
      dateWindow: '2026/02/01–2026/07/31',
      byEventType: [{ eventType: 'English Table', totalReservations: null }],
      attendanceRate: null,
      violationRate: null,
      accessProfile: null,
    });
    expect(model.lines.join(' ')).toContain('資料不足');
    expect(model.lines.join(' ')).toContain('不另算比例');
    expect(model.lines.join(' ')).not.toMatch(/\d+\.\d+%/);
    expect(model.actions).toEqual([]);
  });

  test('reports a tie without ranking one type above the other', () => {
    const text = describeReservationConcentration([
      { eventType: 'English Table', totalReservations: 4 },
      { eventType: 'English Club', totalReservations: 4 },
    ]);
    expect(text).toContain('同為 4 筆');
    expect(text).toContain('沒有單一較集中的類型');
  });

  test('admin follow-ups are real routes without query filters', () => {
    const admin = profile({ role: 'admin' });
    const model = buildOperationsObservation({
      semester: '114-1',
      dateWindow: null,
      byEventType: types,
      attendanceRate: 40,
      violationRate: 1,
      accessProfile: admin,
    });
    expect(model.lines[0]).toContain('114-1');
    expect(model.lines.join(' ')).toContain('40.0%');
    expect(model.hubPath).toBe('/admin/analytics');
    expect(model.actions.map((action) => action.to)).toEqual([
      '/admin/operations',
      '/admin/operations/participation',
      '/admin/violations',
      '/admin/analytics/risk',
      '/admin/reports',
    ]);
    model.actions.forEach((action) => {
      expect(action.to.includes('?')).toBe(false);
      expect(getAdminRouteAccess(action.to)).toBeTruthy();
      expect(canAccessAdminRoute(admin, action.to)).toBe(true);
    });
  });

  test('a regular teacher does not receive center management links', () => {
    const teacher = profile({ role: 'teacher', teacherLevel: 'regular' });
    expect(teacher.permissionSet.has(P.CAN_VIEW_EVENTS_ADMIN)).toBe(false);
    const model = buildOperationsObservation({
      semester: '114-2',
      dateWindow: '2026/02/01–2026/07/31',
      byEventType: types,
      attendanceRate: 50,
      violationRate: 0,
      accessProfile: teacher,
    });
    expect(model.actions).toEqual([]);
    OPERATIONS_FOLLOW_UPS.forEach((action) => {
      expect(canAccessAdminRoute(teacher, action.to)).toBe(false);
    });
  });

  test('executive can open the same follow-ups as admin', () => {
    const executive = profile({ role: 'teacher', teacherLevel: 'executive' });
    const model = buildOperationsObservation({
      semester: '114-2',
      dateWindow: null,
      byEventType: types,
      attendanceRate: 0,
      violationRate: 2,
      accessProfile: executive,
    });
    expect(model.actions.length).toBe(OPERATIONS_FOLLOW_UPS.length);
    expect(model.lines.join(' ')).toContain('0.0%');
  });
});
