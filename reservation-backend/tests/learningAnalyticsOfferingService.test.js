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
    expect(metrics.direction.improved).toBe(metrics.improvement.avgPositive.studentCount);
    expect(metrics.direction.improved + metrics.direction.flat + metrics.direction.declined)
      .toBe(metrics.growthSampleSize);
    expect(metrics.rawDistribution.median).not.toBeNull();
    expect(metrics.rawDistribution.p25).toBeLessThanOrEqual(metrics.rawDistribution.p75);
    expect(metrics.medianRawDelta).toBe(metrics.rawDistribution.median);
  });

  it('flags outlier skew when mean is pulled by extreme student averages', () => {
    const exams = [
      { studentId: 'E01', retestFlag: true, deltaRawScore: 100, improvedFlag: true, skill: 'listening' },
      { studentId: 'E02', retestFlag: true, deltaRawScore: 2, improvedFlag: true, skill: 'listening' },
      { studentId: 'E03', retestFlag: true, deltaRawScore: 2, improvedFlag: true, skill: 'listening' },
      { studentId: 'E04', retestFlag: true, deltaRawScore: 2, improvedFlag: true, skill: 'listening' },
      { studentId: 'E05', retestFlag: true, deltaRawScore: 2, improvedFlag: true, skill: 'listening' },
      { studentId: 'E06', retestFlag: true, deltaRawScore: 2, improvedFlag: true, skill: 'listening' },
      { studentId: 'E07', retestFlag: true, deltaRawScore: 2, improvedFlag: true, skill: 'listening' },
      { studentId: 'E08', retestFlag: true, deltaRawScore: 2, improvedFlag: true, skill: 'listening' },
      { studentId: 'E09', retestFlag: true, deltaRawScore: 2, improvedFlag: true, skill: 'listening' },
      { studentId: 'E10', retestFlag: true, deltaRawScore: 2, improvedFlag: true, skill: 'listening' },
    ];
    const growthMap = buildStudentGrowthMap(exams);
    const ids = new Set(exams.map((e) => e.studentId));
    const metrics = aggregateOfferingMetrics(ids, growthMap);
    expect(metrics.avgRawDelta).toBeGreaterThan(metrics.medianRawDelta);
    expect(metrics.outlierSkew.flagged).toBe(true);
    expect(metrics.outlierSkew.reason).toMatch(/極端|中位數/);
    expect(metrics.direction.declined).toBe(0);
    expect(metrics.direction.improved).toBe(10);
  });

  it('reports declined and flat counts explicitly', () => {
    const exams = [
      ...['A01', 'A02', 'A03', 'A04', 'A05'].map((studentId) => ({
        studentId, retestFlag: true, deltaRawScore: 10, improvedFlag: true, skill: 'listening',
      })),
      ...['B01', 'B02'].map((studentId) => ({
        studentId, retestFlag: true, deltaRawScore: 0, improvedFlag: false, skill: 'listening',
      })),
      ...['C01', 'C02', 'C03'].map((studentId) => ({
        studentId, retestFlag: true, deltaRawScore: -5, improvedFlag: false, skill: 'listening',
      })),
    ];
    const growthMap = buildStudentGrowthMap(exams);
    const ids = new Set(exams.map((e) => e.studentId));
    const metrics = aggregateOfferingMetrics(ids, growthMap);
    expect(metrics.direction).toEqual({
      improved: 5,
      flat: 2,
      declined: 3,
      total: 10,
    });
    expect(metrics.primaryGrowthMetric).toBe('rawDelta');
  });

  it('flags gse resolution warning when raw moves but gse is flat', () => {
    const { detectGseResolutionWarning } = require('../services/learningAnalytics/learningAnalyticsOfferingService');
    expect(detectGseResolutionWarning(22.5, 0).flagged).toBe(true);
    expect(detectGseResolutionWarning(22.5, 0).code).toBe('gse_resolution_low');
    expect(detectGseResolutionWarning(22.5, null).code).toBe('gse_unmapped');
    expect(detectGseResolutionWarning(2, 0).flagged).toBe(false);
    expect(detectGseResolutionWarning(22.5, 3.2).flagged).toBe(false);
  });

  it('marks allSkills false when only one skill has data; true when all four improve', () => {
    const oneSkill = buildStudentGrowthMap([
      { studentId: 'S1', retestFlag: true, deltaRawScore: 45, skill: 'listening', instrument: 'BESTEP' },
    ]);
    const oneRows = buildStudentDetailRows(new Set(['S1']), oneSkill, new Map());
    expect(oneRows[0].improvement.any.studentCount).toBe(1);
    expect(oneRows[0].improvement.allSkills.studentCount).toBe(0);

    const fourSkill = buildStudentGrowthMap([
      { studentId: 'S2', retestFlag: true, deltaRawScore: 10, skill: 'listening', instrument: 'BESTEP' },
      { studentId: 'S2', retestFlag: true, deltaRawScore: 8, skill: 'reading', instrument: 'BESTEP' },
      { studentId: 'S2', retestFlag: true, deltaRawScore: 5, skill: 'speaking', instrument: 'BESTEP' },
      { studentId: 'S2', retestFlag: true, deltaRawScore: 6, skill: 'writing', instrument: 'BESTEP' },
    ]);
    const fourRows = buildStudentDetailRows(new Set(['S2']), fourSkill, new Map());
    expect(fourRows[0].improvement.any.studentCount).toBe(1);
    expect(fourRows[0].improvement.allSkills.studentCount).toBe(1);
  });

  it('uses clarified improvement definition labels', () => {
    const { IMPROVEMENT_DEFINITIONS } = require('../services/learningAnalytics/learningAnalyticsOfferingService');
    expect(IMPROVEMENT_DEFINITIONS[0].label).toBe('任一技能進步');
    expect(IMPROVEMENT_DEFINITIONS[1].label).toBe('全技能進步');
    expect(IMPROVEMENT_DEFINITIONS[1].detail).toMatch(/四項/);
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
