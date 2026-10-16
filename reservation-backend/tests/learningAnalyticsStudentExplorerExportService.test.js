'use strict';

const {
  examRecordLabel,
  buildStudentExplorerWorkbook,
} = require('../services/learningAnalytics/learningAnalyticsStudentExplorerExportService');

describe('learningAnalyticsStudentExplorerExportService', () => {
  it('labels exam records the same way as the explorer table', () => {
    expect(examRecordLabel({ hasPreTest: true, hasPostTest: true, hasValidExam: true })).toBe('前後測');
    expect(examRecordLabel({ hasPreTest: true, hasPostTest: false, hasValidExam: true })).toBe('前測');
    expect(examRecordLabel({ hasPreTest: false, hasPostTest: true, hasValidExam: true })).toBe('後測');
    expect(examRecordLabel({ hasPreTest: false, hasPostTest: false, hasValidExam: true })).toBe('有效');
    expect(examRecordLabel({ hasPreTest: false, hasPostTest: false, hasValidExam: false })).toBe('無');
  });

  it('writes the filtered roster columns and omits the GSAT score', async () => {
    const workbook = buildStudentExplorerWorkbook({
      snapshotVersion: 'snap-1',
      total: 2,
      truncated: true,
      maxRows: 5000,
      appliedFilters: { placement: '中高級', minActivityHours: 6 },
      items: [
        {
          studentId: 'B001',
          studentName: '王小明',
          department: '外文系',
          cohort: '114',
          placementLabel: '中高級',
          hasPreTest: true,
          hasPostTest: false,
          hasValidExam: true,
          totalActivityHours: 6,
          totalCourseHours: 36,
        },
      ],
    });

    const sheet = workbook.getWorksheet('篩選名單');
    const headers = sheet.getRow(1).values.slice(1);
    expect(headers).toEqual(['學號', '姓名', '系所', '入學年度', '起始分級', '英檢', '活動時數', '修課時數']);
    expect(headers).not.toContain('學測級分');
    expect(sheet.getRow(2).values.slice(1)).toEqual(['B001', '王小明', '外文系', '114', '中高級', '前測', 6, 36]);

    const meta = workbook.getWorksheet('匯出說明');
    const rows = [];
    meta.eachRow((row, index) => {
      if (index === 1) return;
      rows.push([row.getCell(1).value, row.getCell(2).value]);
    });
    expect(rows).toEqual(expect.arrayContaining([
      ['符合條件人數', 2],
      ['本次匯出人數', 1],
      ['是否超過上限', '是'],
    ]));
  });
});
