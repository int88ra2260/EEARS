'use strict';

const {
  buildB1PlusWatch,
  buildCourseEngagementMap,
  summarizeB1PlusWatch,
  filterByEngagement,
  filterByHasPretest,
  filterByWeakPretestSkill,
  filterByKeyword,
  exactCefrLabel,
  APPROACHING_GSE_MIN,
  APPROACHING_GSE_MAX,
} = require('../services/learningAnalytics/b1PlusWatch');

function student(overrides = {}) {
  return {
    studentId: 'S1',
    department: '外文系',
    college: '文學院',
    cohort: '114',
    isB2plus: false,
    totalCourseHours: 0,
    totalActivityHours: 0,
    ...overrides,
  };
}

/** BESTEP 聽力約 90 分 → GSE 落在 51–58（接近 B2） */
function exam(overrides = {}) {
  return {
    studentId: 'S1',
    skill: 'listening',
    cefrLevel: 'B1',
    rawScore: 90,
    testPhase: 'pre_test',
    examRound: 1,
    examDate: '2025-09-01',
    instrument: 'BESTEP',
    excludeFlag: false,
    registeredNoScoreFlag: false,
    ...overrides,
  };
}

describe('b1PlusWatch', () => {
  it('exposes the approaching-B2 GSE window used by the page', () => {
    expect(APPROACHING_GSE_MIN).toBe(51);
    expect(APPROACHING_GSE_MAX).toBe(58);
    expect(exactCefrLabel('b1+')).toBe('B1+');
  });

  it('includes a student whose best skill GSE is in the B1+ band and not yet B2', () => {
    const engagement = buildCourseEngagementMap(
      [{ studentId: 'S1', semesterId: '114-1', enrollmentStatus: 'enrolled' }],
      '115-1',
    );
    const items = buildB1PlusWatch(
      [student({ totalCourseHours: 0, totalActivityHours: 0 })],
      [
        exam({ skill: 'listening', rawScore: 90, cefrLevel: 'B1' }),
        exam({ skill: 'reading', rawScore: 75, cefrLevel: 'B1' }),
        exam({
          skill: 'listening',
          rawScore: 80,
          cefrLevel: 'B1',
          testPhase: 'post_test',
          examRound: 2,
          examDate: '2026-01-10',
        }),
      ],
      engagement,
    );
    expect(items).toHaveLength(1);
    expect(items[0].currentLevel).toBe('B1+');
    expect(items[0].bestGse).toBeGreaterThanOrEqual(APPROACHING_GSE_MIN);
    expect(items[0].bestGse).toBeLessThanOrEqual(APPROACHING_GSE_MAX);
    expect(items[0].pretest.listening).toBe('B1+');
    expect(items[0].hasCourse).toBe(true);
    expect(items[0].courseInProgress).toBe(false);
    expect(items[0].situation).toBe('course_only');
    expect(items[0].hasPretest).toBe(true);
  });

  it('treats enrollment in the current semester as course-in-progress, not hours', () => {
    const engagement = buildCourseEngagementMap(
      [
        { studentId: 'S1', semesterId: '115-1', enrollmentStatus: 'enrolled' },
        { studentId: 'S2', semesterId: '114-2', enrollmentStatus: 'withdrawn' },
      ],
      '115-1',
    );
    expect(engagement.get('S1')).toEqual({ hasCourse: true, courseInProgress: true });
    expect(engagement.has('S2')).toBe(false);

    const items = buildB1PlusWatch(
      [
        student({ studentId: 'S1', totalCourseHours: 0 }),
        student({ studentId: 'S2', totalCourseHours: 0 }),
      ],
      [exam({ studentId: 'S1' }), exam({ studentId: 'S2' })],
      engagement,
    );
    expect(items.find((row) => row.studentId === 'S1')).toMatchObject({
      hasCourse: true,
      courseInProgress: true,
      situation: 'course_only',
    });
    expect(items.find((row) => row.studentId === 'S2')).toMatchObject({
      hasCourse: false,
      courseInProgress: false,
      situation: 'neither',
    });
  });

  it('drops students already at B2 GSE, early B1 GSE, or GSAT-only rows', () => {
    const items = buildB1PlusWatch(
      [
        student({ studentId: 'B2FLAG', isB2plus: true }),
        student({ studentId: 'B2SCORE' }),
        student({ studentId: 'EARLY' }),
        student({ studentId: 'GSAT' }),
      ],
      [
        exam({ studentId: 'B2FLAG', rawScore: 90 }),
        exam({ studentId: 'B2SCORE', rawScore: 105, cefrLevel: 'B2' }),
        exam({ studentId: 'EARLY', rawScore: 75, cefrLevel: 'B1' }),
        exam({ studentId: 'GSAT', instrument: 'GSAT', rawScore: 90, cefrLevel: 'B1+' }),
      ],
    );
    expect(items).toHaveLength(0);
  });

  it('uses the earlier pretest when a later post-test score is higher', () => {
    const items = buildB1PlusWatch(
      [student()],
      [
        exam({ rawScore: 90, examDate: '2025-09-01', testPhase: 'pre_test' }),
        exam({
          rawScore: 95,
          examDate: '2026-01-01',
          testPhase: 'post_test',
          examRound: 2,
        }),
      ],
    );
    expect(items).toHaveLength(1);
    expect(items[0].pretestGse.listening).toBeLessThan(items[0].currentGse.listening);
    expect(items[0].pretest.listening).toBe('B1+');
    expect(items[0].situation).toBe('neither');
  });

  it('summarizes course and activity coverage, then slices the list', () => {
    const engagement = buildCourseEngagementMap(
      [{ studentId: 'B', semesterId: '114-1', enrollmentStatus: 'enrolled' }],
      '115-1',
    );
    const items = buildB1PlusWatch(
      [
        student({ studentId: 'A', totalCourseHours: 0, totalActivityHours: 0 }),
        student({ studentId: 'B', totalCourseHours: 0, totalActivityHours: 6 }),
      ],
      [
        exam({ studentId: 'A' }),
        exam({ studentId: 'B' }),
      ],
      engagement,
    );
    expect(summarizeB1PlusWatch(items)).toMatchObject({
      matched: 2,
      withPretest: 2,
      withCourse: 1,
      withCourseInProgress: 0,
      withActivity: 1,
      neither: 1,
      both: 1,
      gseMin: 51,
      gseMax: 58,
    });
    expect(filterByEngagement(items, 'neither').map((row) => row.studentId)).toEqual(['A']);
  });

  it('filters by pretest presence, weak skill GSE, and keyword', () => {
    const items = buildB1PlusWatch(
      [
        student({ studentId: 'A' }),
        student({ studentId: 'B' }),
      ],
      [
        exam({ studentId: 'A', skill: 'listening', rawScore: 90, testPhase: 'pre_test' }),
        exam({
          studentId: 'A',
          skill: 'speaking',
          rawScore: 120,
          cefrLevel: 'A2',
          testPhase: 'pre_test',
        }),
        exam({
          studentId: 'B',
          skill: 'listening',
          rawScore: 90,
          testPhase: 'post_test',
          examRound: 2,
        }),
      ],
    );
    expect(filterByHasPretest(items, 'yes').map((row) => row.studentId)).toEqual(['A']);
    expect(filterByHasPretest(items, 'no').map((row) => row.studentId)).toEqual(['B']);
    expect(filterByWeakPretestSkill(items, 'speaking').map((row) => row.studentId)).toEqual(['A']);
    expect(filterByWeakPretestSkill(items, 'listening')).toHaveLength(0);
    expect(filterByKeyword(
      items.map((row) => ({ ...row, studentName: row.studentId === 'A' ? '王小明' : null })),
      '王',
    ).map((row) => row.studentId)).toEqual(['A']);
  });
});
