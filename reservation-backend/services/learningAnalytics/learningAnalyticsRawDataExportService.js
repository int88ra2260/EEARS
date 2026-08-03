'use strict';

const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const { LjAnalyticStudent, LjAnalyticExam, LjStudentEvent } = require('../../models');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const {
  buildStudentWhere,
  buildExamWhere,
  applyEvidenceQualityFilter,
  stripEmptyQueryParams,
} = require('./learningAnalyticsFilterUtils');
const {
  buildStudentPrePostExportRow,
  enrichExamExportRow,
  EXAM_SESSION_WINDOW_DAYS,
} = require('./prePostExamExportUtils');
const {
  sanitizeFilenameSegment,
  formatTimestampForFilename,
} = require('../../utils/reportExportFilename');

const MAX_EXPORT_STUDENTS = 5000;
const MAX_EXPORT_EXAMS = 20000;
const MAX_EXPORT_EVENTS = 30000;

const EVENT_TYPE_LABELS = {
  course_event: '修課',
  activity_event: '活動',
};

const STUDENT_EXPORT_COLUMNS = [
  { key: 'studentId', header: '學號', width: 14 },
  { key: 'cohort', header: '入學 cohort', width: 10 },
  { key: 'college', header: '學院', width: 18 },
  { key: 'department', header: '系所', width: 18 },
  { key: 'baselineEnglishScore', header: '學測英文分數', width: 14 },
  { key: 'baselineCefr', header: '起始 CEFR', width: 12 },
  { key: 'primaryInstrument', header: '主要英檢工具', width: 14 },
  { key: 'examRoundCount', header: '檢定梯次數', width: 12 },
  { key: 'preTestLabel', header: '前測類型', width: 12 },
  { key: 'preTestDateStart', header: '前測日期（起）', width: 14 },
  { key: 'preTestDateEnd', header: '前測日期（迄）', width: 14 },
  { key: 'preListeningScore', header: '前測聽力', width: 10 },
  { key: 'preReadingScore', header: '前測閱讀', width: 10 },
  { key: 'preSpeakingScore', header: '前測口說', width: 10 },
  { key: 'preWritingScore', header: '前測寫作', width: 10 },
  { key: 'preListeningCefr', header: '前測聽力 CEFR', width: 12 },
  { key: 'preReadingCefr', header: '前測閱讀 CEFR', width: 12 },
  { key: 'preSpeakingCefr', header: '前測口說 CEFR', width: 12 },
  { key: 'preWritingCefr', header: '前測寫作 CEFR', width: 12 },
  { key: 'postTestLabel', header: '後測類型', width: 12 },
  { key: 'postTestDateStart', header: '後測日期（起）', width: 14 },
  { key: 'postTestDateEnd', header: '後測日期（迄）', width: 14 },
  { key: 'postListeningScore', header: '後測聽力', width: 10 },
  { key: 'postReadingScore', header: '後測閱讀', width: 10 },
  { key: 'postSpeakingScore', header: '後測口說', width: 10 },
  { key: 'postWritingScore', header: '後測寫作', width: 10 },
  { key: 'postListeningCefr', header: '後測聽力 CEFR', width: 12 },
  { key: 'postReadingCefr', header: '後測閱讀 CEFR', width: 12 },
  { key: 'postSpeakingCefr', header: '後測口說 CEFR', width: 12 },
  { key: 'postWritingCefr', header: '後測寫作 CEFR', width: 12 },
  { key: 'deltaListeningScore', header: '聽力增益', width: 10 },
  { key: 'deltaReadingScore', header: '閱讀增益', width: 10 },
  { key: 'deltaSpeakingScore', header: '口說增益', width: 10 },
  { key: 'deltaWritingScore', header: '寫作增益', width: 10 },
  { key: 'bestCefr', header: '最佳 CEFR', width: 10 },
  { key: 'isB2plus', header: 'B2+ 達標', width: 10 },
];

const EXAM_EXPORT_COLUMNS = [
  { key: 'studentId', header: '學號', width: 14 },
  { key: 'instrument', header: '英檢工具', width: 12 },
  { key: 'examRound', header: '檢定梯次', width: 10 },
  { key: 'testPhase', header: '前測後測', width: 10 },
  { key: 'sessionDateStart', header: '梯次日期（起）', width: 14 },
  { key: 'sessionDateEnd', header: '梯次日期（迄）', width: 14 },
  { key: 'skill', header: '技能', width: 12 },
  { key: 'examDate', header: '技能考試日期', width: 14 },
  { key: 'rawScore', header: '原始分數', width: 10 },
  { key: 'cefrLevel', header: 'CEFR 等級', width: 10 },
  { key: 'isB2plus', header: 'B2+ 達標', width: 10 },
  { key: 'previousRawScore', header: '同技能前次分數', width: 14 },
  { key: 'deltaRawScore', header: '同技能分數變化', width: 14 },
  { key: 'courseHoursBeforeExam', header: '該技能考前修課時數', width: 16 },
  { key: 'activityHoursBeforeExam', header: '該技能考前活動時數', width: 16 },
  { key: 'resourceHoursBeforeExam', header: '該技能考前資源時數', width: 16 },
  { key: 'exposureWindowStart', header: '曝光起算日', width: 14 },
];

const EVENT_EXPORT_COLUMNS = [
  { key: 'studentId', header: '學號', width: 14 },
  { key: 'eventTypeLabel', header: '事件類型', width: 12 },
  { key: 'eventDate', header: '事件日期', width: 14 },
  { key: 'title', header: '名稱', width: 28 },
  { key: 'subtitle', header: '副標', width: 20 },
  { key: 'hours', header: '時數', width: 10 },
  { key: 'instrument', header: '工具', width: 12 },
  { key: 'skill', header: '技能', width: 12 },
  { key: 'cefrLevel', header: 'CEFR', width: 10 },
  { key: 'status', header: '狀態', width: 12 },
  { key: 'excludeFlag', header: '排除標記', width: 10 },
  { key: 'reasonCode', header: '原因碼', width: 14 },
  { key: 'sourceSystem', header: '來源系統', width: 14 },
  { key: 'sourceRecordId', header: '來源紀錄 ID', width: 18 },
];

const STUDENT_SCOPE_KEYS = new Set([
  'cohort',
  'college',
  'department',
  'admission_type',
  'baseline_level',
  'exposure_level',
  'is_overseas_student',
  'has_valid_exam',
  'retest_flag',
  'is_b2plus',
  'include_reason_code',
  'exclude_reason_code',
  'reason_code_include',
  'reason_code_exclude',
  'evidence_quality',
  'student_id',
  'studentId',
]);

function hasStudentScopeFilters(query = {}) {
  return [...STUDENT_SCOPE_KEYS].some((key) => query[key] != null && query[key] !== '');
}

function formatCellValue(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof value === 'boolean') return value ? '是' : '否';
  return value;
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

async function resolveScopedStudentIds(query, snapshotVersion) {
  let students = await LjAnalyticStudent.findAll({
    where: buildStudentWhere(query, snapshotVersion),
    attributes: [
      'studentId',
      'retestFlag',
      'hasValidExam',
      'baselineEnglishScore',
      'totalResourceHours',
    ],
  });
  students = applyEvidenceQualityFilter(students, query);
  return students.map((student) => student.studentId);
}

async function loadExamsByStudentMap(snapshotVersion, studentIds) {
  if (!studentIds.length) return new Map();
  const rows = await LjAnalyticExam.findAll({
    where: {
      snapshotVersion,
      studentId: { [Op.in]: studentIds },
    },
    order: [['studentId', 'ASC'], ['examDate', 'ASC'], ['skill', 'ASC']],
  });
  const map = new Map();
  for (const row of rows) {
    const json = row.toJSON();
    if (!map.has(json.studentId)) map.set(json.studentId, []);
    map.get(json.studentId).push(json);
  }
  return map;
}

async function fetchStudentsForExport(query, snapshotVersion) {
  // 不走 queryAnalyticStudents：該 API 單次 limit 上限 500，僅供頁面預覽
  let rows = await LjAnalyticStudent.findAll({
    where: buildStudentWhere(query, snapshotVersion),
    order: [['studentId', 'ASC']],
  });
  rows = applyEvidenceQualityFilter(rows, query);
  const total = rows.length;
  const capped = rows.slice(0, MAX_EXPORT_STUDENTS);
  const studentIds = capped.map((row) => row.studentId);
  const examsByStudent = await loadExamsByStudentMap(snapshotVersion, studentIds);
  const items = capped.map((row) => buildStudentPrePostExportRow(
    row.toJSON(),
    examsByStudent.get(row.studentId) || []
  ));
  return {
    items,
    total,
    truncated: total > capped.length,
    maxRows: MAX_EXPORT_STUDENTS,
  };
}

async function fetchExamsForExport(query, snapshotVersion) {
  const scoped = hasStudentScopeFilters(query);
  let studentIds = null;
  if (scoped) {
    studentIds = await resolveScopedStudentIds(query, snapshotVersion);
    if (!studentIds.length) {
      return { items: [], total: 0, truncated: false, maxRows: MAX_EXPORT_EXAMS };
    }
  }

  const where = scoped
    ? buildExamWhere(query, snapshotVersion, studentIds)
    : buildExamWhere(query, snapshotVersion, undefined);

  const { rows, count } = await LjAnalyticExam.findAndCountAll({
    where,
    limit: MAX_EXPORT_EXAMS,
    offset: 0,
    order: [['examDate', 'ASC'], ['studentId', 'ASC'], ['skill', 'ASC']],
  });

  const rawItems = rows.map((row) => row.toJSON());
  const exportStudentIds = [...new Set(rawItems.map((row) => row.studentId))];
  const examsByStudent = await loadExamsByStudentMap(snapshotVersion, exportStudentIds);
  const items = rawItems.map((row) => enrichExamExportRow(
    row,
    examsByStudent.get(row.studentId) || []
  ));

  return {
    items,
    total: count,
    truncated: count > rows.length,
    maxRows: MAX_EXPORT_EXAMS,
  };
}

async function fetchEventsForExport(query, snapshotVersion, dataset) {
  const ds = String(dataset || 'events').toLowerCase();
  const eventTypes = ds === 'courses'
    ? ['course_event']
    : ds === 'activities'
      ? ['activity_event']
      : ['course_event', 'activity_event'];

  const studentIds = await resolveScopedStudentIds(query, snapshotVersion);
  if (!studentIds.length) {
    return { items: [], total: 0, truncated: false, maxRows: MAX_EXPORT_EVENTS };
  }

  const where = {
    studentId: { [Op.in]: studentIds },
    eventType: { [Op.in]: eventTypes },
    status: { [Op.in]: ['valid', 'registered_no_score'] },
  };

  const { rows, count } = await LjStudentEvent.findAndCountAll({
    where,
    limit: MAX_EXPORT_EVENTS,
    offset: 0,
    order: [['eventDate', 'ASC'], ['studentId', 'ASC'], ['id', 'ASC']],
  });

  const items = rows.map((row) => {
    const json = row.toJSON();
    return {
      ...json,
      eventTypeLabel: EVENT_TYPE_LABELS[json.eventType] || json.eventType,
    };
  });

  return {
    items,
    total: count,
    truncated: count > rows.length,
    maxRows: MAX_EXPORT_EVENTS,
  };
}

/**
 * EEARS 匯出檔名（ASCII）：EEARS_LA_raw-<dataset>_<semester>_snap-<snapshot>_<YYYYMMDD_HHmm>.<ext>
 */
function buildExportFileName(dataset, filters = {}, snapshotVersion = '', ext = 'xlsx') {
  const stamp = formatTimestampForFilename();
  const sem = sanitizeFilenameSegment(filters.semester || 'all', 'all');
  const ds = ['students', 'exams', 'courses', 'activities', 'events'].includes(dataset)
    ? dataset
    : 'students';
  const snap = sanitizeFilenameSegment(String(snapshotVersion || 'snapshot').split('|')[0], 'snapshot');
  return `EEARS_LA_raw-${ds}_${sem}_snap-${snap}_${stamp}.${ext}`;
}

function buildSheetName(dataset) {
  if (dataset === 'exams') return '分析考試表';
  if (dataset === 'courses') return '修課事件';
  if (dataset === 'activities') return '活動事件';
  if (dataset === 'events') return '修課與活動事件';
  return '分析學生表';
}

function resolveExportColumns(dataset) {
  if (dataset === 'exams') return EXAM_EXPORT_COLUMNS;
  if (['courses', 'activities', 'events'].includes(dataset)) return EVENT_EXPORT_COLUMNS;
  return STUDENT_EXPORT_COLUMNS;
}

function resolveDatasetLabel(dataset) {
  if (dataset === 'exams') return '分析考試表';
  if (dataset === 'courses') return '修課事件（lj_student_events）';
  if (dataset === 'activities') return '活動事件（lj_student_events）';
  if (dataset === 'events') return '修課與活動事件（lj_student_events）';
  return '分析學生表';
}

function escapeCsvCell(value) {
  const text = formatCellValue(value);
  const s = String(text);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsvBuffer(columnDefs, items) {
  const header = columnDefs.map((col) => escapeCsvCell(col.header)).join(',');
  const lines = items.map((item) => columnDefs.map((col) => escapeCsvCell(item[col.key])).join(','));
  const bom = '\uFEFF';
  return Buffer.from(`${bom}${[header, ...lines].join('\n')}`, 'utf8');
}

const META_SHEET_NAME = '匯出說明';

async function fetchExportPayload(dataset, filters, snapshotVersion) {
  if (dataset === 'exams') return fetchExamsForExport(filters, snapshotVersion);
  if (['courses', 'activities', 'events'].includes(dataset)) {
    return fetchEventsForExport(filters, snapshotVersion, dataset);
  }
  return fetchStudentsForExport(filters, snapshotVersion);
}

/**
 * 依目前篩選條件匯出 lj_analytic_* 原始資料為 XLSX
 */
async function buildRawDataExportWorkbook(query = {}) {
  const dataset = String(query.dataset || 'students').toLowerCase();
  const filters = stripEmptyQueryParams(query);
  const snapshotVersion = filters.snapshot_version || filters.snapshotVersion || await resolveLatestSnapshotVersion();

  const payload = await fetchExportPayload(dataset, filters, snapshotVersion);

  const columnDefs = resolveExportColumns(dataset);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EEARS Learning Analytics';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(buildSheetName(dataset));
  sheet.columns = buildWorksheetColumns(columnDefs);
  sheet.getRow(1).font = { bold: true };
  appendRows(sheet, payload.items, columnDefs);

  const metaSheet = workbook.addWorksheet(META_SHEET_NAME);
  metaSheet.columns = [
    { header: '欄位', key: 'key', width: 24 },
    { header: '值', key: 'value', width: 60 },
  ];
  metaSheet.getRow(1).font = { bold: true };
  metaSheet.addRow({ key: '資料集', value: resolveDatasetLabel(dataset) });
  metaSheet.addRow({ key: '分析快照版本', value: snapshotVersion });
  metaSheet.addRow({ key: '本次匯出筆數', value: payload.items.length });
  metaSheet.addRow({ key: '符合條件總筆數', value: payload.total });
  metaSheet.addRow({ key: '是否截斷', value: payload.truncated ? '是' : '否' });
  metaSheet.addRow({ key: '匯出上限', value: payload.maxRows });
  metaSheet.addRow({ key: '篩選條件 JSON', value: JSON.stringify(filters) });
  metaSheet.addRow({
    key: '備註',
    value: [
      '觀察資料匯出；含學號與英檢成績，請依個資規範使用。',
      `前測＝主要英檢工具（優先 BESTEP）第 1 梯；後測＝第 2 梯；增益＝後測－前測（同技能）。`,
      `同一梯次：BESTEP 以同一學期合併（聽讀／口寫分日應考視為同一梯）；其他工具考試日相距 ≤${EXAM_SESSION_WINDOW_DAYS} 天合併。`,
      '僅一次檢定者後測欄位留空。學測英文分數為入學基準，不與英檢梯次混用。',
      '快照版本／規則版本等中繼資料僅列於本工作表，不在主表重複。',
    ].join(' '),
  });

  return {
    workbook,
    fileName: buildExportFileName(dataset, filters, snapshotVersion),
    dataset,
    snapshotVersion,
    filters,
    rowCount: payload.items.length,
    total: payload.total,
    truncated: payload.truncated,
    maxRows: payload.maxRows,
  };
}

/**
 * 依目前篩選條件匯出 CSV（單一資料表，無 meta 工作表）
 */
async function buildRawDataExportCsv(query = {}) {
  const dataset = String(query.dataset || 'students').toLowerCase();
  const filters = stripEmptyQueryParams(query);
  const snapshotVersion = filters.snapshot_version || filters.snapshotVersion || await resolveLatestSnapshotVersion();
  const payload = await fetchExportPayload(dataset, filters, snapshotVersion);
  const columnDefs = resolveExportColumns(dataset);
  const buffer = buildCsvBuffer(columnDefs, payload.items);

  return {
    buffer,
    fileName: buildExportFileName(dataset, filters, snapshotVersion, 'csv'),
    dataset,
    snapshotVersion,
    filters,
    rowCount: payload.items.length,
    total: payload.total,
    truncated: payload.truncated,
    maxRows: payload.maxRows,
  };
}

module.exports = {
  buildRawDataExportWorkbook,
  buildRawDataExportCsv,
  buildExportFileName,
  MAX_EXPORT_STUDENTS,
  MAX_EXPORT_EXAMS,
  MAX_EXPORT_EVENTS,
  hasStudentScopeFilters,
};
