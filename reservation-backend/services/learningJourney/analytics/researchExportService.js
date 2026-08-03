'use strict';

const { REASON_CODES, RULE_VERSION } = require('../../../constants/learningJourneyEventConstants');
const { queryAnalyticStudents, queryAnalyticExams } = require('./analyticsQueryService');
const { resolveLatestSnapshotVersion } = require('./timelineReadService');

const CODEBOOK = [
  { field: 'student_id', type: 'string', description: '學號' },
  { field: 'cohort', type: 'string', description: '入學學年' },
  { field: 'enrollment_term', type: 'string', description: '入學學期，如 113-1' },
  { field: 'baseline_english_score', type: 'number|null', description: '學測英文等入學起點分數' },
  { field: 'exam_count', type: 'integer', description: '英檢次數（日期×工具）' },
  { field: 'retest_flag', type: 'boolean', description: '是否有同工具同技能第二次施測' },
  { field: 'exposure_level', type: 'enum', description: 'none|low|medium|high，依首考前資源時數' },
  { field: 'is_b2plus', type: 'boolean', description: '歷史最佳是否達 B2+' },
  { field: 'instrument', type: 'string', description: '英檢工具，如 TOEIC、BESTEP' },
  { field: 'skill', type: 'string', description: 'listening|reading|speaking|writing' },
  { field: 'exam_seq', type: 'integer', description: '同學生×工具×技能之第幾次考試' },
  { field: 'delta_raw_score', type: 'number|null', description: '僅同工具同技能之前後差' },
  { field: 'improved_flag', type: 'boolean|null', description: 'delta > 0' },
  { field: 'course_hours_before_exam', type: 'number', description: '考試日前修課時數累計（嚴格小於考試日）' },
  { field: 'activity_hours_before_exam', type: 'number', description: '考試日前活動時數累計' },
  { field: 'reason_code', type: 'string', description: Object.keys(REASON_CODES).join('|') },
  { field: 'snapshot_version', type: 'string', description: '事件截止+規則+程式版本' },
];

function csvEscape(v) {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const EXPORT_COLUMN_ORDER = [
  'record_type',
  'student_id',
  'cohort',
  'enrollment_term',
  'department',
  'college',
  'is_overseas_student',
  'baseline_english_score',
  'exam_count',
  'retest_flag',
  'exposure_level',
  'is_b2plus',
  'total_resource_hours',
  'exam_date',
  'instrument',
  'skill',
  'raw_score',
  'cefr_level',
  'exam_seq',
  'delta_raw_score',
  'improved_flag',
  'course_hours_before_exam',
  'activity_hours_before_exam',
  'exposure_before_exam_flag',
  'reason_code',
  'exclude_flag',
  'snapshot_version',
];

function buildExportColumns(rows) {
  const keys = new Set();
  for (const row of rows) {
    Object.keys(row || {}).forEach((k) => keys.add(k));
  }
  const columns = EXPORT_COLUMN_ORDER.filter((k) => keys.has(k));
  for (const key of [...keys].sort()) {
    if (!columns.includes(key)) columns.push(key);
  }
  return columns;
}

function toCsv(rows, columns) {
  const header = columns.join(',');
  const lines = rows.map((row) => columns.map((c) => csvEscape(row[c])).join(','));
  return [header, ...lines].join('\r\n');
}

function withUtf8Bom(csv) {
  const text = String(csv || '');
  return text.charCodeAt(0) === 0xFEFF ? text : `\uFEFF${text}`;
}

async function exportResearchData(query = {}) {
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const format = String(query.format || 'csv').toLowerCase();

  const [students, exams] = await Promise.all([
    queryAnalyticStudents({ ...query, snapshot_version: snapshotVersion, limit: 5000, offset: 0 }),
    queryAnalyticExams({ ...query, snapshot_version: snapshotVersion, limit: 20000, offset: 0 }),
  ]);

  const longRows = [];
  for (const s of students.items) {
    longRows.push({
      record_type: 'student',
      student_id: s.studentId,
      cohort: s.cohort,
      enrollment_term: s.enrollmentTerm,
      department: s.department,
      college: s.college,
      is_overseas_student: s.isOverseasStudent,
      baseline_english_score: s.baselineEnglishScore,
      exam_count: s.examCount,
      retest_flag: s.retestFlag,
      exposure_level: s.exposureLevel,
      is_b2plus: s.isB2plus,
      total_resource_hours: s.totalResourceHours,
      snapshot_version: snapshotVersion,
    });
  }
  for (const e of exams.items) {
    longRows.push({
      record_type: 'exam',
      student_id: e.studentId,
      exam_date: e.examDate,
      instrument: e.instrument,
      skill: e.skill,
      raw_score: e.rawScore,
      cefr_level: e.cefrLevel,
      exam_seq: e.examSeq,
      delta_raw_score: e.deltaRawScore,
      improved_flag: e.improvedFlag,
      retest_flag: e.retestFlag,
      course_hours_before_exam: e.courseHoursBeforeExam,
      activity_hours_before_exam: e.activityHoursBeforeExam,
      exposure_before_exam_flag: e.exposureBeforeExamFlag,
      reason_code: e.reasonCode,
      exclude_flag: e.excludeFlag,
      snapshot_version: snapshotVersion,
    });
  }

  const columns = buildExportColumns(longRows);
  const csv = withUtf8Bom(toCsv(longRows, columns));

  return {
    snapshotVersion,
    ruleVersion: RULE_VERSION,
    format,
    rowCount: longRows.length,
    studentCount: students.total,
    examCount: exams.total,
    includesControlGroup: true,
    note: '同時匯出 analytic_student 與 analytic_exam 長格式，請依 record_type 分層分析，避免僅篩選進步子群。',
    codebook: CODEBOOK,
    csv: format === 'csv' ? csv : null,
    rows: format === 'json' ? longRows : undefined,
  };
}

module.exports = {
  exportResearchData,
  CODEBOOK,
  buildExportColumns,
  toCsv,
  withUtf8Bom,
  csvEscape,
};
