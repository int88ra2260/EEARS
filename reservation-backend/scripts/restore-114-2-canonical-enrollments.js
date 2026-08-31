'use strict';

/**
 * 114-2 修課僅保留 eeears115 標準匯入批次，移除 dedupe 自 legacy 併入的紀錄。
 *
 * 用法：
 *   node scripts/restore-114-2-canonical-enrollments.js --dry-run
 *   node scripts/restore-114-2-canonical-enrollments.js --apply
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sequelize } = require('../models');
const { rebuildAnalyticsInBatches } = require('../services/learningJourney/analytics/analyticRebuildService');

const SEMESTER_ID = '114-2';
const CANONICAL_SOURCE_PREFIX = 'course_import:eeears115-courses:';

function parseArgs() {
  return { apply: process.argv.includes('--apply') };
}

async function countBySource() {
  return sequelize.query(
    `SELECT ce.source_ref AS sourceRef, COUNT(*) AS n
     FROM course_enrollments ce
     JOIN courses c ON c.id = ce.course_id
     WHERE c.semester_id = :semesterId
     GROUP BY ce.source_ref
     ORDER BY n DESC`,
    { replacements: { semesterId: SEMESTER_ID }, type: sequelize.QueryTypes.SELECT }
  );
}

async function findRowsToRemove() {
  return sequelize.query(
    `SELECT ce.id, ce.student_id AS studentId, ce.source_ref AS sourceRef, c.course_code AS courseCode
     FROM course_enrollments ce
     JOIN courses c ON c.id = ce.course_id
     WHERE c.semester_id = :semesterId
       AND (ce.source_ref IS NULL OR ce.source_ref NOT LIKE :canonicalLike)`,
    {
      replacements: {
        semesterId: SEMESTER_ID,
        canonicalLike: `${CANONICAL_SOURCE_PREFIX}%${SEMESTER_ID}%`,
      },
      type: sequelize.QueryTypes.SELECT,
    }
  );
}

async function main() {
  const { apply } = parseArgs();
  console.log(`[info] semester=${SEMESTER_ID} mode=${apply ? 'apply' : 'dry-run'}`);

  const before = await countBySource();
  console.log('\n=== 目前 source_ref 分佈 ===');
  console.log(before);

  const toRemove = await findRowsToRemove();
  console.log(`\n=== 將移除 ${toRemove.length} 筆非標準匯入修課 ===`);

  if (!toRemove.length) {
    console.log('無需變更。');
    await sequelize.close();
    return;
  }

  const sample = toRemove.slice(0, 5).map((r) => ({
    id: r.id,
    studentId: r.studentId,
    courseCode: r.courseCode,
    sourceRef: r.sourceRef,
  }));
  console.log('sample', sample);

  if (apply) {
    const ids = toRemove.map((r) => r.id);
    const chunkSize = 500;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await sequelize.query(
        'DELETE FROM course_enrollments WHERE id IN (:ids)',
        { replacements: { ids: chunk } }
      );
      deleted += chunk.length;
    }
    console.log(`\n[info] 已刪除 ${deleted} 筆`);

    const after = await countBySource();
    console.log('\n=== 刪除後 source_ref 分佈 ===');
    console.log(after);

    console.log('\n[info] global analytics rebuild…');
    const rebuild = await rebuildAnalyticsInBatches({
      scope: 'global',
      batchSize: 100,
      dryRun: false,
    });
    console.log(JSON.stringify({
      totalStudents: rebuild.totalStudents,
      eventCount: rebuild.eventCount,
      analyticStudentCount: rebuild.analyticStudentCount,
    }, null, 2));
  }

  await sequelize.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
