'use strict';

/**
 * 診斷 LVA「其他課程」(COURSE_OTHER) 來源。
 *
 * 用法：node scripts/diagnose-lva-course-other.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Op } = require('sequelize');
const {
  Course,
  CourseEnrollment,
  LjStudentEvent,
} = require('../models');
const { resourceKeyForEvent } = require('../services/learningJourney/analytics/lvaAnalyticsService');
const { normalizeAcademicCourseResourceType } = require('../services/learningJourney/analytics/academicCourseResourceType');

async function main() {
  const enrollments = await CourseEnrollment.findAll({
    include: [{ model: Course, as: 'course', required: false }],
    attributes: ['id', 'studentId', 'semesterId', 'courseId'],
  });

  const courseOtherEnrollments = [];
  const resourceCounts = new Map();
  const courseTypeNull = new Map();
  const courseTypeUnknown = new Map();
  const titleCounts = new Map();

  for (const row of enrollments) {
    const course = row.course || {};
    const event = {
      eventType: 'course_event',
      title: course.courseName || course.courseCode || '修課',
      subtitle: '',
      sourceSystem: 'course_enrollments',
      rawPayload: {
        courseId: row.courseId,
        courseType: course.courseType || null,
        courseCode: course.courseCode || null,
        resourceType: normalizeAcademicCourseResourceType(course.courseType)
          || normalizeAcademicCourseResourceType(course.courseCode),
      },
    };
    const key = resourceKeyForEvent(event);
    resourceCounts.set(key, (resourceCounts.get(key) || 0) + 1);

    if (key !== 'COURSE_OTHER') continue;

    courseOtherEnrollments.push(row);
    const courseKey = `${row.semesterId}::${course.courseCode || '?'}`;
    const typeLabel = course.courseType || '(null)';
    courseTypeNull.set(typeLabel, (courseTypeNull.get(typeLabel) || 0) + 1);

    const title = `${course.courseName || ''} [${course.courseCode || ''}]`;
    titleCounts.set(title, (titleCounts.get(title) || 0) + 1);

    if (course.courseType && !normalizeAcademicCourseResourceType(course.courseType)) {
      courseTypeUnknown.set(course.courseType, (courseTypeUnknown.get(course.courseType) || 0) + 1);
    }
  }

  const studentSets = new Map();
  for (const row of enrollments) {
    const course = row.course || {};
    const event = {
      eventType: 'course_event',
      title: course.courseName || course.courseCode || '修課',
      rawPayload: {
        courseType: course.courseType || null,
        courseCode: course.courseCode || null,
        resourceType: normalizeAcademicCourseResourceType(course.courseType)
          || normalizeAcademicCourseResourceType(course.courseCode),
      },
    };
    const key = resourceKeyForEvent(event);
    if (!studentSets.has(key)) studentSets.set(key, new Set());
    studentSets.get(key).add(String(row.studentId || '').trim().toUpperCase());
  }

  const events = await LjStudentEvent.findAll({
    where: {
      eventType: 'course_event',
      sourceSystem: 'course_enrollments',
      excludeFlag: false,
    },
    attributes: ['studentId', 'title', 'rawPayload'],
    limit: 50000,
  });

  const eventResourceCounts = new Map();
  const eventPayloadMissing = { noCourseType: 0, noResourceType: 0, total: 0 };
  const eventStudentOther = new Set();

  for (const ev of events) {
    const key = resourceKeyForEvent(ev);
    eventResourceCounts.set(key, (eventResourceCounts.get(key) || 0) + 1);
    if (key === 'COURSE_OTHER') {
      eventStudentOther.add(String(ev.studentId || '').trim().toUpperCase());
    }
    eventPayloadMissing.total += 1;
    const p = ev.rawPayload || {};
    if (!p.courseType) eventPayloadMissing.noCourseType += 1;
    if (!p.resourceType) eventPayloadMissing.noResourceType += 1;
  }

  const coursesWithoutType = await Course.count({ where: { [Op.or]: [{ courseType: null }, { courseType: '' }] } });
  const coursesTotal = await Course.count();

  console.log('=== 修課紀錄依資源類型（enrollment 列數）===');
  [...resourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`${k}: ${v}`));

  console.log('\n=== 修課紀錄依資源類型（不重複學生數）===');
  [...studentSets.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([k, v]) => console.log(`${k}: ${v.size}`));

  console.log('\n=== lj_student_events course_event（excludeFlag=false）===');
  [...eventResourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`${k}: ${v} events`));
  console.log(`COURSE_OTHER 不重複學生: ${eventStudentOther.size}`);
  console.log(`rawPayload 缺 courseType: ${eventPayloadMissing.noCourseType}/${eventPayloadMissing.total}`);
  console.log(`rawPayload 缺 resourceType: ${eventPayloadMissing.noResourceType}/${eventPayloadMissing.total}`);

  console.log(`\n=== courses 表 course_type 為空: ${coursesWithoutType}/${coursesTotal} ===`);

  console.log('\n=== COURSE_OTHER 的 course_type 分布（前 15）===');
  [...courseTypeNull.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([k, v]) => console.log(`${k}: ${v}`));

  if (courseTypeUnknown.size) {
    console.log('\n=== 有 course_type 但無法對應 GE/EAP/ESP（前 15）===');
    [...courseTypeUnknown.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([k, v]) => console.log(`${k}: ${v}`));
  }

  console.log('\n=== COURSE_OTHER 熱門課程（前 20）===');
  [...titleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([k, v]) => console.log(`${v}\t${k}`));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
