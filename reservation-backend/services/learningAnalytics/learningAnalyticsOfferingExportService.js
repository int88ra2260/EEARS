'use strict';

const ExcelJS = require('exceljs');
const {
  sanitizeFilenameSegment,
  formatTimestampForFilename,
} = require('../../utils/reportExportFilename');
const { stripEmptyQueryParams } = require('./learningAnalyticsFilterUtils');
const {
  buildOfferingContext,
  buildStudentDetailRows,
  resolveOfferingParticipantIds,
  normalizeDimension,
  IMPROVEMENT_DEFINITIONS,
  MIN_GROWTH_SAMPLE,
} = require('./learningAnalyticsOfferingService');

const MAX_EXPORT_STUDENT_ROWS = 20000;
const META_SHEET_NAME = '匯出說明';

const OFFERING_SUMMARY_COLUMNS = [
  { key: 'offeringKey', header: '細項鍵', width: 28 },
  { key: 'label', header: '名稱', width: 32 },
  { key: 'dimensionLabel', header: '分析維度', width: 14 },
  { key: 'semesterLabel', header: '學期', width: 14 },
  { key: 'courseCode', header: '課號', width: 12 },
  { key: 'instructorName', header: '授課教師', width: 16 },
  { key: 'courseCount', header: '開課數', width: 10 },
  { key: 'eventDate', header: '活動日期', width: 14 },
  { key: 'participantCount', header: '參與人數', width: 10 },
  { key: 'growthSampleSize', header: '可計算成長人數', width: 14 },
  { key: 'growthEpisodeCount', header: '前後測筆數', width: 12 },
  { key: 'improvedAnyCount', header: '任一進步人數', width: 12 },
  { key: 'improvedAnyRate', header: '任一進步率', width: 12 },
  { key: 'improvedAllSkillsCount', header: '全技能進步人數', width: 14 },
  { key: 'improvedAllSkillsRate', header: '全技能進步率', width: 14 },
  { key: 'improvedAvgPositiveCount', header: '平均>0人數', width: 12 },
  { key: 'improvedAvgPositiveRate', header: '平均>0比率', width: 12 },
  { key: 'avgRawDelta', header: '平均原始分進步', width: 14 },
  { key: 'avgActualGseGrowth', header: 'GSE 實際成長', width: 12 },
  { key: 'avgAdjustedGseGrowth', header: 'GSE 修正成長', width: 12 },
  { key: 'privacySuppressed', header: '樣本不足遮蔽', width: 12 },
  { key: 'suppressionReason', header: '遮蔽說明', width: 36 },
];

const SKILL_BREAKDOWN_COLUMNS = [
  { key: 'offeringKey', header: '細項鍵', width: 28 },
  { key: 'offeringLabel', header: '名稱', width: 32 },
  { key: 'skillLabel', header: '技能', width: 10 },
  { key: 'growthSampleSize', header: '可計算人數', width: 12 },
  { key: 'avgRawDelta', header: '平均原始分進步', width: 14 },
  { key: 'avgActualGseGrowth', header: 'GSE 實際成長', width: 12 },
  { key: 'avgAdjustedGseGrowth', header: 'GSE 修正成長', width: 12 },
  { key: 'improvedRateAny', header: '任一進步率', width: 12 },
  { key: 'privacySuppressed', header: '樣本不足遮蔽', width: 12 },
];

const STUDENT_DETAIL_COLUMNS = [
  { key: 'offeringKey', header: '細項鍵', width: 28 },
  { key: 'offeringLabel', header: '名稱', width: 32 },
  { key: 'studentId', header: '學號', width: 14 },
  { key: 'growthEpisodeCount', header: '前後測筆數', width: 12 },
  { key: 'avgRawDelta', header: '平均原始分進步', width: 14 },
  { key: 'avgActualGseGrowth', header: 'GSE 實際成長', width: 12 },
  { key: 'avgAdjustedGseGrowth', header: 'GSE 修正成長', width: 12 },
  { key: 'improvedAny', header: '任一進步', width: 10 },
  { key: 'improvedAllSkills', header: '全技能進步', width: 12 },
  { key: 'improvedAvgPositive', header: '平均>0', width: 10 },
];

const DIMENSION_LABELS = {
  course: '課程',
  instructor: '教師',
  activity: '個別活動',
  resource_category: '資源類別',
};

function formatCellValue(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof value === 'boolean') return value ? '是' : '否';
  return value;
}

function formatRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `${(n * 100).toFixed(1)}%`;
}

function buildWorksheetColumns(definitions) {
  return definitions.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));
}

function appendRows(worksheet, items, definitions) {
  for (const item of items) {
    const row = {};
    for (const col of definitions) {
      row[col.key] = formatCellValue(item[col.key]);
    }
    worksheet.addRow(row);
  }
}

function buildExportFileName(dimension, filters = {}, snapshotVersion = '') {
  const stamp = formatTimestampForFilename();
  const sem = sanitizeFilenameSegment(filters.semester || 'all', 'all');
  const dim = sanitizeFilenameSegment(dimension || 'course', 'course');
  const snap = sanitizeFilenameSegment(String(snapshotVersion || 'snapshot').split('|')[0], 'snapshot');
  return `EEARS_LA_offerings_${dim}_${sem}_snap-${snap}_${stamp}.xlsx`;
}

function flattenOfferingSummaryRow(row, dimension) {
  return {
    offeringKey: row.offeringKey,
    label: row.label,
    dimensionLabel: DIMENSION_LABELS[dimension] || dimension,
    semesterLabel: row.semesterLabel || row.semesterId || (row.semesterIds || []).join('、') || '',
    courseCode: row.courseCode || '',
    instructorName: row.instructorName || '',
    courseCount: row.courseCount ?? '',
    eventDate: row.eventDate || '',
    participantCount: row.participantCount ?? 0,
    growthSampleSize: row.growthSampleSize ?? 0,
    growthEpisodeCount: row.growthEpisodeCount ?? 0,
    improvedAnyCount: row.improvement?.any?.studentCount ?? '',
    improvedAnyRate: formatRate(row.improvement?.any?.rate),
    improvedAllSkillsCount: row.improvement?.allSkills?.studentCount ?? '',
    improvedAllSkillsRate: formatRate(row.improvement?.allSkills?.rate),
    improvedAvgPositiveCount: row.improvement?.avgPositive?.studentCount ?? '',
    improvedAvgPositiveRate: formatRate(row.improvement?.avgPositive?.rate),
    avgRawDelta: row.avgRawDelta ?? '',
    avgActualGseGrowth: row.avgActualGseGrowth ?? '',
    avgAdjustedGseGrowth: row.avgAdjustedGseGrowth ?? '',
    privacySuppressed: row.privacySuppressed ?? false,
    suppressionReason: row.suppressionReason || '',
  };
}

function flattenSkillBreakdownRows(row) {
  return (row.skillBreakdown || []).map((skillRow) => ({
    offeringKey: row.offeringKey,
    offeringLabel: row.label,
    skillLabel: skillRow.label || skillRow.skill,
    growthSampleSize: skillRow.growthSampleSize ?? 0,
    avgRawDelta: skillRow.avgRawDelta ?? '',
    avgActualGseGrowth: skillRow.avgActualGseGrowth ?? '',
    avgAdjustedGseGrowth: skillRow.avgAdjustedGseGrowth ?? '',
    improvedRateAny: formatRate(skillRow.improvedRateAny),
    privacySuppressed: skillRow.privacySuppressed ?? false,
  }));
}

function flattenStudentDetailRows(offeringKey, offeringLabel, students) {
  return (students || []).map((student) => ({
    offeringKey,
    offeringLabel,
    studentId: student.studentId,
    growthEpisodeCount: student.growthEpisodeCount ?? 0,
    avgRawDelta: student.avgRawDelta ?? '',
    avgActualGseGrowth: student.avgActualGseGrowth ?? '',
    avgAdjustedGseGrowth: student.avgAdjustedGseGrowth ?? '',
    improvedAny: student.improvement?.any?.studentCount ? '是' : (student.growthSampleSize ? '否' : ''),
    improvedAllSkills: student.improvement?.allSkills?.studentCount ? '是' : (student.growthSampleSize ? '否' : ''),
    improvedAvgPositive: student.improvement?.avgPositive?.studentCount ? '是' : (student.growthSampleSize ? '否' : ''),
  }));
}

function buildStudentExportRows(ctx) {
  const rows = [];
  let truncated = false;
  for (const offering of ctx.rows) {
    const participantIds = resolveOfferingParticipantIds(ctx.dimension, offering.offeringKey, {
      enrollments: ctx.enrollments,
      events: ctx.events,
    });
    const students = buildStudentDetailRows(participantIds, ctx.growthMap, ctx.growthEpisodeMap);
    const flattened = flattenStudentDetailRows(offering.offeringKey, offering.label, students);
    if (rows.length + flattened.length > MAX_EXPORT_STUDENT_ROWS) {
      truncated = true;
      rows.push(...flattened.slice(0, MAX_EXPORT_STUDENT_ROWS - rows.length));
      break;
    }
    rows.push(...flattened);
  }
  return { rows, truncated, maxRows: MAX_EXPORT_STUDENT_ROWS };
}

/**
 * 細項分析匯出 XLSX（彙總 + 技能 + 學生明細）
 */
async function buildOfferingsExportWorkbook(query = {}, options = {}) {
  const filters = stripEmptyQueryParams(query);
  const dimension = normalizeDimension(filters.dimension);
  const ctx = await buildOfferingContext(filters, options);
  if (ctx.blocked) {
    const err = new Error('無權限匯出此細項資料');
    err.status = 403;
    throw err;
  }

  const summaryItems = ctx.rows.map((row) => flattenOfferingSummaryRow(row, dimension));
  const skillItems = ctx.rows.flatMap((row) => flattenSkillBreakdownRows(row));
  const studentPayload = buildStudentExportRows(ctx);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EEARS Learning Analytics';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('細項彙總');
  summarySheet.columns = buildWorksheetColumns(OFFERING_SUMMARY_COLUMNS);
  summarySheet.getRow(1).font = { bold: true };
  appendRows(summarySheet, summaryItems, OFFERING_SUMMARY_COLUMNS);

  const skillSheet = workbook.addWorksheet('技能明細');
  skillSheet.columns = buildWorksheetColumns(SKILL_BREAKDOWN_COLUMNS);
  skillSheet.getRow(1).font = { bold: true };
  appendRows(skillSheet, skillItems, SKILL_BREAKDOWN_COLUMNS);

  const studentSheet = workbook.addWorksheet('學生明細');
  studentSheet.columns = buildWorksheetColumns(STUDENT_DETAIL_COLUMNS);
  studentSheet.getRow(1).font = { bold: true };
  appendRows(studentSheet, studentPayload.rows, STUDENT_DETAIL_COLUMNS);

  const metaSheet = workbook.addWorksheet(META_SHEET_NAME);
  metaSheet.columns = [
    { header: '欄位', key: 'key', width: 24 },
    { header: '值', key: 'value', width: 72 },
  ];
  metaSheet.getRow(1).font = { bold: true };
  metaSheet.addRow({ key: '匯出類型', value: '學習成效分析－細項分析' });
  metaSheet.addRow({ key: '分析維度', value: DIMENSION_LABELS[dimension] || dimension });
  metaSheet.addRow({ key: '教師彙總方式', value: ctx.instructorGrouping || '' });
  metaSheet.addRow({ key: '分析快照版本', value: ctx.snapshotVersion });
  metaSheet.addRow({ key: '細項列數', value: summaryItems.length });
  metaSheet.addRow({ key: '技能明細筆數', value: skillItems.length });
  metaSheet.addRow({ key: '學生明細筆數', value: studentPayload.rows.length });
  metaSheet.addRow({ key: '學生明細是否截斷', value: studentPayload.truncated ? '是' : '否' });
  metaSheet.addRow({ key: '學生明細上限', value: studentPayload.maxRows });
  metaSheet.addRow({ key: '樣本不足門檻', value: MIN_GROWTH_SAMPLE });
  metaSheet.addRow({ key: '篩選條件 JSON', value: JSON.stringify(filters) });
  metaSheet.addRow({
    key: '進步定義',
    value: IMPROVEMENT_DEFINITIONS.map((item) => item.label).join('；'),
  });
  metaSheet.addRow({
    key: '備註',
    value: [
      '描述性統計匯出；含學號與英檢成績，請依個資規範使用。',
      '同一學生可能出現在多個細項列（學生明細工作表會重複學號）。',
      `可計算成長人數少於 ${MIN_GROWTH_SAMPLE} 人時，平均進步與進步率欄位可能為空（樣本不足遮蔽）。`,
      '不得將本匯出解讀為課程或教師的因果成效證明。',
    ].join(' '),
  });

  return {
    workbook,
    fileName: buildExportFileName(dimension, filters, ctx.snapshotVersion),
    dimension,
    snapshotVersion: ctx.snapshotVersion,
    filters,
    rowCount: summaryItems.length,
    studentRowCount: studentPayload.rows.length,
    truncated: studentPayload.truncated,
    maxRows: studentPayload.maxRows,
  };
}

module.exports = {
  MAX_EXPORT_STUDENT_ROWS,
  buildOfferingsExportWorkbook,
  flattenOfferingSummaryRow,
  flattenSkillBreakdownRows,
  flattenStudentDetailRows,
};
