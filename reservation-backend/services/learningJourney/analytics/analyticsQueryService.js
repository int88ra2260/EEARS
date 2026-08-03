'use strict';

const { Op } = require('sequelize');
const { LjAnalyticStudent, LjAnalyticExam, LjStudentEvent } = require('../../../models');
const { resolveLatestSnapshotVersion } = require('./timelineReadService');
const {
  buildStudentWhere,
  buildExamWhere,
  applyEvidenceQualityFilter,
  parseBool,
  parseList,
} = require('../../learningAnalytics/learningAnalyticsFilterUtils');

async function resolveScopedStudentIds(query = {}) {
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const where = buildStudentWhere(query, snapshotVersion);
  const rows = await LjAnalyticStudent.findAll({ where, attributes: ['studentId'] });
  const filtered = applyEvidenceQualityFilter(rows, query);
  return {
    snapshotVersion,
    studentIds: filtered.map((row) => row.studentId),
  };
}

async function queryAnalyticStudents(query = {}) {
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const where = buildStudentWhere(query, snapshotVersion);

  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 500);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const sortBy = String(query.sortBy || query.sort_by || 'studentId');
  const sortOrder = String(query.sortOrder || query.sort_order || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const allowedSort = new Set([
    'studentId', 'cohort', 'department', 'exposureLevel', 'examCount', 'isB2plus', 'retestFlag',
  ]);
  const orderField = allowedSort.has(sortBy) ? sortBy : 'studentId';

  const rows = await LjAnalyticStudent.findAll({
    where,
    order: [[orderField, sortOrder]],
  });
  const filtered = applyEvidenceQualityFilter(rows, query);
  const items = filtered.slice(offset, offset + limit).map((r) => r.toJSON());

  return {
    snapshotVersion,
    total: filtered.length,
    limit,
    offset,
    items,
  };
}

async function queryAnalyticExams(query = {}) {
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const where = buildExamWhere(query, snapshotVersion);
  if (query.exam_seq) where.examSeq = Number(query.exam_seq);
  const b2 = parseBool(query.is_b2plus);
  if (b2 !== undefined) where.isB2plus = b2;
  if (query.course_hours_before_exam_min != null) {
    where.courseHoursBeforeExam = { ...(where.courseHoursBeforeExam || {}), [Op.gte]: Number(query.course_hours_before_exam_min) };
  }
  if (query.course_hours_before_exam_max != null) {
    where.courseHoursBeforeExam = { ...(where.courseHoursBeforeExam || {}), [Op.lte]: Number(query.course_hours_before_exam_max) };
  }
  if (query.activity_hours_before_exam_min != null) {
    where.activityHoursBeforeExam = { ...(where.activityHoursBeforeExam || {}), [Op.gte]: Number(query.activity_hours_before_exam_min) };
  }
  if (query.activity_hours_before_exam_max != null) {
    where.activityHoursBeforeExam = { ...(where.activityHoursBeforeExam || {}), [Op.lte]: Number(query.activity_hours_before_exam_max) };
  }

  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 500);
  const offset = Math.max(Number(query.offset) || 0, 0);

  const { rows, count } = await LjAnalyticExam.findAndCountAll({
    where,
    limit,
    offset,
    order: [['examDate', 'ASC'], ['studentId', 'ASC'], ['skill', 'ASC']],
  });

  return {
    snapshotVersion,
    total: count,
    limit,
    offset,
    items: rows.map((r) => r.toJSON()),
  };
}

const EVENT_DATASET_TYPES = {
  courses: ['course_event'],
  activities: ['activity_event'],
  events: ['course_event', 'activity_event'],
};

async function queryAnalyticEvents(query = {}) {
  const dataset = String(query.dataset || 'events').toLowerCase();
  const eventTypes = EVENT_DATASET_TYPES[dataset] || EVENT_DATASET_TYPES.events;
  const { snapshotVersion, studentIds } = await resolveScopedStudentIds(query);

  const where = {
    eventType: { [Op.in]: eventTypes },
    status: { [Op.in]: ['valid', 'registered_no_score'] },
  };
  if (studentIds.length) {
    where.studentId = { [Op.in]: studentIds };
  } else {
    where.studentId = '__none__';
  }

  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 500);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const sortBy = String(query.sortBy || query.sort_by || 'eventDate');
  const sortOrder = String(query.sortOrder || query.sort_order || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const allowedSort = new Set(['studentId', 'eventDate', 'eventType', 'hours', 'title']);
  const orderField = allowedSort.has(sortBy) ? sortBy : 'eventDate';

  const { rows, count } = await LjStudentEvent.findAndCountAll({
    where,
    limit,
    offset,
    order: [[orderField, sortOrder], ['studentId', 'ASC'], ['id', 'ASC']],
  });

  return {
    snapshotVersion,
    dataset,
    total: count,
    limit,
    offset,
    items: rows.map((r) => r.toJSON()),
  };
}

module.exports = {
  queryAnalyticStudents,
  queryAnalyticExams,
  queryAnalyticEvents,
};
