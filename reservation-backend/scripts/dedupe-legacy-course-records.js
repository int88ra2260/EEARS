'use strict';

/**
 * 合併 113-2 / 114-2 等學期中「工作表*」舊課號課程至標準課號，並刪除 legacy courses。
 *
 * 用法：
 *   node scripts/dedupe-legacy-course-records.js --dry-run
 *   node scripts/dedupe-legacy-course-records.js --apply
 *   node scripts/dedupe-legacy-course-records.js --apply --semester 113-2
 *   node scripts/dedupe-legacy-course-records.js --apply --keep-unmatched
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Op } = require('sequelize');
const { sequelize, Course, CourseEnrollment } = require('../models');
const {
  normalizeCourseKey,
  isLegacyCourseCode,
} = require('../services/learningJourney/legacyCourseDedupUtils');
const { rebuildAnalyticsInBatches } = require('../services/learningJourney/analytics/analyticRebuildService');

const DEFAULT_SEMESTERS = ['113-2', '114-2'];

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = {
    dryRun: !argv.includes('--apply'),
    semesters: [...DEFAULT_SEMESTERS],
    purgeUnmatched: !argv.includes('--keep-unmatched'),
  };
  const semIdx = argv.indexOf('--semester');
  if (semIdx >= 0 && argv[semIdx + 1]) {
    args.semesters = [String(argv[semIdx + 1]).trim()];
  }
  return args;
}

async function loadSemesterCourses(semesterId) {
  const courses = await Course.findAll({
    where: { semesterId },
    order: [['courseCode', 'ASC']],
  });
  const legacyCourses = [];
  const canonicalCourses = [];
  for (const course of courses) {
    if (isLegacyCourseCode(course.courseCode)) legacyCourses.push(course);
    else canonicalCourses.push(course);
  }
  const canonicalByKey = new Map();
  for (const course of canonicalCourses) {
    canonicalByKey.set(normalizeCourseKey(course.courseName, course.instructorName), course);
  }
  return { legacyCourses, canonicalCourses, canonicalByKey };
}

async function loadEnrollmentsByCourseId(courseIds) {
  if (!courseIds.length) return new Map();
  const rows = await CourseEnrollment.findAll({
    where: { courseId: { [Op.in]: courseIds } },
    order: [['id', 'ASC']],
  });
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.courseId)) map.set(row.courseId, []);
    map.get(row.courseId).push(row);
  }
  return map;
}

function buildEnrollmentIndex(enrollments) {
  const byCourseStudent = new Map();
  for (const row of enrollments) {
    byCourseStudent.set(`${row.courseId}::${row.studentId}`, row);
  }
  return byCourseStudent;
}

async function dedupeSemester(semesterId, dryRun, purgeUnmatched) {
  const summary = {
    semesterId,
    dryRun,
    purgeUnmatched,
    legacyCourses: 0,
    matchedPairs: 0,
    unmatchedLegacyCourses: 0,
    enrollmentsDeletedAsDuplicate: 0,
    enrollmentsMoved: 0,
    legacyCoursesDeleted: 0,
    unmatchedLegacyPurged: 0,
    enrollmentsPurged: 0,
    unmatchedLegacyWithEnrollments: [],
    affectedStudentIds: new Set(),
  };

  const { legacyCourses, canonicalByKey } = await loadSemesterCourses(semesterId);
  summary.legacyCourses = legacyCourses.length;
  if (!legacyCourses.length) return summary;

  const legacyIds = legacyCourses.map((c) => c.id);
  const enrollmentsByCourseId = await loadEnrollmentsByCourseId(legacyIds);
  const allCanonicalIds = [...new Set([...canonicalByKey.values()].map((c) => c.id))];
  const canonicalEnrollments = await CourseEnrollment.findAll({
    where: { courseId: { [Op.in]: allCanonicalIds } },
  });
  const enrollmentIndex = buildEnrollmentIndex(canonicalEnrollments);

  const matched = [];
  const unmatched = [];
  for (const legacy of legacyCourses) {
    const key = normalizeCourseKey(legacy.courseName, legacy.instructorName);
    const canonical = canonicalByKey.get(key);
    if (canonical) matched.push({ legacy, canonical });
    else unmatched.push(legacy);
  }
  summary.matchedPairs = matched.length;
  summary.unmatchedLegacyCourses = unmatched.length;

  const run = async (transaction) => {
    for (const { legacy, canonical } of matched) {
      const legacyEnrollments = enrollmentsByCourseId.get(legacy.id) || [];
      for (const enrollment of legacyEnrollments) {
        summary.affectedStudentIds.add(enrollment.studentId);
        const dupKey = `${canonical.id}::${enrollment.studentId}`;
        const existing = enrollmentIndex.get(dupKey);
        if (existing) {
          summary.enrollmentsDeletedAsDuplicate += 1;
          if (!dryRun) {
            await enrollment.destroy({ transaction });
          }
          continue;
        }

        summary.enrollmentsMoved += 1;
        if (!dryRun) {
          await enrollment.update({
            courseId: canonical.id,
            semesterId: canonical.semesterId,
          }, { transaction });
          enrollmentIndex.set(dupKey, enrollment);
        }
      }

      if (!dryRun) {
        await Course.destroy({ where: { id: legacy.id }, transaction });
      }
      summary.legacyCoursesDeleted += 1;
    }

    for (const legacy of unmatched) {
      const legacyEnrollments = enrollmentsByCourseId.get(legacy.id) || [];
      if (!legacyEnrollments.length) {
        if (!dryRun) {
          await Course.destroy({ where: { id: legacy.id }, transaction });
        }
        summary.legacyCoursesDeleted += 1;
        continue;
      }

      if (!purgeUnmatched) {
        summary.unmatchedLegacyWithEnrollments.push({
          courseId: legacy.id,
          courseCode: legacy.courseCode,
          courseName: legacy.courseName,
          instructorName: legacy.instructorName,
          enrollmentCount: legacyEnrollments.length,
        });
        continue;
      }

      for (const enrollment of legacyEnrollments) {
        summary.affectedStudentIds.add(enrollment.studentId);
        summary.enrollmentsPurged += 1;
        if (!dryRun) {
          await enrollment.destroy({ transaction });
        }
      }
      if (!dryRun) {
        await Course.destroy({ where: { id: legacy.id }, transaction });
      }
      summary.unmatchedLegacyPurged += 1;
      summary.legacyCoursesDeleted += 1;
    }
  };

  if (dryRun) {
    await run(null);
  } else {
    await sequelize.transaction(run);
  }

  summary.affectedStudentIds = [...summary.affectedStudentIds];
  return summary;
}

async function main() {
  const args = parseArgs();
  console.log(`[info] mode=${args.dryRun ? 'dry-run' : 'apply'} semesters=${args.semesters.join(', ')} purgeUnmatched=${args.purgeUnmatched}`);

  const summaries = [];
  const allStudentIds = new Set();

  for (const semesterId of args.semesters) {
    const summary = await dedupeSemester(semesterId, args.dryRun, args.purgeUnmatched);
    summaries.push(summary);
    for (const sid of summary.affectedStudentIds) allStudentIds.add(sid);
    console.log(`\n=== ${semesterId} ===`);
    console.log(JSON.stringify(summary, null, 2));
  }

  const totals = summaries.reduce((acc, s) => {
    acc.legacyCourses += s.legacyCourses;
    acc.matchedPairs += s.matchedPairs;
    acc.unmatchedLegacyCourses += s.unmatchedLegacyCourses;
    acc.enrollmentsDeletedAsDuplicate += s.enrollmentsDeletedAsDuplicate;
    acc.enrollmentsMoved += s.enrollmentsMoved;
    acc.legacyCoursesDeleted += s.legacyCoursesDeleted;
    acc.unmatchedLegacyPurged += s.unmatchedLegacyPurged || 0;
    acc.enrollmentsPurged += s.enrollmentsPurged || 0;
    acc.unmatchedLegacyWithEnrollments.push(...s.unmatchedLegacyWithEnrollments);
    return acc;
  }, {
    legacyCourses: 0,
    matchedPairs: 0,
    unmatchedLegacyCourses: 0,
    enrollmentsDeletedAsDuplicate: 0,
    enrollmentsMoved: 0,
    legacyCoursesDeleted: 0,
    unmatchedLegacyPurged: 0,
    enrollmentsPurged: 0,
    unmatchedLegacyWithEnrollments: [],
  });

  console.log('\n=== 合計 ===');
  console.log(JSON.stringify(totals, null, 2));

  if (!args.dryRun && allStudentIds.size > 0) {
    console.log(`\n[info] global analytics rebuild（${allStudentIds.size} 位學生）…`);
    const rebuild = await rebuildAnalyticsInBatches({
      scope: 'global',
      batchSize: 100,
      dryRun: false,
    });
    console.log(JSON.stringify(rebuild, null, 2));
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
