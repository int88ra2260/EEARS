'use strict';

const {
  flattenOfferingSummaryRow,
  flattenSkillBreakdownRows,
  flattenStudentDetailRows,
} = require('../services/learningAnalytics/learningAnalyticsOfferingExportService');

describe('learningAnalyticsOfferingExportService', () => {
  const offeringRow = {
    offeringKey: '114-1::10',
    label: '學術英文（王老師）',
    semesterId: '114-1',
    courseCode: 'ENG101',
    instructorName: '王老師',
    participantCount: 20,
    growthSampleSize: 12,
    growthEpisodeCount: 18,
    improvement: {
      any: { studentCount: 8, rate: 0.6667 },
      allSkills: { studentCount: 5, rate: 0.4167 },
      avgPositive: { studentCount: 7, rate: 0.5833 },
    },
    avgRawDelta: 12.5,
    avgActualGseGrowth: 3.2,
    avgAdjustedGseGrowth: 1.1,
    privacySuppressed: false,
    skillBreakdown: [{
      skill: 'listening',
      label: '聽力',
      growthSampleSize: 10,
      avgRawDelta: 8,
      avgActualGseGrowth: 2,
      avgAdjustedGseGrowth: 1,
      improvedRateAny: 0.7,
      privacySuppressed: false,
    }],
  };

  it('flattens offering summary row for Excel', () => {
    const row = flattenOfferingSummaryRow(offeringRow, 'course');
    expect(row.offeringKey).toBe('114-1::10');
    expect(row.improvedAnyRate).toBe('66.7%');
    expect(row.improvedAllSkillsRate).toBe('41.7%');
    expect(row.avgRawDelta).toBe(12.5);
  });

  it('flattens skill breakdown rows', () => {
    const rows = flattenSkillBreakdownRows(offeringRow);
    expect(rows).toHaveLength(1);
    expect(rows[0].skillLabel).toBe('聽力');
    expect(rows[0].improvedRateAny).toBe('70.0%');
  });

  it('flattens student detail rows', () => {
    const rows = flattenStudentDetailRows('114-1::10', offeringRow.label, [{
      studentId: 'S001',
      growthEpisodeCount: 2,
      avgRawDelta: 10,
      avgActualGseGrowth: 2,
      avgAdjustedGseGrowth: 1,
      growthSampleSize: 1,
      improvement: {
        any: { studentCount: 1 },
        allSkills: { studentCount: 0 },
        avgPositive: { studentCount: 1 },
      },
    }]);
    expect(rows[0].studentId).toBe('S001');
    expect(rows[0].improvedAny).toBe('是');
    expect(rows[0].improvedAllSkills).toBe('否');
  });
});
