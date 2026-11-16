'use strict';

const {
  CONTRACT_VERSION,
  labelResource,
  RESOURCE_LABELS,
  buildAbilitySummary,
  buildDepartmentB2,
  buildCoverage,
  buildGrowthView,
} = require('../services/learningAnalytics/learningAnalyticsOverviewService');

describe('learningAnalyticsOverviewService', () => {
  it('exports contract version and resource labels', () => {
    expect(CONTRACT_VERSION).toBe('learning-analytics.overview.v1');
    expect(labelResource('ENGLISH_TABLE')).toBe(RESOURCE_LABELS.ENGLISH_TABLE);
    expect(labelResource('UNKNOWN')).toBe('UNKNOWN');
  });

  it('counts skill B2 by student and skips GSAT', () => {
    const students = [
      { studentId: 'A', isB2plus: true, department: '外文' },
      { studentId: 'B', isB2plus: false, department: '外文' },
    ];
    const exams = [
      { studentId: 'A', skill: 'listening', isB2plus: true, instrument: 'TOEIC' },
      { studentId: 'A', skill: 'listening', isB2plus: true, instrument: 'IELTS' },
      { studentId: 'B', skill: 'listening', isB2plus: true, instrument: 'GSAT' },
    ];
    const ability = buildAbilitySummary(students, exams);
    expect(ability.total).toBe(2);
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
});
