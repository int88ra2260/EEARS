'use strict';

jest.mock('../models', () => ({
  Op: { in: Symbol('in') },
  EtEnrollmentSnapshot: { findAll: jest.fn() },
  Student: {},
  EtExamAttempt: {},
  EtExamAttemptSkillScore: {},
  ActivityParticipation: {},
  CourseEnrollment: {},
  Course: {},
  ExamRegistration: {},
  BestepAttendance: {},
  BestepExamScore: {}
}));

jest.mock('../services/learningJourney/bestSkillService', () => ({
  SKILLS: ['listening', 'reading', 'speaking', 'writing'],
  getStudentBestSkillsWithSource: jest.fn(),
  getStudentsBestSkillsMap: jest.fn()
}));

const { EtEnrollmentSnapshot } = require('../models');
const { getStudentsBestSkillsMap } = require('../services/learningJourney/bestSkillService');
const { getSemesterStudents } = require('../services/learningJourney/learningJourneyV3ReadService');

function makeSnapshot(studentId, studentName, grade, department) {
  return { studentId, studentName, grade, department, college: null, className: null };
}

describe('learningJourneyV3ReadService.getSemesterStudents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('supports keyword + grade + department + b2Skill and returns filters metadata', async () => {
    EtEnrollmentSnapshot.findAll.mockResolvedValue([
      makeSnapshot('S001', '王小明', '1', '外文系'),
      makeSnapshot('S002', '李小華', '2', '中文系'),
      makeSnapshot('S003', '陳大文', '5', '資工系')
    ]);
    getStudentsBestSkillsMap.mockResolvedValue(new Map([
      ['S001', { listening: { rank: 4, cefr: 'B2' }, reading: null, speaking: null, writing: null }],
      ['S002', { listening: { rank: 3, cefr: 'B1' }, reading: null, speaking: null, writing: null }],
      ['S003', { listening: { rank: 5, cefr: 'C1' }, reading: null, speaking: null, writing: null }]
    ]));

    const result = await getSemesterStudents('114-1', {
      keyword: '王',
      grade: '1',
      department: '外文系',
      b2Skill: 'listening',
      limit: 20,
      offset: 0
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].studentId).toBe('S001');
    expect(result.pagination.total).toBe(1);
    expect(result.filters.departments).toEqual(['中文系', '外文系', '資工系']);
    expect(result.filters.grades).toEqual(['1', '2', '5']);
  });

  it('supports skill sort with null values always last', async () => {
    EtEnrollmentSnapshot.findAll.mockResolvedValue([
      makeSnapshot('S001', 'A', '1', '外文系'),
      makeSnapshot('S002', 'B', '1', '外文系'),
      makeSnapshot('S003', 'C', '1', '外文系')
    ]);
    getStudentsBestSkillsMap.mockResolvedValue(new Map([
      ['S001', { writing: { rank: 4, cefr: 'B2' } }],
      ['S002', { writing: null }],
      ['S003', { writing: { rank: 6, cefr: 'C2' } }]
    ]));

    const descResult = await getSemesterStudents('114-1', { sortBy: 'writing', sortOrder: 'desc' });
    expect(descResult.items.map((x) => x.studentId)).toEqual(['S003', 'S001', 'S002']);

    const ascResult = await getSemesterStudents('114-1', { sortBy: 'writing', sortOrder: 'asc' });
    expect(ascResult.items.map((x) => x.studentId)).toEqual(['S001', 'S003', 'S002']);
  });

  it('keeps stable tie-break by studentId and missing skill does not crash', async () => {
    EtEnrollmentSnapshot.findAll.mockResolvedValue([
      makeSnapshot('S001', 'A', '1', '外文系'),
      makeSnapshot('S002', 'B', '1', '外文系'),
      makeSnapshot('S003', 'C', '1', '外文系')
    ]);
    getStudentsBestSkillsMap.mockResolvedValue(new Map([
      ['S001', { speaking: { rank: 5, cefr: 'C1' } }],
      ['S002', { speaking: { rank: 5, cefr: 'C1' } }],
      ['S003', {}]
    ]));

    const descResult = await getSemesterStudents('114-1', { sortBy: 'speaking', sortOrder: 'desc' });
    expect(descResult.items.map((x) => x.studentId)).toEqual(['S001', 'S002', 'S003']);
  });

  it('enforces teacher allowedStudentIds before filtering', async () => {
    EtEnrollmentSnapshot.findAll.mockResolvedValue([makeSnapshot('S001', 'A', '1', '外文系')]);
    getStudentsBestSkillsMap.mockResolvedValue(new Map([['S001', {}]]));

    await getSemesterStudents('114-1', { allowedStudentIds: ['S001'] });
    const where = EtEnrollmentSnapshot.findAll.mock.calls[0][0].where;
    expect(where.semesterId).toBe('114-1');
    expect(where.studentId).toBeDefined();
  });
});
