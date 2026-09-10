'use strict';

const ExcelJS = require('exceljs');
const {
  sanitizeFilenameSegment,
  formatTimestampForFilename,
} = require('../../utils/reportExportFilename');
const { runKpiGapReport } = require('./kpiGapService');

function formatPct(rate) {
  if (rate == null || !Number.isFinite(Number(rate))) return '';
  return `${(Number(rate) * 100).toFixed(2)}%`;
}

function proofLabel(proof) {
  if (!proof) return '';
  const parts = [
    proof.instrument || '',
    proof.examDate || '',
    proof.combined != null ? `合計=${proof.combined}` : '',
    proof.attemptId != null ? `attempt#${proof.attemptId}` : '',
  ].filter(Boolean);
  return parts.join(' | ');
}

function yn(flag) {
  return flag ? 'Y' : 'N';
}

function addStudentSheet(wb, title, rows, dimensions) {
  const sheet = wb.addWorksheet(title);
  const dimCols = (dimensions || []).flatMap((dim) => ([
    { header: `${dim.label}·達標`, key: `${dim.id}_passed`, width: 12 },
    { header: `${dim.label}·證明`, key: `${dim.id}_proof`, width: 36 },
  ]));
  sheet.columns = [
    { header: '學號', key: 'studentId', width: 16 },
    { header: '名冊年級', key: 'grade', width: 12 },
    { header: '系所', key: 'department', width: 20 },
    { header: '有效考試場次', key: 'validAttemptCount', width: 14 },
    { header: '未達標', key: 'notAttained', width: 10 },
    { header: '無考試', key: 'noExam', width: 10 },
    { header: '缺重測', key: 'missingRetest', width: 10 },
    { header: '未達標單元', key: 'failedLabels', width: 28 },
    ...dimCols,
  ];

  for (const row of rows || []) {
    const out = {
      studentId: row.studentId,
      grade: row.grade || '',
      department: row.department || '',
      validAttemptCount: row.validAttemptCount,
      notAttained: yn(row.flags?.notAttained),
      noExam: yn(row.flags?.noExam),
      missingRetest: yn(row.flags?.missingRetest),
      failedLabels: (row.failedDimensions || []).map((d) => d.label).join('、'),
    };
    for (const dim of dimensions || []) {
      const cell = row.dimensions?.[dim.id];
      out[`${dim.id}_passed`] = cell?.passed ? 'Y' : 'N';
      out[`${dim.id}_proof`] = proofLabel(cell?.proof);
    }
    sheet.addRow(out);
  }
  return sheet;
}

async function buildKpiGapWorkbook(input = {}) {
  const report = await runKpiGapReport(input, { includeRows: true });
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EEARS';
  wb.created = new Date();

  const dimensions = report.kpiSummary?.dimensions || [];
  const gapSummary = report.gaps?.summary || {};

  const meta = wb.addWorksheet('報表定義');
  meta.columns = [
    { header: '項目', key: 'key', width: 28 },
    { header: '內容', key: 'value', width: 80 },
  ];
  const defs = report.gaps?.definitions || {};
  const metaRows = [
    ['產生時間', report.generatedAt],
    ['報表種類', '認證／重測缺口'],
    ['政策 ID', report.policy?.id],
    ['政策鍵', report.policy?.policyKey],
    ['政策名稱', report.policy?.name],
    ['名冊學期', report.population?.semesterId],
    ['年級範圍', report.population?.gradeFilter?.label || '不限年級'],
    ['納入人數（分母）', report.population?.totalStudents],
    ['成績時間窗起', report.evidenceWindow?.dateFrom || '不限（lifetime）'],
    ['成績時間窗迄', report.evidenceWindow?.dateTo || '不限（lifetime）'],
    ['未達標定義', defs.notAttained || ''],
    ['無考試定義', defs.noExam || ''],
    ['缺重測定義', defs.missingRetest || ''],
    ['場次來源', defs.source || ''],
  ];
  for (const [key, value] of metaRows) {
    meta.addRow({ key, value });
  }

  const summary = wb.addWorksheet('缺口摘要');
  summary.columns = [
    { header: '項目', key: 'label', width: 24 },
    { header: '人數', key: 'count', width: 12 },
    { header: '占分母比例', key: 'rate', width: 14 },
  ];
  summary.addRow({
    label: '名冊分母',
    count: gapSummary.totalStudents,
    rate: '100%',
  });
  summary.addRow({
    label: '全部達標',
    count: gapSummary.allPassedCount,
    rate: formatPct(gapSummary.allPassedRate),
  });
  summary.addRow({
    label: '未達標（任一單元）',
    count: gapSummary.notAttainedCount,
    rate: formatPct(gapSummary.notAttainedRate),
  });
  summary.addRow({
    label: '無考試',
    count: gapSummary.noExamCount,
    rate: formatPct(gapSummary.noExamRate),
  });
  summary.addRow({
    label: '缺重測（僅 1 場）',
    count: gapSummary.missingRetestCount,
    rate: formatPct(gapSummary.missingRetestRate),
  });
  for (const dim of gapSummary.byDimension || []) {
    summary.addRow({
      label: `未達：${dim.label}`,
      count: dim.notAttainedCount,
      rate: formatPct(dim.rate),
    });
  }

  const lists = report.gaps?.lists || {};
  addStudentSheet(wb, '未達標名單', lists.notAttained, dimensions);
  addStudentSheet(wb, '缺重測名單', lists.missingRetest, dimensions);
  addStudentSheet(wb, '無考試名單', lists.noExam, dimensions);
  addStudentSheet(wb, '全部學生明細', report.rows || [], dimensions);

  const stamp = formatTimestampForFilename(new Date());
  const policySeg = sanitizeFilenameSegment(report.policy?.policyKey || 'policy');
  const semSeg = sanitizeFilenameSegment(report.population?.semesterId || 'semester');
  const fileName = `EEARS_KPI_GAPS_${policySeg}_${semSeg}_${stamp}.xlsx`;

  return { workbook: wb, fileName, report };
}

module.exports = {
  buildKpiGapWorkbook,
};
