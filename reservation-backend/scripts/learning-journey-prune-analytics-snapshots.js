'use strict';

/**
 * 清理成效分析舊資料版本（snapshot）
 *
 * 保留：最新 N 個 global-* 全域分析版本（預設 1）
 * 刪除：course-import-*、學期重建版、較舊的 global-* 等
 *
 * 用法：
 *   npm run lj:prune-analytics-snapshots:dry
 *   npm run lj:prune-analytics-snapshots:apply
 *   node scripts/learning-journey-prune-analytics-snapshots.js --keep-global=2 --apply
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pruneAnalyticsSnapshots } = require('../services/learningAnalytics/learningAnalyticsSnapshotGovernanceService');

function parseArgs(argv) {
  const opts = { dryRun: true, keepGlobalCount: 1 };
  for (const arg of argv) {
    if (arg === '--apply' || arg === '--no-dry-run') {
      opts.dryRun = false;
      continue;
    }
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (arg.startsWith('--keep-global=')) {
      const n = Number(arg.split('=')[1]);
      if (Number.isFinite(n) && n > 0) opts.keepGlobalCount = Math.floor(n);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = await pruneAnalyticsSnapshots(opts);

  console.log('[lj:prune-analytics-snapshots]', {
    dryRun: opts.dryRun,
    keepGlobalCount: opts.keepGlobalCount,
    snapshotVersionCount: result.inventory.length,
    keepVersions: result.keepVersions,
    deleteVersions: result.deleteVersions,
    deleteCounts: result.deleteCounts,
    result: result.result,
  });

  if (!opts.dryRun) {
    console.log('[lj:prune-analytics-snapshots] 清理完成。請重新整理成效分析頁面確認「資料版本」。');
  } else if (result.deleteVersions.length) {
    console.log('[lj:prune-analytics-snapshots] 以上為 dry-run；實際刪除請加 --apply 或執行 npm run lj:prune-analytics-snapshots:apply');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[lj:prune-analytics-snapshots] failed:', err.message);
    process.exit(1);
  });
