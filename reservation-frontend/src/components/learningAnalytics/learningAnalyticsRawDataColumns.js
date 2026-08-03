/** 原始資料預覽欄位（與匯出欄位語意對齊，預覽為 DB 摘要欄位） */

const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
  interaction: '互動',
  mediation: '調整',
  overall: '整體',
};

const EXPOSURE_LABELS = {
  none: '無',
  low: '低',
  medium: '中',
  high: '高',
};

const TEST_PHASE_LABELS = {
  pre: '前測',
  post: '後測',
  baseline: '基準',
};

function formatBool(value) {
  if (value === true) return '是';
  if (value === false) return '否';
  return '—';
}

function formatCell(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return formatBool(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function formatSkill(value) {
  if (!value) return '—';
  return SKILL_LABELS[value] || value;
}

function formatExposure(value) {
  if (!value) return '—';
  return EXPOSURE_LABELS[value] || value;
}

function formatTestPhase(value) {
  if (!value) return '—';
  return TEST_PHASE_LABELS[value] || value;
}

function formatEventType(value) {
  if (value === 'course_event') return '修課';
  if (value === 'activity_event') return '活動';
  return formatCell(value);
}

export const STUDENT_PREVIEW_COLUMNS = [
  { key: 'studentId', header: '學號', sticky: true, width: 110 },
  { key: 'cohort', header: '入學 cohort', width: 88 },
  { key: 'college', header: '學院', width: 120 },
  { key: 'department', header: '系所', width: 120 },
  { key: 'baselineEnglishScore', header: '學測英文', width: 88, align: 'end' },
  { key: 'baselineCefr', header: '起始 CEFR', width: 88 },
  { key: 'examCount', header: '英檢次數', width: 88, align: 'end' },
  { key: 'retestFlag', header: '曾重測', width: 72, format: formatBool },
  { key: 'bestCefr', header: '最佳 CEFR', width: 88 },
  { key: 'isB2plus', header: 'B2+ 達標', width: 80, format: formatBool },
  { key: 'totalResourceHours', header: '資源時數', width: 88, align: 'end' },
  { key: 'exposureLevel', header: '參與量', width: 72, format: formatExposure },
];

export const EXAM_PREVIEW_COLUMNS = [
  { key: 'studentId', header: '學號', sticky: true, width: 110 },
  { key: 'instrument', header: '英檢工具', width: 96 },
  { key: 'examRound', header: '梯次', width: 64, align: 'end' },
  { key: 'testPhase', header: '前測／後測', width: 88, format: formatTestPhase },
  { key: 'skill', header: '技能', width: 72, format: formatSkill },
  { key: 'examDate', header: '考試日期', width: 104 },
  { key: 'rawScore', header: '分數', width: 72, align: 'end' },
  { key: 'cefrLevel', header: 'CEFR', width: 72 },
  { key: 'isB2plus', header: 'B2+', width: 64, format: formatBool },
  { key: 'courseHoursBeforeExam', header: '考前修課時數', width: 108, align: 'end' },
  { key: 'activityHoursBeforeExam', header: '考前活動時數', width: 108, align: 'end' },
];

export const EVENT_PREVIEW_COLUMNS = [
  { key: 'studentId', header: '學號', sticky: true, width: 110 },
  { key: 'eventType', header: '類型', width: 72, format: formatEventType },
  { key: 'eventDate', header: '日期', width: 104 },
  { key: 'title', header: '名稱', width: 160 },
  { key: 'subtitle', header: '副標', width: 120 },
  { key: 'hours', header: '時數', width: 72, align: 'end' },
  { key: 'skill', header: '技能', width: 72, format: formatSkill },
  { key: 'status', header: '狀態', width: 88 },
  { key: 'excludeFlag', header: '排除', width: 64, format: formatBool },
  { key: 'reasonCode', header: '原因碼', width: 96 },
];

export const DATASET_OPTIONS = [
  {
    value: 'students',
    label: '分析學生摘要',
    hint: '每位學生一列：cohort、起始能力、最佳英檢、資源參與等。',
    exportNote: '匯出 Excel 會額外整理前後測欄位（與此預覽欄位不完全相同）。',
  },
  {
    value: 'exams',
    label: '分析英檢紀錄',
    hint: '每位學生每次英檢、每項技能一列。',
    exportNote: '匯出含梯次、曝光時數等完整欄位。',
  },
  {
    value: 'courses',
    label: '修課事件',
    hint: '來自 lj_student_events 的 course_event 列。',
    exportNote: '可依上方群體篩選縮小學生範圍。',
  },
  {
    value: 'activities',
    label: '活動事件',
    hint: '來自 lj_student_events 的 activity_event 列。',
    exportNote: '含 English Table、Club 等活動參與紀錄。',
  },
  {
    value: 'events',
    label: '修課＋活動事件',
    hint: '合併修課與活動兩類事件。',
    exportNote: '適合回溯單一學生的資源時間線。',
  },
];

export function getPreviewColumns(dataset) {
  if (dataset === 'exams') return EXAM_PREVIEW_COLUMNS;
  if (['courses', 'activities', 'events'].includes(dataset)) return EVENT_PREVIEW_COLUMNS;
  return STUDENT_PREVIEW_COLUMNS;
}

export function formatPreviewCell(row, column) {
  const raw = row[column.key];
  if (column.format) return column.format(raw);
  return formatCell(raw);
}

export function getDatasetMeta(dataset) {
  return DATASET_OPTIONS.find((o) => o.value === dataset) || DATASET_OPTIONS[0];
}
