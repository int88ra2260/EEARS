'use strict';

const {
  CONTRACT_VERSION,
  labelResource,
  RESOURCE_LABELS,
  buildAbilitySummary,
  buildDepartmentB2,
  buildCoverage,
  buildGrowthView,
  buildCohortLevelTable,
  resolveEnrollmentCohortFromRoster,
} = require('../services/learningAnalytics/learningAnalyticsOverviewService');

describe('learningAnalyticsOverviewService', () => {
  it('exports contract version and resource labels', () => {
    expect(CONTRACT_VERSION).toBe('learning-analytics.overview.v3');
    expect(labelResource('ENGLISH_TABLE')).toBe(RESOURCE_LABELS.ENGLISH_TABLE);
    expect(labelResource('UNKNOWN')).toBe('UNKNOWN');
  });

  it('counts a skill as B2 only from that skill\'s highest raw-score exam', () => {
    const students = [
      { studentId: 'A', isB2plus: true, department: '外文' },
      { studentId: 'B', isB2plus: false, department: '外文' },
      { studentId: 'C', isB2plus: false, department: '外文' },
    ];
    const exams = [
      { studentId: 'A', skill: 'listening', rawScore: 400, cefrLevel: 'B2', instrument: 'TOEIC', examDate: '2025-01-01' },
      { studentId: 'A', skill: 'listening', rawScore: 200, cefrLevel: 'A2', instrument: 'TOEIC', examDate: '2024-01-01' },
      { studentId: 'B', skill: 'listening', rawScore: 900, cefrLevel: 'B1', instrument: 'TOEIC', examDate: '2025-01-01' },
      { studentId: 'B', skill: 'listening', rawScore: 300, cefrLevel: 'B2', instrument: 'IELTS', examDate: '2024-01-01' },
      { studentId: 'C', skill: 'listening', rawScore: 120, cefrLevel: 'B2', instrument: 'GSAT', examDate: '2025-01-01' },
    ];
    const ability = buildAbilitySummary(students, exams);
    expect(ability.total).toBe(3);
    expect(ability.overall.count).toBe(1);
    expect(ability.skills.find((row) => row.skill === 'listening').count).toBe(1);
    expect(ability.skills.find((row) => row.skill === 'reading').count).toBe(0);
  });

  it('separates pretest, posttest and both', () => {
    const students = [{ studentId: 'A' }, { studentId: 'B' }, { studentId: 'C' }];
    const exams = [
      { studentId: 'A', testPhase: 'pre_test', instrument: 'TOEIC' },
      { studentId: 'A', testPhase: 'post_test', instrument: 'TOEIC' },
      { studentId: 'B', testPhase: 'single', instrument: 'TOEIC' },
      { studentId: 'C', testPhase: 'pre_test', instrument: 'GSAT' },
    ];
    const coverage = buildCoverage(students, exams);
    expect(coverage.pretest.count).toBe(2);
    expect(coverage.posttest.count).toBe(1);
    expect(coverage.both.count).toBe(1);
  });

  it('shows insufficient growth instead of zero when nobody can be paired', () => {
    const rows = buildGrowthView(10, [
      { skill: 'listening', actualGseGrowthAverage: 1.5, pairedStudentCount: 4, sampleSize: 5 },
      { skill: 'writing', actualGseGrowthAverage: 0, pairedStudentCount: 3, sampleSize: 3 },
    ]);
    expect(rows.find((row) => row.skill === 'listening')).toMatchObject({
      status: 'ok',
      average: 1.5,
      sampleSize: 4,
      unavailable: 6,
    });
    expect(rows.find((row) => row.skill === 'writing')).toMatchObject({ status: 'ok', average: 0 });
    expect(rows.find((row) => row.skill === 'speaking')).toMatchObject({
      status: 'insufficient',
      average: null,
    });
  });

  it('groups students without a department', () => {
    const rows = buildDepartmentB2([
      { department: '外文', isB2plus: true },
      { department: '', isB2plus: false },
    ]);
    expect(rows.find((row) => row.department === '外文').count).toBe(1);
    expect(rows.find((row) => row.department === '未提供').total).toBe(1);
  });

  it('counts B1, B1+ and students without a valid exam by admission year', () => {
    const students = [
      { studentId: 'A', cohort: '113', hasValidExam: true },
      { studentId: 'B', cohort: '113', hasValidExam: true },
      { studentId: 'C', cohort: '113', hasValidExam: false },
      { studentId: 'D', cohort: '114', hasValidExam: true },
      { studentId: 'E', cohort: '', hasValidExam: false },
    ];
    const exams = [
      { studentId: 'A', skill: 'listening', rawScore: 80, instrument: 'BESTEP', examDate: '2025-06-01' },
      { studentId: 'B', skill: 'listening', rawScore: 90, instrument: 'BESTEP', examDate: '2025-06-01' },
      { studentId: 'B', skill: 'reading', rawScore: 100, instrument: 'BESTEP', examDate: '2025-06-01' },
      { studentId: 'D', skill: 'listening', rawScore: 90, instrument: 'BESTEP', examDate: '2025-06-01' },
      { studentId: 'D', skill: 'listening', rawScore: 120, instrument: 'GSAT', examDate: '2024-01-01' },
    ];
    const rows = buildCohortLevelTable(students, exams);
    expect(rows.map((row) => row.cohort)).toEqual(['114', '113', '未提供']);
    expect(rows.find((row) => row.cohort === '113')).toMatchObject({
      total: 3,
      b1: 1,
      b1Plus: 0,
      noExam: 1,
    });
    expect(rows.find((row) => row.cohort === '114')).toMatchObject({
      total: 1,
      b1: 0,
      b1Plus: 1,
      noExam: 0,
      b1PlusRate: 1,
    });
    expect(rows.find((row) => row.cohort === '未提供')).toMatchObject({
      total: 1,
      noExam: 1,
      noExamRate: 1,
    });
    const year113 = rows.find((row) => row.cohort === '113');
    expect(year113.b1Rate).toBeCloseTo(1 / 3, 4);
    expect(year113.noExamRate).toBeCloseTo(1 / 3, 4);
  });

  it('resolves enrollment cohort from roster year, grade+semester, or student id', () => {
    expect(resolveEnrollmentCohortFromRoster({
      enrollmentYear: 112,
      studentId: 'D1130001',
      grade: 2,
      semesterId: '114-1',
    })).toBe('112');
    expect(resolveEnrollmentCohortFromRoster({
      enrollmentYear: null,
      studentId: 'D1130001',
      grade: 2,
      semesterId: '114-1',
    })).toBe('113');
    expect(resolveEnrollmentCohortFromRoster({
      enrollmentYear: null,
      studentId: 'D1120001',
      grade: null,
      semesterId: '114-1',
    })).toBe('112');
  });
});
