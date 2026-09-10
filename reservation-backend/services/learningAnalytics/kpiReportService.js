'use strict';

const { Op } = require('sequelize');
const { EtEnrollmentSnapshot, EtExamAttempt, EtExamAttemptSkillScore } = require('../../models');
const { getKpiPolicyById, getKpiPolicyByKey } = require('./kpiPolicyService');
const { evaluateKpiPolicy } = require('./kpiPolicyEngine');
const {
  normalizeGradeFilter,
  gradeMatchesFilter,
  parseGradeNumber,
} = require('./kpiPopulationUtils');

function normalizeStudentId(value) {
  return String(value || '').trim().toUpperCase();
}

async function resolvePolicy(ref) {
  if (ref == null || ref === '') {
    const err = new Error('請指定 policyId 或 policyKey');
    err.status = 400;
    throw err;
  }
  if (typeof ref === 'number' || /^\d+$/.test(String(ref))) {
    const byId = await getKpiPolicyById(Number(ref));
    if (!byId) {
      const err = new Error('找不到政策');
      err.status = 404;
      throw err;
    }
    return byId;
  }
  const byKey = await getKpiPolicyByKey(String(ref));
  if (!byKey) {
    const err = new Error('找不到政策');
    err.status = 404;
    throw err;
  }
  return byKey;
}

/**
 * 依學期名冊抓分母；年級以該學期 snapshot.grade 為準。
 */
async function loadRosterStudents(semesterId, population = {}) {
  const sem = String(semesterId || '').trim();
  if (!sem) {
    const err = new Error('semesterId 必填（名冊分母）');
    err.status = 400;
    throw err;
  }
  const gradeFilter = normalizeGradeFilter(population);
  const snapshots = await EtEnrollmentSnapshot.findAll({
    where: { semesterId: sem, isActive: true },
    attributes: ['studentId', 'grade', 'department', 'college'],
  });

  const students = [];
  const seen = new Set();
  let rosterTotal = 0;
  let excludedByGrade = 0;
  let excludedMissingGrade = 0;

  for (const snap of snapshots) {
    const sid = normalizeStudentId(snap.studentId);
    if (!sid || seen.has(sid)) continue;
    seen.add(sid);
    rosterTotal += 1;

    const gradeRaw = snap.grade;
    const gradeNo = parseGradeNumber(gradeRaw);
    if (gradeFilter.enabled) {
      if (gradeNo == null) {
        excludedMissingGrade += 1;
        continue;
      }
      if (!gradeMatchesFilter(gradeRaw, gradeFilter)) {
        excludedByGrade += 1;
        continue;
      }
    }

    students.push({
      studentId: sid,
      grade: gradeRaw != null ? String(gradeRaw) : null,
      gradeNo,
      department: snap.department || null,
      college: snap.college || null,
    });
  }

  return {
    semesterId: sem,
    students,
    studentIds: students.map((s) => s.studentId),
    gradeFilter,
    rosterStats: {
      rosterTotal,
      included: students.length,
      excludedByGrade,
      excludedMissingGrade,
    },
  };
}

async function loadRosterStudentIds(semesterId, population) {
  const loaded = await loadRosterStudents(semesterId, population);
  return { semesterId: loaded.semesterId, studentIds: loaded.studentIds };
}

async function loadAttemptsForStudents(studentIds, status = 'valid') {
  if (!studentIds.length) return new Map();
  const attempts = await EtExamAttempt.findAll({
    where: {
      studentId: { [Op.in]: studentIds },
      status: status || 'valid',
    },
    include: [{ model: EtExamAttemptSkillScore, as: 'skillScores', required: false }],
    order: [['testDate', 'ASC'], ['id', 'ASC']],
  });

  const map = new Map();
  for (const sid of studentIds) map.set(sid, []);
  for (const att of attempts) {
    const sid = normalizeStudentId(att.studentId);
    if (!map.has(sid)) map.set(sid, []);
    map.get(sid).push(att);
  }
  return map;
}

async function runKpiReport(input = {}) {
  const policy = await resolvePolicy(input.policyId != null ? input.policyId : input.policyKey);
  if (policy.isArchived) {
    const err = new Error('政策已封存，無法執行報表');
    err.status = 400;
    throw err;
  }

  const population = policy.definition?.population || {};
  const loaded = await loadRosterStudents(input.semesterId, population);
  const status = policy.definition?.evidence?.status || 'valid';
  const attemptMap = await loadAttemptsForStudents(loaded.studentIds, status);

  const studentAttempts = loaded.students.map((student) => ({
    studentId: student.studentId,
    attempts: attemptMap.get(student.studentId) || [],
  }));

  const evaluated = evaluateKpiPolicy(policy.definition, studentAttempts, {
    academicYear: input.academicYear || policy.academicYear || policy.definition?.academicYearLabel,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  const includeRows = input.includeRows !== false;
  const generatedAt = new Date().toISOString();
  const rosterById = new Map(loaded.students.map((s) => [s.studentId, s]));

  const rows = includeRows
    ? (evaluated.rows || []).map((row) => {
      const roster = rosterById.get(row.studentId);
      return {
        ...row,
        grade: roster?.grade ?? null,
        gradeNo: roster?.gradeNo ?? null,
        department: roster?.department ?? null,
      };
    })
    : undefined;

  return {
    generatedAt,
    policy: {
      id: policy.id,
      policyKey: policy.policyKey,
      name: policy.name,
      academicYear: policy.academicYear,
      description: policy.description,
      notes: policy.definition?.notes || [],
      includeSkillBreakdown: policy.definition?.includeSkillBreakdown === true,
    },
    population: {
      semesterId: loaded.semesterId,
      totalStudents: evaluated.totalStudents,
      gradeFilter: loaded.gradeFilter,
      rosterStats: loaded.rosterStats,
      source: 'et_enrollment_snapshots.grade',
      note: '年級以選定學期在學名冊的 grade 為準（每年／每學期名冊各自計算）。',
    },
    evidenceWindow: evaluated.evidenceWindow,
    summary: {
      dimensions: evaluated.dimensions,
      skillBreakdown: evaluated.skillBreakdown,
    },
    rows,
    definitionSnapshot: policy.definition,
  };
}

module.exports = {
  runKpiReport,
  resolvePolicy,
  loadRosterStudentIds,
  loadRosterStudents,
};
