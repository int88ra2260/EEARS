'use strict';

const ExcelJS = require('exceljs');
const {
  formatTimestampForFilename,
  sanitizeFilenameSegment,
} = require('../../utils/reportExportFilename');
const { getCurrentSemester } = require('../../utils/semesterConstants');
const {
  DEFINITION,
  loadFilteredB1Plus,
  loadNames,
  loadStudentCourses,
} = require('./learningAnalyticsB1PlusService');

const SITUATION_LABELS = {
  neither: '尚未修課，也尚未參加活動',
  course_only: '有修課，尚未參加活動',
  activity_only: '有活動，尚未修課',
  both: '已有修課與活動，仍未達 B2',
};

function courseLabel(row) {
  if (!Array.isArray(row.courses) || !row.courses.length) return '';
  return row.courses.map((course) => {
    const semester = course.semesterId ? `${course.semesterId} ` : '';
    const name = `${semester}${course.courseName || '未命名課程'}`;
    return course.inProgress ? `${name}（修課中）` : name;
  }).join('\n');
}

function pretestLabel(row, skill) {
  const band = row.pretest?.[skill];
  const gse = row.pretestGse?.[skill];
  if (!band && (gse == null || gse === '')) return '';
  if (band && gse != null) return `${band}（${gse}）`;
  return band || String(gse);
}

function postExamHours(row) {
  const hours = Number(row.postExamCourseHours) + Number(row.postExamActivityHours);
  return Number.isFinite(hours) && hours > 0 ? hours : '';
}

function presentB1PlusExportRow(row) {
  return {
    studentId: row.studentId || '',
    studentName: row.studentName || '',
    department: row.department || '',
    cohort: row.cohort || '',
    bestGse: row.bestGse ?? '',
    currentLevel: row.currentLevel || '',
    daysSinceExam: row.daysSinceExam ?? '',
    lastExamDate: row.lastExamDate || '',
    postExamHours: postExamHours(row),
    listening: pretestLabel(row, 'listening'),
    reading: pretestLabel(row, 'reading'),
    speaking: pretestLabel(row, 'speaking'),
    writing: pretestLabel(row, 'writing'),
    course: courseLabel(row),
    activityHours: row.activityHours ?? '',
    situation: SITUATION_LABELS[row.situation] || '',
  };
}

function workbookFromB1PlusRows({ rows, snapshotVersion, applied, summary }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EEARS';
  wb.created = new Date();

  const meta = wb.addWorksheet('名單說明');
  meta.columns = [
    { header: '項目', key: 'key', width: 24 },
    { header: '內容', key: 'value', width: 88 },
  ];
  const notes = [
    ['名單', '接近 B2'],
    ['條件', DEFINITION.rule],
    ['GSE 下限', DEFINITION.gseMin],
    ['GSE 上限', DEFINITION.gseMax],
    ['資料版本', snapshotVersion || ''],
    ['學院', applied?.college || '全部'],
    ['系所', applied?.department || '全部'],
    ['入學年度', applied?.cohort || '全部'],
    ['修課與活動', applied?.engagement || 'any'],
    ['有沒有前測', applied?.has_pretest || 'any'],
    ['前測偏低科目', applied?.weak_pretest_skill || '不限'],
    ['關鍵字', applied?.keyword || ''],
    ['排序', `${applied?.sort || 'bestGse'} ${applied?.dir || 'desc'}`],
    ['列數', rows.length],
    ['接近 B2 人數', summary?.matched ?? ''],
    ['說明', '這一張是畫面上的接近 B2 名單，不是原始英檢明細。'],
  ];
  for (const [key, value] of notes) meta.addRow({ key, value });

  const sheet = wb.addWorksheet('接近B2名單');
  sheet.columns = [
    { header: '學號', key: 'studentId', width: 14 },
    { header: '姓名', key: 'studentName', width: 12 },
    { header: '系所', key: 'department', width: 18 },
    { header: '入學年度', key: 'cohort', width: 12 },
    { header: '目前最佳 GSE', key: 'bestGse', width: 16 },
    { header: '目前帶級', key: 'currentLevel', width: 12 },
    { header: '距上次考試（天）', key: 'daysSinceExam', width: 18 },
    { header: '最後考試日', key: 'lastExamDate', width: 14 },
    { header: '考後投入時數', key: 'postExamHours', width: 14 },
    { header: '聽力前測', key: 'listening', width: 16 },
    { header: '閱讀前測', key: 'reading', width: 16 },
    { header: '口說前測', key: 'speaking', width: 16 },
    { header: '寫作前測', key: 'writing', width: 16 },
    { header: '修過的課', key: 'course', width: 36 },
    { header: '累積活動時數', key: 'activityHours', width: 14 },
    { header: '修課與活動', key: 'situation', width: 28 },
  ];
  for (const row of rows) sheet.addRow(presentB1PlusExportRow(row));
  sheet.getColumn('course').alignment = { wrapText: true, vertical: 'top' };
  return wb;
}

async function buildB1PlusExportWorkbook(query = {}) {
  const loaded = await loadFilteredB1Plus(query);
  const ids = loaded.rows.map((row) => row.studentId);
  const missingNames = loaded.rows.filter((row) => !row.studentName).map((row) => row.studentId);
  const [names, courseLists] = await Promise.all([
    missingNames.length ? loadNames(missingNames) : Promise.resolve(new Map()),
    loadStudentCourses(ids, getCurrentSemester()),
  ]);
  const rows = loaded.rows.map((row) => {
    const id = String(row.studentId).toUpperCase();
    return {
      ...row,
      studentName: row.studentName || names.get(id) || null,
      courses: courseLists.get(id) || [],
    };
  });
  const fileName = `EEARS_LA_b1plus_${sanitizeFilenameSegment(loaded.snapshotVersion, 'snapshot')}_${formatTimestampForFilename()}.xlsx`;
  return {
    workbook: workbookFromB1PlusRows({
      rows,
      snapshotVersion: loaded.snapshotVersion,
      applied: loaded.applied,
      summary: loaded.summary,
    }),
    fileName,
    rowCount: rows.length,
    snapshotVersion: loaded.snapshotVersion,
    applied: loaded.applied,
  };
}

module.exports = {
  presentB1PlusExportRow,
  workbookFromB1PlusRows,
  buildB1PlusExportWorkbook,
};
