const { allowedAudienceTypes, canViewAudience } = require('../services/announcementAudience');

describe('announcement audience', () => {
  test('anonymous viewers only see all', () => {
    expect(allowedAudienceTypes('public')).toEqual(['all']);
    expect(canViewAudience('students', 'public')).toBe(false);
    expect(canViewAudience('all', 'public')).toBe(true);
    expect(canViewAudience(null, 'public')).toBe(true);
  });

  test('signed-in roles see their own audience plus all', () => {
    expect(canViewAudience('students', 'student')).toBe(true);
    expect(canViewAudience('teachers', 'student')).toBe(false);
    expect(canViewAudience('teachers', 'teacher')).toBe(true);
    expect(canViewAudience('admins', 'teacher')).toBe(false);
    expect(canViewAudience('admins', 'admin')).toBe(true);
    expect(canViewAudience('students', 'admin')).toBe(false);
  });
});
