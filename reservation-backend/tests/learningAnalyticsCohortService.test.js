'use strict';

const {
  accumulateCohortCoverage,
  aggregateGrowthByGroup,
  buildGroupGradeBreakdowns,
  buildParticipationComparison,
} = require('../services/learningAnalytics/learningAnalyticsCohortServiceHelpers');

describe('learningAnalyticsCohortServiceHelpers', () => {
  const studentById = new Map([
    ['A', { studentId: 'A', department: 'CS', exposureLevel: 'high' }],
    ['B', { studentId: 'B', department: 'EE', exposureLevel: 'low' }],
    ['C', { studentId: 'C', department: 'CS', exposureLevel: 'none' }],
  ]);

  const episodes = [
    { studentId: 'A', actualGseGrowth: 20, adjustedGseGrowth: 10 },
    { studentId: 'B', actualGseGrowth: 5, adjustedGseGrowth: 2 },
    { studentId: 'C', actualGseGrowth: 15, adjustedGseGrowth: 8 },
  ];

  it('counts missing exams, at least one valid exam, and snapshot B2 within each group', () => {
    const groups = accumulateCohortCoverage([
      { department: '外文系', hasValidExam: false, isB2plus: false },
      { department: '外文系', hasValidExam: true, isB2plus: false },
      { department: '外文系', hasValidExam: true, isB2plus: true },
      { department: '電機系', hasValidExam: false, isB2plus: false },
    ], 'department');
    const foreign = groups.get('外文系');
    expect(foreign.students).toBe(3);
    expect(foreign.withExamCount).toBe(2);
    expect(foreign.students - foreign.withExamCount).toBe(1);
    expect(foreign.b2plusCount).toBe(1);
    expect(groups.get('電機系')).toEqual(expect.objectContaining({
      students: 1,
      withExamCount: 0,
      b2plusCount: 0,
    }));
  });

  it('splits a department or college into current-roster grades and keeps the headcount', () => {
    const students = [
      { studentId: 'a1', department: '外文系', college: '文學院', hasValidExam: true, isB2plus: false },
      { studentId: 'A2', department: '外文系', college: '文學院', hasValidExam: false, isB2plus: true },
      { studentId: 'A3', department: '外文系', college: '文學院', hasValidExam: true, isB2plus: false },
      { studentId: 'B1', department: '電機系', college: '工學院', hasValidExam: true, isB2plus: true },
    ];
    const grades = new Map([
      ['A1', '大一'],
      ['A2', '2'],
      ['B1', '大三'],
    ]);
    const byDepartment = buildGroupGradeBreakdowns(students, 'department', grades);
    expect(byDepartment.get('外文系').map((row) => row.grade)).toEqual(['大一', '大二', '缺年級']);
    const freshman = byDepartment.get('外文系')[0];
    expect(freshman).toEqual(expect.objectContaining({
      students: 1,
      withExamCount: 1,
      withoutExamCount: 0,
      b2plusCount: 0,
    }));
    const missing = byDepartment.get('外文系')[2];
    expect(missing.students).toBe(1);
    expect(byDepartment.get('外文系').reduce((sum, row) => sum + row.students, 0)).toBe(3);
    expect(byDepartment.get('電機系')[0].grade).toBe('大三');
    expect(buildGroupGradeBreakdowns(students, 'college', grades).get('文學院')).toHaveLength(3);
    expect(buildGroupGradeBreakdowns(students, 'cohort', grades).size).toBe(0);
  });

  it('aggregates growth by department', () => {
    const map = aggregateGrowthByGroup(episodes, studentById, 'department');
    expect(map.get('CS').growthEpisodeCount).toBe(2);
    expect(map.get('CS').avgActualGseGrowth).toBe(17.5);
    expect(map.get('EE').avgAdjustedGseGrowth).toBe(2);
  });

  it('builds participation comparison buckets', () => {
    const students = [...studentById.values()];
    const rows = buildParticipationComparison(episodes, students);
    const participated = rows.find((row) => row.key === 'participated');
    const notParticipated = rows.find((row) => row.key === 'notParticipated');
    expect(participated.avgActualGseGrowth).toBe(20);
    expect(notParticipated.avgActualGseGrowth).toBe(10);
    expect(participated.causalClaimAllowed).toBe(false);
  });
});
