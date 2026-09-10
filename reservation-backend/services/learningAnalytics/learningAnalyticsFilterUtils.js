'use strict';

const { Op } = require('sequelize');
const { applyBaselineLevelFilter } = require('./baselineAbilityUtils');

function parseBool(v) {
  if (v === true || v === 'true' || v === '1') return true;
  if (v === false || v === 'false' || v === '0') return false;
  return undefined;
}

function parseList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

function addReasonFilters(where, query, field = 'reasonCodesSummary') {
  const includeReasons = parseList(query.include_reason_code || query.reason_code_include);
  const excludeReasons = parseList(query.exclude_reason_code || query.reason_code_exclude);
  const clauses = [];
  if (includeReasons.length) {
    clauses.push({ [Op.or]: includeReasons.map((code) => ({ [field]: { [Op.like]: `%${code}%` } })) });
  }
  if (excludeReasons.length) {
    for (const code of excludeReasons) {
      clauses.push({ [Op.or]: [{ [field]: null }, { [field]: { [Op.notLike]: `%${code}%` } }] });
    }
  }
  if (clauses.length) where[Op.and] = [...(where[Op.and] || []), ...clauses];
}

function evidenceQualityForStudent(student) {
  const hours = Number(student?.totalResourceHours || 0);
  if (student?.retestFlag && student?.hasValidExam && hours > 0) return 'high';
  if (student?.hasValidExam && student?.baselineEnglishScore != null) return 'medium';
  if (student?.hasValidExam || student?.baselineEnglishScore != null) return 'medium_low';
  return 'low';
}

/**
 * 學年度／入學學期範圍（僅 raw-export 等明確 opt-in 時套用）。
 * - academic_year=115 → cohort=115 OR enrollment_term LIKE 115-%
 * - enrollment_term / semester=114-2 → enrollment_term 精確比對
 * 圖表頁的「學期」刻意不走此邏輯（多數圖表依快照全體）。
 */
function applyEnrollmentScopeToStudentWhere(where, query = {}) {
  const enrollmentTerm = String(query.enrollment_term || query.enrollmentTerm || '').trim();
  const semester = String(query.semester || '').trim();
  const academicYear = String(query.academic_year || query.academicYear || '').trim();

  if (enrollmentTerm) {
    where.enrollmentTerm = enrollmentTerm;
    return where;
  }
  if (semester) {
    where.enrollmentTerm = semester;
    return where;
  }
  if (academicYear) {
    const year = academicYear.replace(/[^0-9]/g, '');
    if (year) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { cohort: year },
            { enrollmentTerm: { [Op.like]: `${year}-%` } },
          ],
        },
      ];
    }
  }
  return where;
}

function buildStudentWhere(query, snapshotVersion, options = {}) {
  const where = { snapshotVersion };
  const scopedStudentId = String(query.student_id || query.studentId || '').trim();
  if (scopedStudentId) where.studentId = scopedStudentId.toUpperCase();
  if (query.cohort) where.cohort = String(query.cohort);
  if (query.college) where.college = String(query.college);
  if (query.department) where.department = String(query.department);
  if (query.admission_type) where.admissionType = String(query.admission_type);
  if (query.exposure_level) where.exposureLevel = String(query.exposure_level);
  // baseline_level 於 applyBaselineLevelFilter 以 CEFR 帶後處理（非 baseline_level 欄位精確比對）
  const overseas = parseBool(query.is_overseas_student);
  if (overseas !== undefined) where.isOverseasStudent = overseas;
  const hasExam = parseBool(query.has_valid_exam);
  if (hasExam !== undefined) where.hasValidExam = hasExam;
  const retest = parseBool(query.retest_flag);
  if (retest !== undefined) where.retestFlag = retest;
  const b2 = parseBool(query.is_b2plus);
  if (b2 !== undefined) where.isB2plus = b2;
  addReasonFilters(where, query);
  if (options.forRawExport) {
    applyEnrollmentScopeToStudentWhere(where, query);
  }
  return where;
}

function applyEvidenceQualityFilter(students, query) {
  let result = students;
  if (query.evidence_quality) {
    const allowed = new Set(parseList(query.evidence_quality));
    result = result.filter((student) => allowed.has(evidenceQualityForStudent(student)));
  }
  return applyBaselineLevelFilter(result, query);
}

function buildExamWhere(query, snapshotVersion, studentIds) {
  const where = { snapshotVersion };
  if (studentIds !== undefined && studentIds !== null) {
    where.studentId = studentIds.length ? { [Op.in]: studentIds } : '__none__';
  }
  if (query.instrument) where.instrument = String(query.instrument).toUpperCase();
  if (query.skill) where.skill = String(query.skill);
  if (query.status) where.status = String(query.status);
  const improved = parseBool(query.improved_flag);
  if (improved !== undefined) where.improvedFlag = improved;
  const exposure = parseBool(query.exposure_before_exam_flag);
  if (exposure !== undefined) where.exposureBeforeExamFlag = exposure;
  const includeReasons = parseList(query.include_reason_code || query.reason_code_include);
  const excludeReasons = parseList(query.exclude_reason_code || query.reason_code_exclude);
  if (includeReasons.length) where.reasonCode = { [Op.in]: includeReasons };
  if (excludeReasons.length) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      { [Op.or]: [{ reasonCode: null }, { reasonCode: { [Op.notIn]: excludeReasons } }] },
    ];
  }
  return where;
}

const QUERY_PARAM_KEYS = [
  'semester',
  'academic_year',
  'academicYear',
  'enrollment_term',
  'enrollmentTerm',
  'snapshot_version',
  'snapshotVersion',
  'student_id',
  'studentId',
  'cohort',
  'college',
  'department',
  'admission_type',
  'exposure_level',
  'baseline_level',
  'is_overseas_student',
  'has_valid_exam',
  'retest_flag',
  'is_b2plus',
  'instrument',
  'skill',
  'status',
  'resource_type',
  'include_reason_code',
  'exclude_reason_code',
  'evidence_quality',
  'matching_caliper',
  'improved_flag',
  'exposure_before_exam_flag',
  'group_by',
  'groupBy',
];

/** 會縮小學生母體的篩選鍵（raw export / exams 預覽用） */
const STUDENT_SCOPE_KEYS = [
  'cohort',
  'college',
  'department',
  'admission_type',
  'baseline_level',
  'exposure_level',
  'is_overseas_student',
  'has_valid_exam',
  'retest_flag',
  'is_b2plus',
  'include_reason_code',
  'exclude_reason_code',
  'reason_code_include',
  'reason_code_exclude',
  'evidence_quality',
  'student_id',
  'studentId',
  'semester',
  'academic_year',
  'academicYear',
  'enrollment_term',
  'enrollmentTerm',
];

function hasStudentScopeFilters(query = {}) {
  return STUDENT_SCOPE_KEYS.some((key) => query[key] != null && query[key] !== '');
}

function stripEmptyQueryParams(query = {}) {
  const out = {};
  for (const key of QUERY_PARAM_KEYS) {
    if (query[key] != null && query[key] !== '') out[key] = query[key];
  }
  if (out.snapshotVersion && !out.snapshot_version) out.snapshot_version = out.snapshotVersion;
  return out;
}

module.exports = {
  parseBool,
  parseList,
  buildStudentWhere,
  buildExamWhere,
  applyEnrollmentScopeToStudentWhere,
  applyEvidenceQualityFilter,
  evidenceQualityForStudent,
  applyBaselineLevelFilter,
  stripEmptyQueryParams,
  hasStudentScopeFilters,
  QUERY_PARAM_KEYS,
  STUDENT_SCOPE_KEYS,
};
