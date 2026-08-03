jest.mock('../models', () => ({
  ClassTeacher: { findAll: jest.fn() },
  Class: { findAll: jest.fn() },
  ClassMembership: { findAll: jest.fn() },
  Teacher: { findByPk: jest.fn() },
}));

jest.mock('../services/kpiService', () => ({
  normalizeStudentIds: (ids) => (ids || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean),
  buildKpiContext: jest.fn().mockResolvedValue({}),
  getBestepRegistrationMetrics: jest.fn().mockResolvedValue({ bestepRegistrationRate: 0 }),
  getBestepAttendanceMetrics: jest.fn().mockResolvedValue({}),
  getBestepPassMetrics: jest.fn().mockResolvedValue({ bestepPassRate: 0 }),
  getParticipationMetrics: jest.fn().mockResolvedValue({ participationRate: 50 }),
  getExemptionMetrics: jest.fn().mockResolvedValue({ exemptionApprovedRate: 0 }),
}));

jest.mock('../services/riskDetectionService', () => ({
  getRisksForStudents: jest.fn().mockResolvedValue([]),
}));

jest.mock('../utils/analyticsCache', () => ({
  getCache: jest.fn(() => null),
  setCache: jest.fn(),
}));

const { ClassTeacher, Class, ClassMembership, Teacher } = require('../models');
const { resolveTeacherClassIds, getTeacherDashboard } = require('../services/teacherEvaluationService');

describe('teacherEvaluationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ClassTeacher.findAll.mockResolvedValue([]);
    ClassMembership.findAll.mockResolvedValue([]);
  });

  it('resolveTeacherClassIds falls back to Class.teacherName when ClassTeacher is empty', async () => {
    Teacher.findByPk.mockResolvedValue({ id: 20, name: '莊家雄' });
    Class.findAll.mockResolvedValue([{ id: 101 }, { id: 102 }]);

    const ids = await resolveTeacherClassIds(20, '114-2');

    expect(Class.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { semester: '114-2', teacherName: '莊家雄' },
      })
    );
    expect(ids.sort()).toEqual([101, 102]);
  });

  it('resolveTeacherClassIds merges ClassTeacher and Class.teacherName', async () => {
    ClassTeacher.findAll.mockResolvedValue([{ classId: 1 }]);
    Teacher.findByPk.mockResolvedValue({ id: 20, name: 'Alice' });
    Class.findAll.mockResolvedValue([{ id: 2 }]);

    const ids = await resolveTeacherClassIds(20, '114-1');
    expect(ids.sort()).toEqual([1, 2]);
  });

  it('getTeacherDashboard returns classes when only teacherName roster exists', async () => {
    Teacher.findByPk.mockResolvedValue({ id: 20, name: '莊家雄' });
    Class.findAll.mockImplementation((opts) => {
      if (opts.where && opts.where.teacherName) {
        return Promise.resolve([{ id: 10 }]);
      }
      if (opts.where && opts.where.id) {
        return Promise.resolve([{ id: 10, name: '英文中高級GEEN117D' }]);
      }
      return Promise.resolve([]);
    });
    ClassMembership.findAll.mockResolvedValue([{ classId: 10, studentId: 'A001' }]);

    const result = await getTeacherDashboard(20, '114-2');

    expect(result.classes).toHaveLength(1);
    expect(result.classes[0].className).toBe('英文中高級GEEN117D');
    expect(result.summary.totalClasses).toBe(1);
  });
});
