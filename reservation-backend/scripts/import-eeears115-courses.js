'use strict';

/**
 * 匯入 EEARS115_資料/修課名單Raw data 內各學期修課名單（GE / EAP / ESP）
 *
 * 用法：
 *   node scripts/import-eeears115-courses.js              # 全部學期 apply
 *   node scripts/import-eeears115-courses.js --dry-run    # 只預覽
 *   node scripts/import-eeears115-courses.js --semester 114-2
 *   node scripts/import-eeears115-courses.js --no-class-sync
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const {
  dryRunAcademicCourseRosterImport,
  parseAcademicCourseRosterWorkbook,
  syncClassRostersFromParsedRows,
} = require('../services/learningJourney/academicCourseRosterImportService');
const { applyCourseImport } = require('../services/learningJourney/courseRecordService');
const { rebuildAnalyticsInBatches } = require('../services/learningJourney/analytics/analyticRebuildService');

const DATA_DIR = path.join(__dirname, '..', '..', 'EEARS115_資料', '修課名單Raw data');
const FILE_PATTERN = /^修課名單(\d{3}-\d)\.xlsx$/i;

function listCourseRosterFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`找不到資料夾：${DATA_DIR}`);
  }
  return fs.readdirSync(DATA_DIR)
    .filter((name) => FILE_PATTERN.test(name))
    .map((name) => {
      const semesterId = name.match(FILE_PATTERN)[1];
      return { name, semesterId, filePath: path.join(DATA_DIR, name) };
    })
    .sort((a, b) => a.semesterId.localeCompare(b.semesterId));
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = {
    dryRun: argv.includes('--dry-run'),
    noClassSync: argv.includes('--no-class-sync'),
    semester: null,
  };
  const semIdx = argv.indexOf('--semester');
  if (semIdx >= 0 && argv[semIdx + 1]) {
    args.semester = String(argv[semIdx + 1]).trim();
  }
  return args;
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

function dedupeParsedRows(rows) {
  const seen = new Set();
  const unique = [];
  const duplicateRows = [];
  for (const row of rows) {
    const key = `${row.semesterId}::${row.courseCode}::${row.studentId}`;
    if (seen.has(key)) {
      duplicateRows.push({ rowNumber: row.rowNumber, key });
      continue;
    }
    seen.add(key);
    unique.push(row);
  }
  return { unique, duplicateRows };
}

function printSummary(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const args = parseArgs();
  let files = listCourseRosterFiles();
  if (!files.length) {
    throw new Error(`在 ${DATA_DIR} 找不到修課名單 xlsx`);
  }
  if (args.semester) {
    files = files.filter((f) => f.semesterId === args.semester);
    if (!files.length) {
      throw new Error(`找不到學期 ${args.semester} 的修課名單`);
    }
  }

  console.log(`[info] 將處理 ${files.length} 個學期：${files.map((f) => f.semesterId).join(', ')}`);
  console.log(`[info] mode=${args.dryRun ? 'dry-run' : 'apply'} syncClassRoster=${!args.noClassSync}`);

  const batchStamp = `eeears115-courses:${new Date().toISOString().slice(0, 10)}`;
  const summaries = [];
  const affectedStudentIds = new Set();
  const actor = { id: 'script:import-eeears115-courses', role: 'system' };

  for (const entry of files) {
    const fileBuffer = fs.readFileSync(entry.filePath);
    const importOpts = {
      fileBuffer,
      semesterId: entry.semesterId,
      syncClassRoster: !args.noClassSync,
      sourceFile: entry.name,
    };

    if (args.dryRun) {
      const result = await dryRunAcademicCourseRosterImport(importOpts);
      summaries.push({ semesterId: entry.semesterId, file: entry.name, result });
      printSummary(`${entry.semesterId} (${entry.name})`, result);
      continue;
    }

    const parsed = parseAcademicCourseRosterWorkbook(fileBuffer, entry.semesterId);
    const { unique: uniqueRows, duplicateRows } = dedupeParsedRows(parsed.rows);
    const courseResult = await applyCourseImport({
      rows: uniqueRows.map(toCourseImportRawRow),
      sourceFile: `${batchStamp}:${entry.name}`,
      actor,
      deferAnalyticsRebuild: true,
    });

    const result = {
      ...courseResult,
      format: 'academic_course_roster',
      semesterId: entry.semesterId,
      sheetStats: parsed.sheetStats,
      skippedRows: parsed.skippedRows,
      parsedRows: parsed.rows.length,
      dedupedRows: duplicateRows.length,
      duplicateRows,
    };

    if (courseResult.error) {
      printSummary(`${entry.semesterId} 匯入失敗`, result);
      throw new Error(`${entry.semesterId}: ${courseResult.error}`);
    }

    if (!args.noClassSync) {
      try {
        result.classRoster = await syncClassRostersFromParsedRows(uniqueRows);
      } catch (err) {
        result.classRoster = { error: err?.message || String(err) };
      }
    }

    for (const row of uniqueRows) {
      if (row.studentId) affectedStudentIds.add(row.studentId);
    }

    summaries.push({ semesterId: entry.semesterId, file: entry.name, result });
    printSummary(`${entry.semesterId} (${entry.name})`, result);
  }

  const totals = summaries.reduce((acc, item) => {
    const r = item.result || {};
    acc.inputRows += r.inputRows || r.parsedRows || 0;
    acc.validRows += r.validRows || 0;
    acc.createdEnrollments += r.createdEnrollments || 0;
    acc.updatedEnrollments += r.updatedEnrollments || 0;
    acc.unchangedEnrollments += r.unchangedEnrollments || 0;
    acc.createdCourses += r.createdCourses || 0;
    acc.skippedParse += (r.skippedRows || []).length;
    return acc;
  }, {
    inputRows: 0,
    validRows: 0,
    createdEnrollments: 0,
    updatedEnrollments: 0,
    unchangedEnrollments: 0,
    createdCourses: 0,
    skippedParse: 0,
  });

  printSummary('全部學期合計', totals);

  if (!args.dryRun && affectedStudentIds.size > 0) {
    console.log(`\n[info] 開始 global analytics rebuild（觸及 ${affectedStudentIds.size} 位學生）…`);
    const rebuild = await rebuildAnalyticsInBatches({
      scope: 'global',
      batchSize: 100,
      dryRun: false,
    });
    printSummary('Analytics rebuild', rebuild);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
