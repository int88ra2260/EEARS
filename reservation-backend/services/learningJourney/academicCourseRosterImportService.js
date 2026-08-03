'use strict';

const XLSX = require('xlsx');
const { Class, ClassMembership } = require('../../models');
const { normalizeStudentId } = require('./utils/studentNormalization');
const { dryRunCourseImport, applyCourseImport } = require('./courseRecordService');

const ACADEMIC_HEADERS = {
  seq: ['序號', 'seq', 'no'],
  courseName: ['課程名稱', 'courseName', 'course_name', '課名'],
  instructorName: ['授課教師', 'instructorName', 'instructor_name', '教師'],
  studentId: ['學號', 'studentId', 'student_id'],
  studentName: ['姓名', 'studentName', 'student_name', 'name'],
  departmentName: ['系所', 'departmentName', 'department_name', 'department'],
  gradeLabel: ['年級', 'grade'],
  classLabel: ['班別', 'class'],
  email: ['電子信箱', 'email', 'e-mail'],
};

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/\s+/g, ' ');
}

function pick(row, key) {
  for (const alias of ACADEMIC_HEADERS[key] || []) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias];
  }
  return '';
}

function looksLikeCourseCode(value) {
  const raw = clean(value).toUpperCase();
  if (!raw) return false;
  if (/^\d+$/.test(raw)) return false;
  return /^[A-Z]{2,}\d[A-Z0-9]*$/.test(raw);
}

function parseGradeNumber(label) {
  const raw = clean(label);
  if (!raw) return null;
  const digit = raw.match(/(\d)/);
  if (digit) return Number(digit[1]);
  const map = { 一: 1, 二: 2, 三: 3, 四: 4 };
  for (const [ch, n] of Object.entries(map)) {
    if (raw.includes(ch)) return n;
  }
  return null;
}

function buildClassDisplayName(courseName, instructorName) {
  const name = clean(courseName);
  const teacher = clean(instructorName);
  if (!teacher) return name;
  if (name.includes(`（${teacher}）`) || name.includes(`(${teacher})`)) return name;
  return `${name}（${teacher}）`;
}

function courseGroupKey(sheetName, courseName, instructorName) {
  return `${clean(sheetName)}::${clean(courseName)}::${clean(instructorName)}`;
}

function toCourseImportRawRow(row) {
  return {
    學期: row.semesterId,
    課號: row.courseCode,
    課程名稱: row.courseName,
    開課單位: row.departmentName,
    授課教師: row.instructorName,
    學分: row.credits == null ? '' : row.credits,
    課程類型: row.courseType,
    學號: row.studentId,
    姓名: row.studentName,
    修課狀態: '修課中',
    是否通過: '進行中',
  };
}

/**
 * 解析教務處修課名單（多 sheet：EAP / ESP / GE）。
 * @returns {{ rows: object[], sheetStats: object[], skippedRows: object[] }}
 */
function parseAcademicCourseRosterWorkbook(fileBuffer, semesterId) {
  const sem = clean(semesterId);
  if (!sem) {
    return { rows: [], sheetStats: [], skippedRows: [{ message: '缺少學期 semesterId' }] };
  }

  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const rows = [];
  const skippedRows = [];
  const sheetStats = [];
  const groupIndexBySheet = new Map();
  const courseCodeByGroup = new Map();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    let sheetValid = 0;
    let sheetSkipped = 0;

    for (let i = 0; i < rawRows.length; i += 1) {
      const raw = rawRows[i];
      const rowNumber = i + 2;
      const studentId = normalizeStudentId(pick(raw, 'studentId'));
      const studentName = clean(pick(raw, 'studentName'));
      const courseName = clean(pick(raw, 'courseName'));
      const instructorName = clean(pick(raw, 'instructorName'));
      const seqValue = pick(raw, 'seq');

      if (!studentId && !courseName && !studentName) continue;
      if (!studentId || !studentName || !courseName) {
        sheetSkipped += 1;
        skippedRows.push({
          sheetName,
          rowNumber,
          message: '缺少學號、姓名或課程名稱',
        });
        continue;
      }

      const groupKey = courseGroupKey(sheetName, courseName, instructorName);
      if (!courseCodeByGroup.has(groupKey)) {
        const nextIndex = (groupIndexBySheet.get(sheetName) || 0) + 1;
        groupIndexBySheet.set(sheetName, nextIndex);
        const derivedCode = looksLikeCourseCode(seqValue)
          ? clean(seqValue).toUpperCase()
          : `${clean(sheetName).toUpperCase()}${String(nextIndex).padStart(3, '0')}`;
        courseCodeByGroup.set(groupKey, derivedCode);
      }

      rows.push({
        rowNumber,
        sheetName: clean(sheetName),
        semesterId: sem,
        courseCode: courseCodeByGroup.get(groupKey),
        courseName,
        departmentName: clean(pick(raw, 'departmentName')) || null,
        instructorName: instructorName || null,
        credits: null,
        courseType: clean(sheetName).toUpperCase(),
        studentId,
        studentName,
        grade: parseGradeNumber(pick(raw, 'gradeLabel')),
        classLabel: clean(pick(raw, 'classLabel')) || null,
        email: clean(pick(raw, 'email')) || null,
        enrollmentStatus: 'enrolled',
        passStatus: 'in_progress',
      });
      sheetValid += 1;
    }

    sheetStats.push({
      sheetName,
      inputRows: rawRows.length,
      validRows: sheetValid,
      skippedRows: sheetSkipped,
      uniqueCourses: [...courseCodeByGroup.entries()]
        .filter(([key]) => key.startsWith(`${clean(sheetName)}::`))
        .length,
    });
  }

  return { rows, sheetStats, skippedRows };
}

async function syncClassRostersFromParsedRows(parsedRows, options = {}) {
  const summary = {
    classesCreated: 0,
    classesUpdated: 0,
    membershipsUpserted: 0,
    classCount: 0,
  };
  if (!parsedRows.length) return summary;

  const classGroups = new Map();
  for (const row of parsedRows) {
    const key = `${row.semesterId}::${row.courseCode}`;
    if (!classGroups.has(key)) {
      classGroups.set(key, {
        semesterId: row.semesterId,
        courseCode: row.courseCode,
        courseName: row.courseName,
        instructorName: row.instructorName,
        className: buildClassDisplayName(row.courseName, row.instructorName),
        members: [],
      });
    }
    classGroups.get(key).members.push(row);
  }
  summary.classCount = classGroups.size;

  const transaction = options.transaction || null;
  for (const group of classGroups.values()) {
    const [classRecord, created] = await Class.findOrCreate({
      where: { name: group.className, semester: group.semesterId },
      defaults: {
        name: group.className,
        semester: group.semesterId,
        teacherName: group.instructorName || null,
        department: null,
      },
      transaction,
    });
    if (created) summary.classesCreated += 1;
    else summary.classesUpdated += 1;

    for (const member of group.members) {
      await ClassMembership.upsert({
        semester: group.semesterId,
        classId: classRecord.id,
        studentId: member.studentId,
        studentName: member.studentName,
        department: member.departmentName || null,
        email: member.email || null,
        grade: member.grade,
      }, { transaction });
      summary.membershipsUpserted += 1;
    }
  }

  return summary;
}

async function dryRunAcademicCourseRosterImport({ fileBuffer, semesterId, syncClassRoster = true }) {
  const parsed = parseAcademicCourseRosterWorkbook(fileBuffer, semesterId);
  if (!parsed.rows.length) {
    return {
      dryRun: true,
      format: 'academic_course_roster',
      semesterId: clean(semesterId),
      error: parsed.skippedRows[0]?.message || '檔案中沒有可匯入的修課資料',
      sheetStats: parsed.sheetStats,
      skippedRows: parsed.skippedRows,
    };
  }

  const coursePreview = await dryRunCourseImport({
    rows: parsed.rows.map(toCourseImportRawRow),
    sourceFile: 'academic_course_roster',
  });

  return {
    ...coursePreview,
    format: 'academic_course_roster',
    semesterId: clean(semesterId),
    syncClassRoster: !!syncClassRoster,
    sheetStats: parsed.sheetStats,
    skippedRows: parsed.skippedRows,
    classRosterPreview: syncClassRoster ? {
      wouldSyncClasses: new Set(parsed.rows.map((r) => r.courseCode)).size,
      wouldSyncMemberships: parsed.rows.length,
    } : null,
  };
}

async function applyAcademicCourseRosterImport({
  fileBuffer,
  semesterId,
  syncClassRoster = true,
  sourceFile = '',
  actor = null,
}) {
  const parsed = parseAcademicCourseRosterWorkbook(fileBuffer, semesterId);
  if (!parsed.rows.length) {
    return {
      applied: false,
      format: 'academic_course_roster',
      error: parsed.skippedRows[0]?.message || '檔案中沒有可匯入的修課資料',
      sheetStats: parsed.sheetStats,
      skippedRows: parsed.skippedRows,
    };
  }

  const courseResult = await applyCourseImport({
    rows: parsed.rows.map(toCourseImportRawRow),
    sourceFile: sourceFile || 'academic_course_roster',
    actor,
  });

  if (courseResult.error) {
    return {
      ...courseResult,
      format: 'academic_course_roster',
      sheetStats: parsed.sheetStats,
      skippedRows: parsed.skippedRows,
      classRoster: null,
    };
  }

  let classRoster = null;
  if (syncClassRoster) {
    try {
      classRoster = await syncClassRostersFromParsedRows(parsed.rows);
    } catch (err) {
      classRoster = { error: err?.message || String(err) };
    }
  }

  return {
    ...courseResult,
    format: 'academic_course_roster',
    semesterId: clean(semesterId),
    syncClassRoster: !!syncClassRoster,
    sheetStats: parsed.sheetStats,
    skippedRows: parsed.skippedRows,
    classRoster,
  };
}

module.exports = {
  parseAcademicCourseRosterWorkbook,
  buildClassDisplayName,
  looksLikeCourseCode,
  dryRunAcademicCourseRosterImport,
  applyAcademicCourseRosterImport,
  syncClassRostersFromParsedRows,
};
