'use strict';

/**
 * 清除 lj_student_events 中已無對應 course_enrollments 的幽靈修課事件。
 *
 * 用法：node scripts/prune-orphan-course-events.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { pruneOrphanedCourseEnrollmentEvents } = require('../services/learningJourney/analytics/eventProjectorService');

async function main() {
  const result = await pruneOrphanedCourseEnrollmentEvents();
  console.log('[lj:prune-orphan-course-events] voided:', result.voided);
  process.exit(0);
}

main().catch((err) => {
  console.error('[lj:prune-orphan-course-events] failed:', err?.message || err);
  process.exit(1);
});
