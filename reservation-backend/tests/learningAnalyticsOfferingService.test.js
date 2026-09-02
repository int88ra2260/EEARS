'use strict';

const {
  buildStudentGrowthMap,
  aggregateOfferingMetrics,
  buildCourseOfferings,
  buildInstructorOfferings,
  buildActivityOfferings,
  buildResourceCategoryOfferings,
  buildStudentDetailRows,
  resolveOfferingParticipantIds,
  normalizeDimension,
  normalizeInstructorGrouping,
  MIN_GROWTH_SAMPLE,
} = require('../services/learningAnalytics/learningAnalyticsOfferingService');

describe('learningAnalyticsOfferingService', () => {
  const growthExams = [
    { studentId: 'S001', retestFlag: true, deltaRawScore: 40, improvedFlag: true, skill: 'listening' },
    { studentId: 'S001', retestFlag: true, deltaRawScore: -5, improvedFlag: false, skill: 'reading' },
    { studentId: 'S002', retestFlag: true, deltaRawScore: -10, improvedFlag: false, skill: 'listening' },
    { studentId: 'S003', retestFlag: true, deltaRawScore: 15, improvedFlag: true, skill: 'listening' },
    { studentId: 'S003', retestFlag: true, deltaRawScore: 12, improvedFlag: true, skill: 'reading' },
    { studentId: 'S004', retestFlag: true, deltaRawScore: 5, improvedFlag: true, skill: 'speaking' },
    { studentId: 'S005', retestFlag: true, deltaRawScore: 8, improvedFlag: true, skill: 'writing' },
    { studentId: 'S006', retestFlag: true, deltaRawScore: 6, improvedFlag: true, skill: 'listening' },
    { studentId: 'S007', retestFlag: true, deltaRawScore: 7, improvedFlag: true, skill: 'reading' },
    { studentId: 'S008', retestFlag: true, deltaRawScore: 9, improvedFlag: true, skill: 'speaking' },
    { studentId: 'S009', retestFlag: true, deltaRawScore: 4, improvedFlag: true, skill: 'writing' },
    { studentId: 'S010', retestFlag: true, deltaRawScore: 3, improvedFlag: true, skill: 'listening' },
  ];

  it('normalizes dimension with fallback', () => {
    expect(normalizeDimension('instructor')).toBe('instructor');
    expect(normalizeDimension('unknown')).toBe('course');
  });

  it('normalizes instructor grouping', () => {
    expect(normalizeInstructorGrouping('merged')).toBe('merged');
    expect(normalizeInstructorGrouping('invalid')).toBe('by_semester');
  });

  it('builds student growth map with skill deltas', () => {
    const map = buildStudentGrowthMap(growthExams);
    expect(map.get('S001').episodeCount).toBe(2);
    expect(map.get('S001').skillDeltas.get('listening')).toEqual([40]);
    expect(map.get('S003').skillDeltas.get('reading')).toEqual([12]);
  });

  it('suppresses averages when growth sample is below threshold', () => {
    const growthMap = buildStudentGrowthMap(growthExams.slice(0, 4));
    const metrics = aggregateOfferingMetrics(new Set(['S001', 'S002', 'S003']), growthMap);
    expect(metrics.growthSampleSize).toBe(3);
    expect(metrics.privacySuppressed).toBe(true);
    expect(metrics.avgRawDelta).toBeNull();
    expect(metrics.improvement.any.rate).toBeNull();
    expect(metrics.suppressionReason).toContain(String(MIN_GROWTH_SAMPLE));
  });

  it('reports three improvement definitions when sample is sufficient', () => {
    const growthMap = buildStudentGrowthMap(growthExams);
    const ids = new Set(['S001', 'S002', 'S003', 'S004', 'S005', 'S006', 'S007', 'S008', 'S009', 'S010']);
    const metrics = aggregateOfferingMetrics(ids, growthMap);
    expect(metrics.privacySuppressed).toBe(false);
    expect(metrics.improvement.any.studentCount).toBeGreaterThan(0);
    expect(metrics.improvement.allSkills.studentCount).toBeLessThanOrEqual(metrics.improvement.any.studentCount);
    expect(metrics.improvement.avgPositive.studentCount).toBeGreaterThan(0);
  });

  it('aggregates course offerings with skill breakdown', () => {
    const growthMap = buildStudentGrowthMap(growthExams);
    const rows = buildCourseOfferings([
      {
        semesterId: '114-1',
        courseId: 10,
        studentId: 'S001',
        course: {
          semesterId: '114-1',
          courseCode: 'ENG101',
          courseName: '學術英文',
          instructorName: '王老師',
        },
      },
      ...['S002', 'S003', 'S004', 'S005', 'S006', 'S007', 'S008', 'S009', 'S010'].map((studentId) => ({
        semesterId: '114-1',
        courseId: 10,
        studentId,
        course: {
          semesterId: '114-1',
          courseCode: 'ENG101',
          courseName: '學術英文',
          instructorName: '王老師',
        },
      })),
    ], growthMap, new Map());

    expect(rows).toHaveLength(1);
    expect(rows[0].participantCount).toBe(10);
    expect(rows[0].skillBreakdown.length).toBeGreaterThan(0);
    expect(rows[0].causalClaimAllowed).toBe(false);
  });

  it('aggregates instructor offerings by semester and merged modes', () => {
    const growthMap = buildStudentGrowthMap(growthExams);
    const enrollments = [
      {
        semesterId: '113-2',
        courseId: 10,
        studentId: 'S001',
        course: { courseName: '學術英文 A', instructorName: '王老師' },
      },
      {
        semesterId: '114-1',
        courseId: 11,
        studentId: 'S002',
        course: { courseName: '學術英文 B', instructorName: '王老師' },
      },
    ];
    const bySemester = buildInstructorOfferings(enrollments, growthMap, new Map(), 'by_semester');
    const merged = buildInstructorOfferings(enrollments, growthMap, new Map(), 'merged');
    expect(bySemester).toHaveLength(2);
    expect(merged).toHaveLength(1);
    expect(merged[0].semesterLabel).toBe('跨學期');
    expect(merged[0].semesterIds).toEqual(['113-2', '114-1']);
  });

  it('resolves offering participants for course and activity keys', () => {
    const enrollments = [{
      semesterId: '114-1',
      courseId: 10,
      studentId: 'S001',
      course: { instructorName: '王老師' },
    }];
    const events = [{
      studentId: 'S002',
      eventType: 'activity_event',
      eventDate: '2026-03-01',
      title: 'ET',
      rawPayload: { eventId: 99 },
    }];
    expect([...resolveOfferingParticipantIds('course', '114-1::10', { enrollments })]).toEqual(['S001']);
    expect([...resolveOfferingParticipantIds('activity', 'event:99', { events })]).toEqual(['S002']);
  });

  it('builds student detail rows', () => {
    const growthMap = buildStudentGrowthMap(growthExams);
    const rows = buildStudentDetailRows(new Set(['S001', 'S999']), growthMap, new Map());
    expect(rows).toHaveLength(2);
    expect(rows[0].studentId).toBe('S001');
    expect(rows[0].improvement.any.studentCount).toBe(1);
    expect(rows.find((row) => row.studentId === 'S999').growthSampleSize).toBe(0);
  });
});
