'use strict';

/**
 * ET 分組 GSE 快照重算（CAPS → GSE 遷移後維運腳本）
 *
 * 1. 將 et_event_group_assignments.gse_snapshot 清空
 * 2. 依 lj_analytic_students 透過 etGseSnapshotService 重算並回寫
 *
 * 注意：learning_growth_episodes 的 GSE 成長欄位須另執行 model run 重新產生：
 *   POST /api/admin/learning-analytics/model-runs
 *   或經由後台「學習成效分析 → 模型紀錄」觸發
 *
 * 用法：
 *   npm run lj:recompute-gse-episodes
 *   node scripts/learning-journey-recompute-gse-episodes.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { EtEventGroupAssignment, sequelize } = require('../models');
const { getGseSnapshotsForStudents } = require('../services/etGrouping/etGseSnapshotService');

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') };
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  console.log('[lj:recompute-gse-episodes] start', { dryRun });

  const assignments = await EtEventGroupAssignment.findAll({
    attributes: ['id', 'studentId', 'gseSnapshot', 'cefrSnapshot', 'dataQuality'],
    order: [['id', 'ASC']],
  });

  if (!assignments.length) {
    console.log('[lj:recompute-gse-episodes] 無分組紀錄，結束。');
    process.exit(0);
  }

  const studentIds = [...new Set(assignments.map((row) => String(row.studentId)))];
  const snapshots = await getGseSnapshotsForStudents(studentIds);

  if (dryRun) {
    let wouldUpdate = 0;
    for (const assignment of assignments) {
      const snapshot = snapshots.get(String(assignment.studentId));
      if (!snapshot) continue;
      if (
        assignment.gseSnapshot !== snapshot.gse
        || assignment.cefrSnapshot !== snapshot.cefr
        || assignment.dataQuality !== snapshot.dataQuality
      ) {
        wouldUpdate += 1;
      }
    }
    console.log('[lj:recompute-gse-episodes] dry-run 完成', {
      assignmentCount: assignments.length,
      studentCount: studentIds.length,
      wouldUpdate,
    });
    process.exit(0);
  }

  const transaction = await sequelize.transaction();
  try {
    await EtEventGroupAssignment.update(
      { gseSnapshot: null },
      { where: {}, transaction }
    );

    let updated = 0;
    for (const assignment of assignments) {
      const snapshot = snapshots.get(String(assignment.studentId));
      if (!snapshot) continue;
      await assignment.update({
        gseSnapshot: snapshot.gse,
        cefrSnapshot: snapshot.cefr,
        dataQuality: snapshot.dataQuality,
      }, { transaction });
      updated += 1;
    }

    await transaction.commit();
    console.log('[lj:recompute-gse-episodes] 完成', {
      assignmentCount: assignments.length,
      updated,
    });
    console.log('[lj:recompute-gse-episodes] 請另執行 model run 以重算 learning_growth_episodes。');
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error('[lj:recompute-gse-episodes] 失敗:', error.message);
    process.exit(1);
  }
}

main();
