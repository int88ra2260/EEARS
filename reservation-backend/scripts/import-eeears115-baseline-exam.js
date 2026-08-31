'use strict';

/**
 * 一次性匯入 EEARS115_資料：
 * - 112_115_分級統計_統一表頭.xlsx → baseline
 * - 整合完成_20260630.xlsx → external exam（略過「英語實踐歷程檔案」）
 *
 * 用法：
 *   node scripts/import-eeears115-baseline-exam.js
 *   node scripts/import-eeears115-baseline-exam.js --baseline-only
 *   node scripts/import-eeears115-baseline-exam.js --exam-only
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { importBaseline } = require('../services/learningJourney/importBaselineService');
const { importExam } = require('../services/learningJourney/importExamService');
const { rebuildAnalyticsInBatches } = require('../services/learningJourney/analytics/analyticRebuildService');

const DATA_DIR = path.join(__dirname, '..', '..', 'EEARS115_資料');
const BASELINE_FILE = path.join(DATA_DIR, '112_115_分級統計_統一表頭.xlsx');
const EXAM_FILE = path.join(DATA_DIR, '整合完成_20260630.xlsx');
const PLACEMENT_SHEETS = ['112', '113', '114', '115'];
const SKIP_EXAM_TYPE = '英語實踐歷程檔案';

function normSid(value) {
  return String(value || '').trim().toUpperCase();
}

function normName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function buildBaselineWorkbookBuffer() {
  if (!fs.existsSync(BASELINE_FILE)) {
    throw new Error(`找不到 baseline 檔：${BASELINE_FILE}`);
  }
  const wb = XLSX.readFile(BASELINE_FILE, { cellDates: true });
  const matrix = [[
    '學號',
    '姓名',
    '入學學年',
    '學測英文成績',
    '測驗年度',
    '英文分級',
  ]];

  for (const sheetName of PLACEMENT_SHEETS) {
    if (!wb.Sheets[sheetName]) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
    const enrollmentYear = Number(sheetName);
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i] || [];
      const studentId = normSid(row[3]);
      if (!studentId) continue;
      matrix.push([
        studentId,
        normName(row[4]),
        enrollmentYear,
        row[5] === '' || row[5] == null ? '' : Number(row[5]),
        '',
        normName(row[6]),
      ]);
    }
  }

  const out = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(matrix), 'baseline');
  return XLSX.write(out, { type: 'buffer', bookType: 'xlsx' });
}

function buildFilteredExamWorkbookBuffer() {
  if (!fs.existsSync(EXAM_FILE)) {
    throw new Error(`找不到 exam 檔：${EXAM_FILE}`);
  }
  const wb = XLSX.readFile(EXAM_FILE, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
  let skippedPortfolio = 0;
  let skippedEmpty = 0;
  let kept = 0;

  // 原始欄位：0–5 基本資料；6–7 學籍/身分；8–9 檢定類別/時間；10–17 四技能
  const header = [
    '系所', '學院', '班別', '年級', '學號', '姓名',
    '英文檢定類別', '檢定時間',
    '聽力成績', '聽力成績(CEFR)', '閱讀成績', '閱讀成績(CEFR)',
    '口說成績', '口說成績(CEFR)', '寫作成績', '寫作成績(CEFR)',
  ];
  const matrix = [header];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const examType = String(row[8] || '').trim();
    if (!examType) {
      skippedEmpty += 1;
      continue;
    }
    if (examType.includes(SKIP_EXAM_TYPE)) {
      skippedPortfolio += 1;
      continue;
    }
    kept += 1;
    matrix.push([
      row[0] ?? '', row[1] ?? '', row[2] ?? '', row[3] ?? '', row[4] ?? '', row[5] ?? '',
      row[8] ?? '', row[9] ?? '',
      row[10] ?? '', row[11] ?? '', row[12] ?? '', row[13] ?? '',
      row[14] ?? '', row[15] ?? '', row[16] ?? '', row[17] ?? '',
    ]);
  }

  const out = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(matrix), 'exams');
  return {
    buffer: XLSX.write(out, { type: 'buffer', bookType: 'xlsx' }),
    skippedPortfolio,
    skippedEmpty,
    kept,
  };
}

async function rebuildAfterExam() {
  return rebuildAnalyticsInBatches({
    scope: 'global',
    batchSize: 100,
    dryRun: false,
  });
}

function printSummary(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const baselineOnly = args.has('--baseline-only');
  const examOnly = args.has('--exam-only');
  const runBaseline = !examOnly;
  const runExam = !baselineOnly;
  const replaceExamConflicts = args.has('--replace-exam-conflicts');

  const batchStamp = `eeears115:${new Date().toISOString().slice(0, 10)}`;

  if (runBaseline) {
    const buffer = buildBaselineWorkbookBuffer();
    const result = await importBaseline(buffer, {
      batchId: `${batchStamp}:baseline`,
      rebuildAnalytics: true,
    });
    printSummary('Baseline 匯入', result);
  }

  if (runExam) {
    const { buffer, skippedPortfolio, skippedEmpty, kept } = buildFilteredExamWorkbookBuffer();
    console.log(`\n[info] Exam 略過「${SKIP_EXAM_TYPE}」：${skippedPortfolio} 列；無檢定類別：${skippedEmpty} 列；待匯入：${kept} 列`);
    const result = await importExam(buffer, {
      batchId: `${batchStamp}:exam${replaceExamConflicts ? ':replace' : ''}`,
      replaceMode: replaceExamConflicts,
    });
    printSummary('Exam 匯入', result);

    if ((result.inserted || 0) > 0 || (result.replaced || 0) > 0) {
      const rebuild = await rebuildAfterExam();
      printSummary('Exam 後 analytics rebuild', rebuild);
    } else {
      console.log('\n[info] Exam 無新增/替換，略過 global analytics rebuild');
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
