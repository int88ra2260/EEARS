jest.mock('../models', () => ({
  Course: { findAll: jest.fn() },
  CourseEnrollment: {},
}));

jest.mock('../services/accessControl/studentScopeGuard', () => ({
  getAllowedStudentIds: jest.fn(),
}));

const { Course } = require('../models');
const { getAllowedStudentIds } = require('../services/accessControl/studentScopeGuard');
const { getUserLearningJourneyScope } = require('../services/learningJourney/learningJourneyAccessService');

describe('learningJourneyAccessService teacher scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Course.findAll.mockResolvedValue([]);
  });

  it('merges Course enrollments with Class roster students for regular teacher', async () => {
    Course.findAll.mockResolvedValue([
      {
        id: 1,
        instructorName: 'Alice',
        enrollments: [{ studentId: 'S001' }],
      },
    ]);
    getAllowedStudentIds.mockResolvedValue({
      allowed: true,
      unrestricted: false,
      allowedStudentIds: ['S002'],
    });

    const scope = await getUserLearningJourneyScope(
      { role: 'teacher', teacherLevel: 'regular', name: 'Alice' },
      '114-2'
    );

    expect(scope.scope).toBe('teacher');
    expect(scope.allowedStudentIds.sort()).toEqual(['S001', 'S002']);
  });

  it('includes class roster for et_manager', async () => {
    getAllowedStudentIds.mockResolvedValue({
      allowed: true,
      unrestricted: false,
      allowedStudentIds: ['S100'],
    });

    const scope = await getUserLearningJourneyScope(
      { role: 'teacher', teacherLevel: 'et_manager', name: 'Bob' },
      '114-2'
    );

    expect(scope.scope).toBe('teacher');
    expect(scope.allowedStudentIds).toEqual(['S100']);
  });

  it('office_staff bestep_lead with LJ permissions gets all scope', async () => {
    const scope = await getUserLearningJourneyScope(
      { role: 'office_staff', staffLevel: 'bestep_lead' },
      '114-2'
    );

    expect(scope.scope).toBe('all');
  });

  it('office_staff event_lead without LJ permissions gets none scope', async () => {
    const scope = await getUserLearningJourneyScope(
      { role: 'office_staff', staffLevel: 'event_lead' },
      '114-2'
    );

    expect(scope.scope).toBe('none');
  });
});
