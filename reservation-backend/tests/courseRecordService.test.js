'use strict';

const { Op } = require('sequelize');

jest.mock('../models', () => ({
  CourseEnrollment: { findAll: jest.fn() },
  Course: {},
  CourseOutcomeMapping: {},
  Student: {},
  sequelize: { transaction: jest.fn() },
}));

const { CourseEnrollment } = require('../models');
const { loadStudentCourseRecords } = require('../services/learningJourney/courseRecordService');

describe('loadStudentCourseRecords', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters by enrollment or course semester when semesterId provided', async () => {
    CourseEnrollment.findAll.mockResolvedValue([
      {
        toJSON: () => ({
          semesterId: '114-2',
          enrollmentStatus: 'enrolled',
          finalScore: null,
          passStatus: 'in_progress',
          course: {
            semesterId: '114-2',
            courseCode: 'GESP207',
            courseName: '實用醫療英語（中高級）',
            credits: 2,
            departmentName: '外文系',
          },
        }),
      },
    ]);

    const rows = await loadStudentCourseRecords('b141010003', { semesterId: '114-2' });

    const call = CourseEnrollment.findAll.mock.calls[0][0];
    expect(call.where.studentId).toBe('B141010003');
    expect(call.where[Op.or]).toEqual([
      { semesterId: '114-2' },
      { '$course.semester_id$': '114-2' },
    ]);
    expect(call.subQuery).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0].courseCode).toBe('GESP207');
    expect(rows[0].courseName).toContain('實用醫療英語');
  });
});
