const mockClassTeacherFindOne = jest.fn();

jest.mock('../models', () => ({
  ClassTeacher: { findOne: (...args) => mockClassTeacherFindOne(...args) },
  RolePermission: { findAll: jest.fn() },
  UserPermissionOverride: { findAll: jest.fn() },
  UserScope: { findAll: jest.fn() },
}));

const {
  canAccessClassByRecord,
  buildClassScopeWhere,
} = require('../services/accessControl/classScopeGuard');

const cls = (overrides = {}) => ({
  id: 10,
  semester: '114-1',
  teacherName: 'Alice',
  ...overrides,
});

describe('classScopeGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClassTeacherFindOne.mockResolvedValue(null);
  });

  it('allows admin to access any class', async () => {
    const result = await canAccessClassByRecord({ role: 'admin' }, cls({ teacherName: 'Bob' }));
    expect(result.allowed).toBe(true);
  });

  it('allows executive to access any class', async () => {
    const result = await canAccessClassByRecord(
      { role: 'teacher', teacherLevel: 'executive', name: 'Carol' },
      cls({ teacherName: 'Bob' })
    );
    expect(result.allowed).toBe(true);
  });

  it('allows regular teacher to access own class by teacherName fallback', async () => {
    const result = await canAccessClassByRecord(
      { id: 5, role: 'teacher', teacherLevel: 'regular', name: 'Alice' },
      cls()
    );
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('own_class_teacher_name');
  });

  it('allows regular teacher to access own class by ClassTeacher mapping', async () => {
    mockClassTeacherFindOne.mockResolvedValue({ id: 1 });
    const result = await canAccessClassByRecord(
      { id: 5, role: 'teacher', teacherLevel: 'regular', name: 'Other' },
      cls()
    );
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('own_class_mapping');
  });

  it('allows et_manager to access own class by teacherName', async () => {
    const result = await canAccessClassByRecord(
      { id: 20, role: 'teacher', teacherLevel: 'et_manager', name: 'Alice' },
      cls()
    );
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('own_class_teacher_name');
  });

  it('denies et_manager on another teacher class', async () => {
    const result = await canAccessClassByRecord(
      { id: 20, role: 'teacher', teacherLevel: 'et_manager', name: 'Bob' },
      cls({ teacherName: 'Alice' })
    );
    expect(result.allowed).toBe(false);
  });

  it('denies regular teacher on another class', async () => {
    const result = await canAccessClassByRecord(
      { id: 5, role: 'teacher', teacherLevel: 'regular', name: 'Bob' },
      cls({ teacherName: 'Alice' })
    );
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('CLASS_SCOPE_DENIED');
  });

  it('denies worker class access', async () => {
    const result = await canAccessClassByRecord({ role: 'worker' }, cls());
    expect(result.allowed).toBe(false);
  });

  it('denies unknown ownership', async () => {
    const result = await canAccessClassByRecord(
      { role: 'teacher', teacherLevel: 'regular', name: '' },
      cls({ teacherName: '' })
    );
    expect(result.allowed).toBe(false);
  });

  it('builds class where for admin, executive, and own-class teachers', () => {
    expect(buildClassScopeWhere({ role: 'admin' })).toEqual({});
    expect(buildClassScopeWhere({ role: 'teacher', teacherLevel: 'executive' })).toEqual({});
    expect(buildClassScopeWhere({ role: 'teacher', teacherLevel: 'regular', name: 'Alice' })).toEqual({ teacherName: 'Alice' });
    expect(buildClassScopeWhere({ role: 'teacher', teacherLevel: 'et_manager', name: 'Alice' })).toEqual({ teacherName: 'Alice' });
    expect(buildClassScopeWhere({ role: 'worker' })).toBeNull();
    expect(buildClassScopeWhere({ role: 'teacher', teacherLevel: 'et_manager', name: '' })).toBeNull();
  });
});
