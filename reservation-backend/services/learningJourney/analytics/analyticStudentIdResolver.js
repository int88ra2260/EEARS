'use strict';

const {
  EtExamAttempt,
  ActivityParticipation,
  CourseEnrollment,
  EtEnrollmentSnapshot,
} = require('../../../models');
const { normSid } = require('./eventProjectorService');

async function resolveGlobalStudentIds() {
  const [fromExams, fromActivities, fromCourses] = await Promise.all([
    EtExamAttempt.findAll({ attributes: ['studentId'], group: ['studentId'], raw: true }),
    ActivityParticipation.findAll({ attributes: ['studentId'], group: ['studentId'], raw: true }),
    CourseEnrollment.findAll({ attributes: ['studentId'], group: ['studentId'], raw: true }),
  ]);
  const set = new Set([
    ...fromExams.map((r) => normSid(r.studentId)),
    ...fromActivities.map((r) => normSid(r.studentId)),
    ...fromCourses.map((r) => normSid(r.studentId)),
  ]);
  return [...set].filter(Boolean).sort();
}

async function resolveSemesterStudentIds(semesterId) {
  const sid = String(semesterId || '').trim();
  if (!sid) return [];
  const rows = await EtEnrollmentSnapshot.findAll({
    where: { semesterId: sid, isActive: true },
    attributes: ['studentId'],
    raw: true,
  });
  return [...new Set(rows.map((r) => normSid(r.studentId)).filter(Boolean))].sort();
}

/**
 * @param {{ scope?: string, semesterId?: string, studentIds?: string[] }} opts
 */
async function resolveRebuildStudentIds(opts = {}) {
  const explicit = (opts.studentIds || []).map(normSid).filter(Boolean);
  if (explicit.length) return [...new Set(explicit)].sort();

  const scope = String(opts.scope || 'global').trim().toLowerCase();
  if (scope === 'semester' || opts.semesterId) {
    return resolveSemesterStudentIds(opts.semesterId);
  }

  return resolveGlobalStudentIds();
}

module.exports = {
  resolveRebuildStudentIds,
  resolveGlobalStudentIds,
  resolveSemesterStudentIds,
};
