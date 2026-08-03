'use strict';

/**
 * 匯出主管問答 Excel（問題一：前後測成長名冊；問題二：活動參與比較）
 * 用法：node scripts/export-manager-exam-activity-report.js [輸出目錄]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const { writeManagerExamActivityExport } = require('../services/learningAnalytics/managerExamActivityExportService');

async function main() {
  const outDir = process.argv[2] || path.join(__dirname, '..', 'exports');
  const result = await writeManagerExamActivityExport(outDir);
  console.log(JSON.stringify({
    ok: true,
    filePath: result.filePath,
    fileName: result.fileName,
    snapshotVersion: result.snapshotVersion,
    q1RowCount: result.q1RowCount,
    q2RowCount: result.q2RowCount,
    q2Summary: result.q2Summary,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => require('../db').close());
