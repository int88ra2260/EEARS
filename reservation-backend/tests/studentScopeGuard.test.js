const mockClassFindAll = jest.fn();
const mockClassFindByPk = jest.fn();
const mockClassMembershipFindAll = jest.fn();
const mockClassMembershipFindOne = jest.fn();
const mockClassTeacherFindAll = jest.fn();
const mockClassTeacherFindOne = jest.fn();

jest.mock('../models', () => ({
  Class: {
    findAll: (...args) => mockClassFindAll(...args),
    findByPk: (...args) => mockClassFindByPk(...args),
  },
  ClassMembership: {
    findAll: (...args) => mockClassMembershipFindAll(...args),
    findOne: (...args) => mockClassMembershipFindOne(...args),
  },
  ClassTeacher: {
    findAll: (...args) => mockClassTeacherFindAll(...args),
    findOne: (...args) => mockClassTeacherFindOne(...args),
  },
  RolePermission: { findAll: jest.fn() },
  UserPermissionOverride: { findAll: jest.fn() },
  UserScope: { findAll: jest.fn() },
}));

const {
  canAccessStudentById,
  buildStudentScopeWhere,
  canAccessClassStudent,
} = require('../services/accessControl/studentScopeGuard');

describe('studentScopeGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClassFindAll.mockResolvedValue([]);
    mockClassFindByPk.mockResolvedValue(null);
    mockClassMembershipFindAll.mockResolvedValue([]);
    mockClassMembershipFindOne.mockResolvedValue(null);
    mockClassTeacherFindAll.mockResolvedValue([]);
    mockClassTeacherFindOne.mockResolvedValue(null);
  });

  it('allows admin access to any student', async () => {
    const result = await canAccessStudentById({ role: 'admin' }, 'A123');
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('all');
  });

  it('allows executive access to any student', async () => {
    const result = await canAccessStudentById({ role: 'teacher', teacherLevel: 'executive' }, 'A123');
    expect(result.allowed).toBe(true);
  });

  it('allows office_staff bestep_lead access to any student', async () => {
    const result = await canAccessStudentById({ role: 'office_staff', staffLevel: 'bestep_lead' }, 'A123');
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('all');
  });

  it('denies office_staff event_lead without LJ permissions', async () => {
    const result = await canAccessStudentById({ role: 'office_staff', staffLevel: 'event_lead' }, 'A123');
    expect(result.allowed).toBe(false);
  });

  it('allows regular teacher access to own class student by teacherName roster', async () => {
    mockClassFindAll.mockResolvedValue([{ id: 7 }]);
    mockClassMembershipFindAll.mockResolvedValue([{ studentId: 'A123' }]);
    const result = await canAccessStudentById(
      { id: 5, role: 'teacher', teacherLevel: 'regular', name: 'Alice' },
      'a123',
      { semesterId: '114-1' }
    );
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('own_class_student');
  });

  it('denies regular teacher access to other class student', async () => {
    mockClassFindAll.mockResolvedValue([{ id: 7 }]);
    mockClassMembershipFindAll.mockResolvedValue([{ studentId: 'A123' }]);
    const result = await canAccessStudentById(
      { id: 5, role: 'teacher', teacherLevel: 'regular', name: 'Alice' },
      'B999',
      { semesterId: '114-1' }
    );
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('STUDENT_SCOPE_DENIED');
  });

  it('allows et_manager access to own class student', async () => {
    mockClassFindAll.mockResolvedValue([{ id: 7 }]);
    mockClassMembershipFindAll.mockResolvedValue([{ studentId: 'A123' }]);
    const result = await canAccessStudentById(
      { id: 20, role: 'teacher', teacherLevel: 'et_manager', name: 'Alice' },
      'A123',
      { semesterId: '114-1' }
    );
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('own_class_student');
  });

  it('allows if_manager access to own class student', async () => {
    mockClassFindAll.mockResolvedValue([{ id: 8 }]);
    mockClassMembershipFindAll.mockResolvedValue([{ studentId: 'B456' }]);
    const result = await canAccessStudentById(
      { id: 21, role: 'teacher', teacherLevel: 'if_manager', name: 'Bob' },
      'B456',
      { semesterId: '114-1' }
    );
    expect(result.allowed).toBe(true);
  });

  it('denies et_manager access to student outside own classes', async () => {
    mockClassFindAll.mockResolvedValue([{ id: 7 }]);
    mockClassMembershipFindAll.mockResolvedValue([{ studentId: 'A123' }]);
    const result = await canAccessStudentById(
      { id: 20, role: 'teacher', teacherLevel: 'et_manager', name: 'Alice' },
      'Z999',
      { semesterId: '114-1' }
    );
    expect(result.allowed).toBe(false);
  });

  it('denies worker student access', async () => {
    const result = await canAccessStudentById({ role: 'worker' }, 'A123');
    expect(result.allowed).toBe(false);
  });

  it('denies unknown class-student relation', async () => {
    mockClassFindByPk.mockResolvedValue({ id: 3, semester: '114-1', teacherName: 'Alice' });
    mockClassTeacherFindOne.mockResolvedValue({ id: 1 });
    mockClassMembershipFindOne.mockResolvedValue(null);
    const result = await canAccessClassStudent(
      { id: 5, role: 'teacher', teacherLevel: 'regular', name: 'Alice' },
      3,
      'A123',
      { semesterId: '114-1' }
    );
    expect(result.allowed).toBe(false);
  });

  it('builds student where for admin and own-class teachers, but fails closed for worker', async () => {
    expect(await buildStudentScopeWhere({ role: 'admin' })).toEqual({});
    mockClassFindAll.mockResolvedValue([{ id: 7 }]);
    mockClassMembershipFindAll.mockResolvedValue([{ studentId: 'A123' }]);
    const teacherWhere = await buildStudentScopeWhere(
      { role: 'teacher', teacherLevel: 'regular', name: 'Alice' },
      { semesterId: '114-1' }
    );
    expect(Object.keys(teacherWhere)).toContain('studentId');
    const etWhere = await buildStudentScopeWhere(
      { role: 'teacher', teacherLevel: 'et_manager', name: 'Alice' },
      { semesterId: '114-1' }
    );
    expect(Object.keys(etWhere)).toContain('studentId');
    expect(await buildStudentScopeWhere({ role: 'worker' })).toBeNull();
  });
});
