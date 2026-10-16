'use strict';

const { LjTrackingCohort, LjTrackingCohortMember, sequelize } = require('../../models');
const {
  listStudentExplorerForExport,
  loadCurrentMetricsForStudents,
} = require('./learningAnalyticsStudentExplorerService');
const { examRecordLabel } = require('./learningAnalyticsStudentExplorerExportService');

const PAGE_SIZE_DEFAULT = 40;
const PAGE_SIZE_MAX = 100;
const MEMBER_INSERT_CHUNK = 500;

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function round1(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function hoursDelta(current, baseline) {
  const left = round1(current);
  const right = round1(baseline);
  if (left == null || right == null) return null;
  return round1(left - right);
}

function hasPostTest(label) {
  return label === '後測' || label === '前後測';
}

function mean(values) {
  if (!values.length) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function compareMember(member, current) {
  const baselineExam = member.examLabel || '無';
  const currentExam = current ? examRecordLabel(current) : null;
  const activityHours = current ? round1(current.totalActivityHours) : null;
  const courseHours = current ? round1(current.totalCourseHours) : null;
  return {
    studentId: member.studentId,
    studentName: current?.studentName || member.studentName || null,
    department: current?.department || member.department || null,
    enrollmentCohort: member.enrollmentCohort || current?.cohort || null,
    placementLabel: member.placementLabel || current?.placementLabel || null,
    baseline: {
      examLabel: baselineExam,
      activityHours: round1(member.activityHours),
      courseHours: round1(member.courseHours),
    },
    current: current ? {
      examLabel: currentExam,
      activityHours,
      courseHours,
      placementLabel: current.placementLabel || null,
    } : null,
    delta: {
      activityHours: current ? hoursDelta(activityHours, member.activityHours) : null,
      courseHours: current ? hoursDelta(courseHours, member.courseHours) : null,
      gainedPostTest: Boolean(current && !hasPostTest(baselineExam) && hasPostTest(currentExam)),
    },
    missingFromSnapshot: !current,
  };
}

function summarizeComparisons(rows) {
  const activityDeltas = rows.map((row) => row.delta.activityHours).filter((value) => value != null);
  const courseDeltas = rows.map((row) => row.delta.courseHours).filter((value) => value != null);
  return {
    memberCount: rows.length,
    stillTracked: rows.filter((row) => !row.missingFromSnapshot).length,
    missingFromSnapshot: rows.filter((row) => row.missingFromSnapshot).length,
    gainedPostTest: rows.filter((row) => row.delta.gainedPostTest).length,
    activityHoursUp: activityDeltas.filter((value) => value > 0).length,
    courseHoursUp: courseDeltas.filter((value) => value > 0).length,
    averageActivityDelta: mean(activityDeltas),
    averageCourseDelta: mean(courseDeltas),
  };
}

function parsePage(query = {}) {
  const limitRaw = Number(query.limit);
  const offsetRaw = Number(query.offset);
  const limit = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : PAGE_SIZE_DEFAULT),
  );
  const offset = Math.max(0, Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0);
  return { limit, offset };
}

function presentCohort(row) {
  return {
    id: Number(row.id),
    name: row.name,
    filters: row.filtersJson || {},
    snapshotVersion: row.snapshotVersion || null,
    memberCount: Number(row.memberCount) || 0,
    sourceTotal: Number(row.sourceTotal) || 0,
    truncated: !!row.truncated,
    createdByName: row.createdByName || null,
    createdAt: row.createdAt,
  };
}

async function createTrackingCohort({ name, query = {}, user = {} } = {}) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw httpError('請填追蹤名單名稱。', 400);
  if (trimmed.length > 80) throw httpError('名單名稱最多 80 字。', 400);

  const listed = await listStudentExplorerForExport(query);
  if (!listed.items.length) throw httpError('這個條件下沒有學生可儲存。', 400);

  const members = listed.items.map((item) => ({
    studentId: item.studentId,
    studentName: item.studentName || null,
    department: item.department || null,
    enrollmentCohort: item.cohort || null,
    placementLabel: item.placementLabel || null,
    examLabel: examRecordLabel(item),
    activityHours: item.totalActivityHours,
    courseHours: item.totalCourseHours,
  }));

  const cohort = await sequelize.transaction(async (transaction) => {
    const created = await LjTrackingCohort.create({
      name: trimmed,
      filtersJson: listed.appliedFilters || {},
      snapshotVersion: listed.snapshotVersion || null,
      memberCount: members.length,
      sourceTotal: listed.total,
      truncated: !!listed.truncated,
      createdBy: user.id || null,
      createdByName: user.name || user.user || null,
    }, { transaction });

    for (let index = 0; index < members.length; index += MEMBER_INSERT_CHUNK) {
      await LjTrackingCohortMember.bulkCreate(
        members.slice(index, index + MEMBER_INSERT_CHUNK).map((member) => ({
          ...member,
          cohortId: created.id,
        })),
        { transaction },
      );
    }
    return created;
  });

  return {
    ...presentCohort(cohort),
    truncated: !!listed.truncated,
    maxRows: listed.maxRows,
  };
}

async function listTrackingCohorts() {
  const rows = await LjTrackingCohort.findAll({
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
  });
  return { items: rows.map(presentCohort) };
}

async function getTrackingCohort(id, query = {}) {
  const cohort = await LjTrackingCohort.findByPk(id);
  if (!cohort) throw httpError('找不到追蹤名單。', 404);
  const members = await LjTrackingCohortMember.findAll({
    where: { cohortId: cohort.id },
    order: [['studentId', 'ASC']],
  });
  const { snapshotVersion, byId } = await loadCurrentMetricsForStudents(members.map((member) => member.studentId));
  const compared = members.map((member) => compareMember(member, byId.get(String(member.studentId).toUpperCase())));
  const { limit, offset } = parsePage(query);
  return {
    cohort: presentCohort(cohort),
    currentSnapshotVersion: snapshotVersion,
    summary: summarizeComparisons(compared),
    items: compared.slice(offset, offset + limit),
    pagination: {
      limit,
      offset,
      total: compared.length,
      returned: Math.min(limit, Math.max(0, compared.length - offset)),
    },
  };
}

async function deleteTrackingCohort(id) {
  const cohort = await LjTrackingCohort.findByPk(id);
  if (!cohort) throw httpError('找不到追蹤名單。', 404);
  await cohort.destroy();
  return { id: Number(cohort.id), deleted: true };
}

module.exports = {
  compareMember,
  summarizeComparisons,
  createTrackingCohort,
  listTrackingCohorts,
  getTrackingCohort,
  deleteTrackingCohort,
};
