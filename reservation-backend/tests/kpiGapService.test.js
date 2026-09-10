'use strict';

const {
  classifyStudentGap,
  buildGapSummary,
} = require('../services/learningAnalytics/kpiGapService');

describe('kpiGapService', () => {
  const dimensions = [
    { id: 'lr_pair', label: '聽讀' },
    { id: 'sw_pair', label: '說寫' },
  ];

  test('classify: no exam + both dims failed', () => {
    const row = classifyStudentGap({
      studentId: 'S1',
      validAttemptCount: 0,
      dimensions: {
        lr_pair: { passed: false },
        sw_pair: { passed: false },
      },
    }, dimensions);

    expect(row.flags.noExam).toBe(true);
    expect(row.flags.missingRetest).toBe(false);
    expect(row.flags.notAttained).toBe(true);
    expect(row.failedDimensionIds).toEqual(['lr_pair', 'sw_pair']);
  });

  test('classify: missing retest when exactly one attempt', () => {
    const row = classifyStudentGap({
      studentId: 'S2',
      validAttemptCount: 1,
      dimensions: {
        lr_pair: { passed: true },
        sw_pair: { passed: false },
      },
    }, dimensions);

    expect(row.flags.missingRetest).toBe(true);
    expect(row.flags.noExam).toBe(false);
    expect(row.flags.notAttained).toBe(true);
    expect(row.failedDimensionIds).toEqual(['sw_pair']);
  });

  test('classify: all passed with multiple attempts', () => {
    const row = classifyStudentGap({
      studentId: 'S3',
      validAttemptCount: 2,
      dimensions: {
        lr_pair: { passed: true },
        sw_pair: { passed: true },
      },
    }, dimensions);

    expect(row.flags.allPassed).toBe(true);
    expect(row.flags.notAttained).toBe(false);
    expect(row.flags.missingRetest).toBe(false);
    expect(row.failedDimensions).toHaveLength(0);
  });

  test('buildGapSummary aggregates counts', () => {
    const classified = [
      classifyStudentGap({
        studentId: 'A',
        validAttemptCount: 0,
        dimensions: { lr_pair: { passed: false }, sw_pair: { passed: false } },
      }, dimensions),
      classifyStudentGap({
        studentId: 'B',
        validAttemptCount: 1,
        dimensions: { lr_pair: { passed: true }, sw_pair: { passed: false } },
      }, dimensions),
      classifyStudentGap({
        studentId: 'C',
        validAttemptCount: 3,
        dimensions: { lr_pair: { passed: true }, sw_pair: { passed: true } },
      }, dimensions),
    ];

    const summary = buildGapSummary(classified, dimensions, 3);
    expect(summary.notAttainedCount).toBe(2);
    expect(summary.noExamCount).toBe(1);
    expect(summary.missingRetestCount).toBe(1);
    expect(summary.allPassedCount).toBe(1);
    expect(summary.byDimension.find((d) => d.id === 'sw_pair').notAttainedCount).toBe(2);
    expect(summary.byDimension.find((d) => d.id === 'lr_pair').notAttainedCount).toBe(1);
  });
});
