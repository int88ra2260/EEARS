'use strict';

const {
  compareMember,
  summarizeComparisons,
} = require('../services/learningAnalytics/learningAnalyticsTrackingCohortService');

describe('learningAnalyticsTrackingCohortService', () => {
  const member = {
    studentId: 'B001',
    studentName: '王小明',
    department: '外文系',
    enrollmentCohort: '114',
    placementLabel: '中高級',
    examLabel: '前測',
    activityHours: 3,
    courseHours: 18,
  };

  it('compares the saved baseline with later exam and hour changes', () => {
    const row = compareMember(member, {
      studentId: 'B001',
      studentName: '王小明',
      department: '外文系',
      cohort: '114',
      placementLabel: '中高級',
      hasPreTest: true,
      hasPostTest: true,
      hasValidExam: true,
      totalActivityHours: 9,
      totalCourseHours: 36,
    });

    expect(row.baseline).toEqual({ examLabel: '前測', activityHours: 3, courseHours: 18 });
    expect(row.current.examLabel).toBe('前後測');
    expect(row.delta).toEqual({
      activityHours: 6,
      courseHours: 18,
      gainedPostTest: true,
    });
    expect(row.missingFromSnapshot).toBe(false);
  });

  it('keeps the saved student when the latest snapshot no longer has them', () => {
    const row = compareMember(member, undefined);
    expect(row.missingFromSnapshot).toBe(true);
    expect(row.current).toBeNull();
    expect(row.delta.gainedPostTest).toBe(false);
    expect(row.studentName).toBe('王小明');
  });

  it('summarizes how many students gained a post-test or more hours', () => {
    const rows = [
      compareMember(member, {
        hasPreTest: true,
        hasPostTest: true,
        hasValidExam: true,
        totalActivityHours: 6,
        totalCourseHours: 18,
      }),
      compareMember({ ...member, studentId: 'B002', examLabel: '前後測', activityHours: 6, courseHours: 36 }, {
        hasPreTest: true,
        hasPostTest: true,
        hasValidExam: true,
        totalActivityHours: 6,
        totalCourseHours: 36,
      }),
    ];
    expect(summarizeComparisons(rows)).toEqual({
      memberCount: 2,
      stillTracked: 2,
      missingFromSnapshot: 0,
      gainedPostTest: 1,
      activityHoursUp: 1,
      courseHoursUp: 0,
      averageActivityDelta: 1.5,
      averageCourseDelta: 0,
    });
  });
});
