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
          preTest: { skillCount: 1, gse: 54, cefr: 'B1', mixedCefr: false },
          postTest: { skillCount: 0, gse: null, cefr: null, mixedCefr: false },
          skills: [{
            skill: 'listening',
            rawDelta: null,
            gseDelta: null,
            pre: { rawScore: 6, cefr: 'B1', gse: 54, invalidScore: false },
            post: null,
          }],
        },
      ],
    });

    const sheet = workbook.getWorksheet('篩選名單');
    const headers = sheet.getRow(1).values.slice(1);
    expect(headers.slice(0, 12)).toEqual([
      '學號', '姓名', '系所', '入學年度', '起始分級', '英檢',
      '前測CEFR', '前測GSE', '後測CEFR', '後測GSE', '活動時數', '修課時數',
    ]);
    expect(headers).toContain('聽力前測原始分');
    expect(headers).toContain('寫作GSE差');
    expect(headers).not.toContain('學測級分');
    const row = Object.fromEntries(headers.map((header, index) => [header, sheet.getRow(2).getCell(index + 1).value]));
    expect(row['學號']).toBe('B001');
    expect(row['英檢']).toBe('前測');
    expect(row['前測CEFR']).toBe('B1');
    expect(row['前測GSE']).toBe(54);
    expect(row['後測GSE'] || '').toBe('');
    expect(row['聽力前測原始分']).toBe(6);
    expect(row['聽力前測GSE']).toBe(54);
    expect(row['閱讀前測原始分'] || '').toBe('');
    expect(row['活動時數']).toBe(6);
    expect(row['修課時數']).toBe(36);

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
