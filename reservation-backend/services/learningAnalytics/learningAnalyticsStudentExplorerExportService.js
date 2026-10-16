'use strict';

const ExcelJS = require('exceljs');
const { listStudentExplorerForExport } = require('./learningAnalyticsStudentExplorerService');

function examRecordLabel(row = {}) {
  if (row.hasPreTest && row.hasPostTest) return '前後測';
  if (row.hasPreTest) return '前測';
  if (row.hasPostTest) return '後測';
  return row.hasValidExam ? '有效' : '無';
}

function formatStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function buildStudentExplorerWorkbook(payload = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EEARS Learning Analytics';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('篩選名單');
  sheet.columns = [
    { header: '學號', key: 'studentId', width: 16 },
    { header: '姓名', key: 'studentName', width: 16 },
    { header: '系所', key: 'department', width: 24 },
    { header: '入學年度', key: 'cohort', width: 12 },
    { header: '起始分級', key: 'placementLabel', width: 12 },
    { header: '英檢', key: 'examLabel', width: 12 },
    { header: '活動時數', key: 'totalActivityHours', width: 12 },
    { header: '修課時數', key: 'totalCourseHours', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const item of payload.items || []) {
    sheet.addRow({
      studentId: item.studentId || '',
      studentName: item.studentName || '',
      department: item.department || '',
      cohort: item.cohort || '',
      placementLabel: item.placementLabel || '',
      examLabel: examRecordLabel(item),
      totalActivityHours: item.totalActivityHours,
      totalCourseHours: item.totalCourseHours,
    });
  }

  const meta = workbook.addWorksheet('匯出說明');
  meta.columns = [
    { header: '欄位', key: 'key', width: 22 },
    { header: '值', key: 'value', width: 72 },
  ];
  meta.getRow(1).font = { bold: true };
  meta.addRow({ key: '分析快照版本', value: payload.snapshotVersion || '' });
  meta.addRow({ key: '符合條件人數', value: payload.total ?? 0 });
  meta.addRow({ key: '本次匯出人數', value: (payload.items || []).length });
  meta.addRow({ key: '是否超過上限', value: payload.truncated ? '是' : '否' });
  meta.addRow({ key: '匯出上限', value: payload.maxRows ?? '' });
  meta.addRow({ key: '篩選條件', value: JSON.stringify(payload.appliedFilters || {}) });
  meta.addRow({
    key: '備註',
    value: '名單與學生探索頁已套用的篩選一致。起始分級是入學英文分級。英檢前測是第一梯有效英檢（含只有一次），後測是第二梯。',
  });

  return workbook;
}

async function buildStudentExplorerExportWorkbook(query = {}) {
  const payload = await listStudentExplorerForExport(query);
  return {
    workbook: buildStudentExplorerWorkbook(payload),
    fileName: `EEARS_LA_explore_${formatStamp()}.xlsx`,
    rowCount: payload.items.length,
    total: payload.total,
    truncated: payload.truncated,
    maxRows: payload.maxRows,
    filters: payload.appliedFilters,
    snapshotVersion: payload.snapshotVersion,
  };
}

module.exports = {
  examRecordLabel,
  buildStudentExplorerWorkbook,
  buildStudentExplorerExportWorkbook,
};
