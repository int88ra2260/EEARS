'use strict';

const { computeTaskStatsFromMatrix } = require('../services/etGrouping/etGroupingExportService');

describe('etGroupingExportService', () => {
  test('computeTaskStatsFromMatrix counts required marks for checked-in students', () => {
    const stats = computeTaskStatsFromMatrix({
      students: [
        {
          checkinStatus: '已簽到',
          tasks: [
            { isRequired: true, completed: true },
            { isRequired: true, completed: false },
            { isRequired: false, completed: true },
          ],
        },
        {
          checkinStatus: '未簽到',
          tasks: [{ isRequired: true, completed: true }],
        },
      ],
    });
    expect(stats.checkedIn).toBe(1);
    expect(stats.eligibleMarks).toBe(2);
    expect(stats.completedMarks).toBe(1);
    expect(stats.completionRate).toBe(50);
  });
});
