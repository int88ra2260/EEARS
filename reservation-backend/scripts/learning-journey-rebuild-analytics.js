'use strict';

/**
 * Learning Journey v3 — analytic 衍生層重建（CLI）
 *
 * 用法：
 *   node scripts/learning-journey-rebuild-analytics.js --scope=global
 *   node scripts/learning-journey-rebuild-analytics.js --scope=semester --semester=115-1
 *   node scripts/learning-journey-rebuild-analytics.js --students=B141010003,B141010004
 *   node scripts/learning-journey-rebuild-analytics.js --scope=global --batch-size=100 --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { rebuildAnalyticsInBatches, resolveRebuildStudentIds } = require('../services/learningJourney/analytics/analyticRebuildService');

function parseArgs(argv) {
  const opts = {
    scope: 'global',
    semesterId: null,
    studentIds: [],
    batchSize: 50,
    dryRun: false,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (arg.startsWith('--scope=')) {
      opts.scope = String(arg.split('=')[1] || 'global').trim();
      continue;
    }
    if (arg.startsWith('--semester=')) {
      opts.semesterId = String(arg.split('=')[1] || '').trim();
      opts.scope = 'semester';
      continue;
    }
    if (arg.startsWith('--students=')) {
      opts.studentIds = String(arg.split('=')[1] || '')
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      opts.scope = 'manual';
      continue;
    }
    if (arg.startsWith('--batch-size=')) {
      const n = Number(arg.split('=')[1]);
      if (Number.isFinite(n) && n > 0) opts.batchSize = Math.floor(n);
    }
  }

  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const studentIds = await resolveRebuildStudentIds({
    scope: opts.scope,
    semesterId: opts.semesterId,
    studentIds: opts.studentIds,
  });

  console.log('[lj:rebuild-analytics] options:', {
    scope: opts.scope,
    semesterId: opts.semesterId,
    batchSize: opts.batchSize,
    dryRun: opts.dryRun,
    studentCount: studentIds.length,
  });

  if (opts.dryRun) {
    console.log('[lj:rebuild-analytics] dry-run 完成，未寫入資料庫。');
    process.exit(0);
  }

  const startedAt = Date.now();
  const result = await rebuildAnalyticsInBatches({
    scope: opts.scope,
    semesterId: opts.semesterId,
    studentIds: opts.studentIds.length ? opts.studentIds : undefined,
    batchSize: opts.batchSize,
    onBatch: (progress) => {
      console.log(
        `[lj:rebuild-analytics] batch ${progress.completedBatches}/${progress.batchCount}`
        + ` students=${progress.totalStudents}`
      );
    },
  });

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log('[lj:rebuild-analytics] done', {
    elapsedSec,
    snapshotVersion: result.snapshotVersion,
    totalStudents: result.totalStudents,
    eventCount: result.eventCount,
    analyticStudentCount: result.analyticStudentCount,
    analyticExamCount: result.analyticExamCount,
    errors: result.progress?.errors?.length || 0,
  });
  process.exit(0);
}

main().catch((err) => {
  const sqlMessage = err?.original?.sqlMessage || err?.parent?.sqlMessage;
  const message = sqlMessage || err?.message || String(err);
  console.error('[lj:rebuild-analytics] failed:', message);
  if (sqlMessage && /Unknown column/i.test(sqlMessage)) {
    console.error('[lj:rebuild-analytics] 資料表欄位與程式不一致，請先執行：npx sequelize-cli db:migrate');
  }
  if (process.env.DEBUG) {
    console.error(err?.stack || err);
  }
  process.exit(1);
});
