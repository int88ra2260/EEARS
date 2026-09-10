'use strict';

const ExcelJS = require('exceljs');
const {
  sanitizeFilenameSegment,
  formatTimestampForFilename,
} = require('../../utils/reportExportFilename');
const { runKpiReport } = require('./kpiReportService');

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

async function buildKpiReportWorkbook(input = {}) {
  const report = await runKpiReport({ ...input, includeRows: true });
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EEARS';
  wb.created = new Date();

  const meta = wb.addWorksheet('報表定義');
  meta.columns = [
    { header: '項目', key: 'key', width: 28 },
    { header: '內容', key: 'value', width: 80 },
  ];
  const metaRows = [
    ['產生時間', report.generatedAt],
    ['政策 ID', report.policy.id],
    ['政策鍵', report.policy.policyKey],
    ['政策名稱', report.policy.name],
    ['學年標籤', report.policy.academicYear || ''],
    ['名冊學期', report.population.semesterId],
    ['年級範圍', report.population?.gradeFilter?.label || '不限年級'],
    ['名冊總人數（篩選前）', report.population?.rosterStats?.rosterTotal ?? ''],
    ['納入人數（分母）', report.population.totalStudents],
    ['因年級排除', report.population?.rosterStats?.excludedByGrade ?? ''],
    ['缺年級排除', report.population?.rosterStats?.excludedMissingGrade ?? ''],
    ['年級來源', report.population?.source || 'et_enrollment_snapshots.grade'],
    ['成績時間窗起', report.evidenceWindow?.dateFrom || '不限（lifetime）'],
    ['成績時間窗迄', report.evidenceWindow?.dateTo || '不限（lifetime）'],
    ['說明', report.policy.description || ''],
    ['備註', (report.policy.notes || []).join('；')],
  ];
  for (const [key, value] of metaRows) {
    meta.addRow({ key, value });
  }

  const summary = wb.addWorksheet('KPI摘要');
  summary.columns = [
    { header: '達標單元', key: 'label', width: 20 },
    { header: 'dimensionId', key: 'id', width: 16 },
    { header: '種類', key: 'kind', width: 10 },
    { header: '達標人數', key: 'passedCount', width: 12 },
    { header: '名冊人數', key: 'total', width: 12 },
    { header: '達標比例', key: 'rate', width: 12 },
  ];
  for (const dim of report.summary.dimensions || []) {
    summary.addRow({
      label: dim.label,
      id: dim.id,
      kind: dim.kind,
      passedCount: dim.passedCount,
      total: report.population.totalStudents,
      rate: formatPct(dim.rate),
    });
  }

  if (report.summary.skillBreakdown) {
    const skillSheet = wb.addWorksheet('分項對照');
    skillSheet.columns = [
      { header: '技能', key: 'skill', width: 12 },
      { header: '達標人數', key: 'count', width: 12 },
      { header: '名冊人數', key: 'total', width: 12 },
      { header: '達標比例', key: 'rate', width: 12 },
      { header: '說明', key: 'note', width: 48 },
    ];
    const labels = {
      listening: '聽力',
      reading: '閱讀',
      speaking: '口說',
      writing: '寫作',
    };
    for (const [skill, cell] of Object.entries(report.summary.skillBreakdown)) {
      skillSheet.addRow({
        skill: labels[skill] || skill,
        count: cell.count,
        total: report.population.totalStudents,
        rate: formatPct(cell.rate),
        note: '歷史最佳單項 CEFR≥B2（對照用；非官方成對 KPI）',
      });
    }
  }

  const detail = wb.addWorksheet('學生明細');
  const dimCols = (report.summary.dimensions || []).flatMap((dim) => ([
    { header: `${dim.label}·達標`, key: `${dim.id}_passed`, width: 12 },
    { header: `${dim.label}·證明`, key: `${dim.id}_proof`, width: 40 },
  ]));
  detail.columns = [
    { header: '學號', key: 'studentId', width: 16 },
    { header: '名冊年級', key: 'grade', width: 12 },
    { header: '系所', key: 'department', width: 20 },
    ...dimCols,
  ];

  for (const row of report.rows || []) {
    const out = {
      studentId: row.studentId,
      grade: row.grade || '',
      department: row.department || '',
    };
    for (const dim of report.summary.dimensions || []) {
      const cell = row.dimensions?.[dim.id];
      out[`${dim.id}_passed`] = cell?.passed ? 'Y' : 'N';
      out[`${dim.id}_proof`] = proofLabel(cell?.proof);
    }
    detail.addRow(out);
  }

  const stamp = formatTimestampForFilename(new Date());
  const policySeg = sanitizeFilenameSegment(report.policy.policyKey || 'policy');
  const semSeg = sanitizeFilenameSegment(report.population.semesterId || 'semester');
  const fileName = `EEARS_KPI_${policySeg}_${semSeg}_${stamp}.xlsx`;

  return { workbook: wb, fileName, report };
}

module.exports = {
  buildKpiReportWorkbook,
};
