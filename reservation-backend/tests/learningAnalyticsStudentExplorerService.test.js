'use strict';

const { Op } = require('sequelize');
const { getStudentExplorer } = require('../services/learningAnalytics/learningAnalyticsStudentExplorerService');

jest.mock('../models', () => ({
  LjAnalyticStudent: {
    findAll: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
  },
  Student: { findAll: jest.fn() },
  EtStudentMaster: { findAll: jest.fn() },
}));

jest.mock('../services/learningJourney/analytics/timelineReadService', () => ({
  resolveLatestSnapshotVersion: jest.fn().mockResolvedValue('global-test'),
}));

const { LjAnalyticStudent, Student, EtStudentMaster } = require('../models');

describe('learningAnalyticsStudentExplorerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    LjAnalyticStudent.findAll.mockImplementation(async (opts) => {
      const attrs = opts.attributes || [];
      if (attrs.includes('department') && !attrs.includes('studentId')) {
        return [
          { department: '化學系', cohort: '113' },
          { department: '電機工程學系', cohort: '114' },
        ];
      }
      return [{
        studentId: 'D001',
        department: '電機工程學系',
        college: '工學院',
        cohort: '114',
        enrollmentTerm: '114-1',
        baselineEnglishScore: '12.0',
        baselineCefr: 'B1',
        totalActivityHours: '8.5',
        hasValidExam: true,
        retestFlag: false,
        isB2plus: false,
      }];
    });
    LjAnalyticStudent.count.mockResolvedValue(1);
    LjAnalyticStudent.findOne.mockResolvedValue({ avgHours: '8.5' });
    Student.findAll.mockResolvedValue([{ studentId: 'D001', nameZh: '王小明' }]);
    EtStudentMaster.findAll.mockResolvedValue([]);
  });

  it('filters by department and activity hours without applying unavailable fields', async () => {
    const result = await getStudentExplorer({
      department: '電機工程學系',
      min_activity_hours: '6',
      placement: 'low',
      eap_esp: 'yes',
      exam_pairing: 'missing',
    });

    const where = LjAnalyticStudent.count.mock.calls[0][0].where;
    expect(where.snapshotVersion).toBe('global-test');
    expect(where.department).toBe('電機工程學系');
    expect(where.totalActivityHours[Op.gte]).toBe(6);
    expect(where.baselineLevel).toBeUndefined();
    expect(where.retestFlag).toBeUndefined();

    expect(result.appliedFilters).toEqual({
      keyword: '',
      department: '電機工程學系',
      cohort: '',
      minBaselineScore: null,
      minActivityHours: 6,
      hasValidExam: null,
    });
    expect(result.unavailableFilters.map((item) => item.id)).toEqual([
      'placement',
      'eap_esp',
      'exam_pairing',
    ]);
    expect(result.summary).toEqual({
      matched: 1,
      withValidExam: 1,
      averageActivityHours: 8.5,
    });
    expect(result.items[0]).toMatchObject({
      studentId: 'D001',
      studentName: '王小明',
      baselineEnglishScore: 12,
      baselineCefr: 'B1',
      totalActivityHours: 8.5,
    });
    expect(result.options.departments).toEqual(['化學系', '電機工程學系']);
    expect(result.options.cohorts).toEqual(['113', '114']);
  });

  it('restricts keyword search to roster and master student ids', async () => {
    Student.findAll.mockImplementation(async (opts) => {
      if (opts.where && opts.where[Op.or]) {
        return [{ studentId: 'D11400001' }];
      }
      return [{ studentId: 'D11400001', nameZh: '李承恩' }];
    });

    await getStudentExplorer({ keyword: '承恩' });

    const where = LjAnalyticStudent.count.mock.calls[0][0].where;
    expect(where.studentId[Op.in]).toEqual(expect.arrayContaining(['D11400001', '承恩']));
  });
});
