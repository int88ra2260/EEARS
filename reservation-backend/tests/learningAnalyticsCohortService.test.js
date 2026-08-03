'use strict';

const {
  aggregateGrowthByGroup,
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
