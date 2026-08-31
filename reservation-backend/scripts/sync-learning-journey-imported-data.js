'use strict';

/**
 * 將 baseline / 英檢 / 修課等已匯入資料投影至英語學習歷程中心（lj_student_events + lj_analytic_*）
 *
 * 用法：
 *   node scripts/sync-learning-journey-imported-data.js --dry-run
 *   node scripts/sync-learning-journey-imported-data.js --apply
 *   node scripts/sync-learning-journey-imported-data.js --apply --skip-activities
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sequelize } = require('../models');
const { runSync, normalizeSections } = require('../services/learningJourney/syncService');
const { rebuildAnalyticsInBatches } = require('../services/learningJourney/analytics/analyticRebuildService');
const { resolveGlobalStudentIds } = require('../services/learningJourney/analytics/analyticStudentIdResolver');

const COURSE_SEMESTERS = ['112-1', '112-2', '113-1', '113-2', '114-1', '114-2'];

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    apply: argv.includes('--apply'),
    skipActivities: argv.includes('--skip-activities'),
  };
}

async function resolveAllLearningJourneyStudentIds() {
  return resolveGlobalStudentIds();
}

async function countLjSummary() {
  const [events, courses, baseline, exams, analytic] = await Promise.all([
    sequelize.query(
      `SELECT event_type AS eventType, COUNT(*) AS n FROM lj_student_events GROUP BY event_type`,
      { type: sequelize.QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT COUNT(*) AS n FROM lj_student_events WHERE event_type = 'course_event'`,
      { type: sequelize.QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT COUNT(*) AS n FROM lj_student_events WHERE event_type = 'baseline_score'`,
      { type: sequelize.QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT COUNT(*) AS n FROM lj_student_events WHERE event_type = 'exam_event'`,
      { type: sequelize.QueryTypes.SELECT }
    ),
    sequelize.query(
      'SELECT COUNT(*) AS n FROM lj_analytic_students',
      { type: sequelize.QueryTypes.SELECT }
    ),
  ]);
  return {
    eventsByType: events,
    courseEvents: Number(courses[0]?.n || 0),
    baselineEvents: Number(baseline[0]?.n || 0),
    examEvents: Number(exams[0]?.n || 0),
    analyticStudents: Number(analytic[0]?.n || 0),
  };
}

function printSection(title, data) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const args = parseArgs();
  const dryRun = !args.apply;
  console.log(`[info] sync learning-journey imported data mode=${dryRun ? 'dry-run' : 'apply'}`);

  printSection('同步前摘要', await countLjSummary());

  const activityResults = {};
  if (!args.skipActivities) {
    const sections = normalizeSections(['activities']);
    for (const semesterId of COURSE_SEMESTERS) {
      activityResults[semesterId] = await runSync({
        semesterId,
        sections,
        dryRun,
      });
      const r = activityResults[semesterId]?.results?.activities || {};
      console.log(`[activities] ${semesterId}: inserted=${r.inserted || 0} updated=${r.updated || 0} skipped=${r.skipped || 0}`);
    }
  }

  const studentIds = await resolveAllLearningJourneyStudentIds();
  console.log(`\n[info] 將投影/重建 ${studentIds.length} 位學生`);

  if (dryRun) {
    printSection('dry-run 完成', {
      studentCount: studentIds.length,
      courseSemesters: COURSE_SEMESTERS,
      skipActivities: args.skipActivities,
      activityResults,
    });
    await sequelize.close();
    return;
  }

  const rebuild = await rebuildAnalyticsInBatches({
    scope: 'global',
    studentIds,
    batchSize: 100,
    continueOnError: false,
    onBatch: (progress) => {
      console.log(`[rebuild] batch ${progress.completedBatches}/${progress.batchCount}`);
    },
  });

  printSection('投影/重建結果', {
    snapshotVersion: rebuild.snapshotVersion,
    totalStudents: rebuild.totalStudents,
    eventCount: rebuild.eventCount,
    analyticStudentCount: rebuild.analyticStudentCount,
    analyticExamCount: rebuild.analyticExamCount,
    projectResult: rebuild.projectResult,
    errors: rebuild.progress?.errors || [],
  });

  printSection('同步後摘要', await countLjSummary());

  await sequelize.close();
  console.log('\nDone.');
}

main().catch(async (err) => {
  console.error(err);
  try {
    await sequelize.close();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
