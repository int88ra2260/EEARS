'use strict';

const ExcelJS = require('exceljs');
const { listStudentExplorerForExport } = require('./learningAnalyticsStudentExplorerService');

const SKILL_EXPORTS = Object.freeze([
  ['listening', '聽力'],
  ['reading', '閱讀'],
  ['speaking', '口說'],
  ['writing', '寫作'],
]);

function examRecordLabel(row = {}) {
  if (row.hasPreTest && row.hasPostTest) return '前後測';
  if (row.hasPreTest) return '前測';
  if (row.hasPostTest) return '後測';
  return row.hasValidExam ? '有效' : '無';
}

function phaseCefr(phase) {
  if (!phase || !phase.skillCount) return '';
  if (phase.mixedCefr) return '各科不同';
  return phase.cefr || '';
}

function phaseGse(phase) {
  if (!phase || phase.gse == null) return '';
  return phase.gse;
}

function skillRow(item, skill) {
  return (item.skills || []).find((row) => row.skill === skill) || null;
}

function exportRaw(cell) {
  if (!cell) return '';
  if (cell.invalidScore) return '無效';
  return cell.rawScore ?? '';
}

function exportCellField(cell, field) {
  if (!cell || cell[field] == null) return '';
  return cell[field];
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
  const skillColumns = SKILL_EXPORTS.flatMap(([, label]) => ([
    { header: `${label}前測原始分`, key: `${label}前測原始分`, width: 16 },
    { header: `${label}前測CEFR`, key: `${label}前測CEFR`, width: 14 },
    { header: `${label}前測GSE`, key: `${label}前測GSE`, width: 14 },
    { header: `${label}後測原始分`, key: `${label}後測原始分`, width: 16 },
    { header: `${label}後測CEFR`, key: `${label}後測CEFR`, width: 14 },
    { header: `${label}後測GSE`, key: `${label}後測GSE`, width: 14 },
    { header: `${label}原始分差`, key: `${label}原始分差`, width: 14 },
    { header: `${label}GSE差`, key: `${label}GSE差`, width: 12 },
  ]));
  sheet.columns = [
    { header: '學號', key: 'studentId', width: 16 },
    { header: '姓名', key: 'studentName', width: 16 },
    { header: '系所', key: 'department', width: 24 },
    { header: '入學年度', key: 'cohort', width: 12 },
    { header: '起始分級', key: 'placementLabel', width: 12 },
    { header: '英檢', key: 'examLabel', width: 12 },
    { header: '前測CEFR', key: 'preCefr', width: 12 },
    { header: '前測GSE', key: 'preGse', width: 12 },
    { header: '後測CEFR', key: 'postCefr', width: 12 },
    { header: '後測GSE', key: 'postGse', width: 12 },
    { header: '活動時數', key: 'totalActivityHours', width: 12 },
    { header: '修課時數', key: 'totalCourseHours', width: 12 },
    ...skillColumns,
  ];
  sheet.getRow(1).font = { bold: true };
  for (const item of payload.items || []) {
    const skillValues = {};
    for (const [skill, label] of SKILL_EXPORTS) {
      const row = skillRow(item, skill);
      skillValues[`${label}前測原始分`] = exportRaw(row?.pre);
      skillValues[`${label}前測CEFR`] = exportCellField(row?.pre, 'cefr');
      skillValues[`${label}前測GSE`] = exportCellField(row?.pre, 'gse');
      skillValues[`${label}後測原始分`] = exportRaw(row?.post);
      skillValues[`${label}後測CEFR`] = exportCellField(row?.post, 'cefr');
      skillValues[`${label}後測GSE`] = exportCellField(row?.post, 'gse');
      skillValues[`${label}原始分差`] = row?.rawDelta ?? '';
      skillValues[`${label}GSE差`] = row?.gseDelta ?? '';
    }
    sheet.addRow({
      studentId: item.studentId || '',
      studentName: item.studentName || '',
      department: item.department || '',
      cohort: item.cohort || '',
      placementLabel: item.placementLabel || '',
      examLabel: examRecordLabel(item),
      preCefr: phaseCefr(item.preTest),
      preGse: phaseGse(item.preTest),
      postCefr: phaseCefr(item.postTest),
      postGse: phaseGse(item.postTest),
      totalActivityHours: item.totalActivityHours,
      totalCourseHours: item.totalCourseHours,
      ...skillValues,
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
    value: '名單與學生探索頁已套用的篩選一致。起始分級是入學英文分級。前測是第一梯有效英檢（含只有一次），後測是第二梯。前測／後測 GSE 是該梯可換算技能的平均。各科 CEFR 不一致時前測／後測 CEFR 寫「各科不同」。0 與 1 分視為無效，不換算 GSE。不同英檢的原始分差留空。學測不在這份名單。',
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
