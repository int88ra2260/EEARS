import { consumeStaffNext, rememberStaffNext, safeStaffNext, staffLoginPath } from './staffLoginNext';

describe('safeStaffNext', () => {
  test('keeps an admin path and query', () => {
    expect(safeStaffNext('/admin/et-grouping/my-sessions?eventId=3&checkInToken=abc')).toBe(
      '/admin/et-grouping/my-sessions?eventId=3&checkInToken=abc',
    );
  });

  test('rejects off-site targets', () => {
    expect(safeStaffNext('https://example.com/admin')).toBe('');
    expect(safeStaffNext('//example.com/admin')).toBe('');
    expect(safeStaffNext('/student/progress')).toBe('');
  });
});

describe('staff login next storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('remembers a check-in link and consumes it once', () => {
    rememberStaffNext('/admin/et-grouping/my-sessions?eventId=3&checkInToken=abc');
    expect(consumeStaffNext()).toBe('/admin/et-grouping/my-sessions?eventId=3&checkInToken=abc');
    expect(consumeStaffNext()).toBe('');
  });

  test('builds a login url that keeps the admin path', () => {
    expect(staffLoginPath('/admin/et-grouping/my-sessions?eventId=3&checkInToken=abc')).toBe(
      '/login?next=%2Fadmin%2Fet-grouping%2Fmy-sessions%3FeventId%3D3%26checkInToken%3Dabc',
    );
    expect(staffLoginPath('/')).toBe('/login');
  });
});
