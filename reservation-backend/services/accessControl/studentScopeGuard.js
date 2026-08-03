'use strict';

const { Op } = require('sequelize');
const { Class, ClassMembership, ClassTeacher } = require('../../models');
const { buildAccessProfile } = require('../../auth/accessProfile');
const { P } = require('../../auth/permissions');
const { assertCanAccessClass } = require('./classScopeGuard');
const {
  isExecutiveProfile,
  isOwnClassScopedTeacherProfile,
} = require('./teacherOwnClassScope');

function norm(v) {
  return String(v || '').trim();
}

function normSid(v) {
  return norm(v).toUpperCase();
}

function denied(code = 'STUDENT_SCOPE_DENIED', message = '您沒有存取此學生資料的權限。') {
  return { allowed: false, code, message };
}

function buildSemesterFilter(options = {}) {
  const semester = norm(options.semester || options.semesterId);
  return semester ? { semester } : {};
}

async function getTeacherClassIds(user, options = {}) {
  const semesterWhere = buildSemesterFilter(options);
  const classIds = new Set();

  const teacherId = Number(user?.id);
  if (Number.isInteger(teacherId)) {
    const mappings = await ClassTeacher.findAll({
      where: { teacherId, isActive: true, ...semesterWhere },
      attributes: ['classId'],
    });
    for (const row of mappings || []) {
      const id = Number(row.classId);
      if (Number.isInteger(id)) classIds.add(id);
    }
  }

  const teacherName = norm(user?.name);
  if (teacherName) {
    const classes = await Class.findAll({
      where: { teacherName, ...semesterWhere },
      attributes: ['id'],
    });
    for (const row of classes || []) {
      const id = Number(row.id);
      if (Number.isInteger(id)) classIds.add(id);
    }
  }

  return [...classIds];
}

async function getAllowedStudentIds(user, options = {}) {
  const profile = buildAccessProfile(user);
  if (profile.isAdmin || isExecutiveProfile(profile)) {
    return { allowed: true, unrestricted: true, allowedStudentIds: null };
  }

  if (
    profile.isOfficeStaff
    && (
      profile.permissionSet.has(P.CAN_MANAGE_ENGLISH_TEST_TRACKING)
      || profile.permissionSet.has(P.CAN_VIEW_ENGLISH_TEST_TRACKING)
    )
  ) {
    return { allowed: true, unrestricted: true, allowedStudentIds: null };
  }

  if (!isOwnClassScopedTeacherProfile(profile)) {
    return denied('DATA_SCOPE_DENIED', '此操作需要指定班級或學生資料來源。');
  }

  let classIds = [];
  if (options.classId) {
    const classRecord = await Class.findByPk(options.classId);
    if (!classRecord) return denied('MISSING_CLASS_CONTEXT', '此操作需要指定班級或學生資料來源。');
    const classAccess = await assertCanAccessClass(user, classRecord)
      .then(() => true)
      .catch(() => false);
    if (!classAccess) return denied('CLASS_SCOPE_DENIED', '您沒有存取此班級學生資料的權限。');
    classIds = [Number(options.classId)];
  } else {
    classIds = await getTeacherClassIds(user, options);
  }

  if (!classIds.length) {
    return { allowed: true, unrestricted: false, allowedStudentIds: [] };
  }

  const where = { classId: { [Op.in]: classIds } };
  const semester = norm(options.semester || options.semesterId);
  if (semester) where.semester = semester;

  const rows = await ClassMembership.findAll({
    where,
    attributes: ['studentId'],
  });
  const allowedStudentIds = [...new Set((rows || []).map((row) => normSid(row.studentId)).filter(Boolean))];
  return { allowed: true, unrestricted: false, allowedStudentIds };
}

async function canAccessStudentById(user, studentId, options = {}) {
  const sid = normSid(studentId);
  if (!sid) return denied('MISSING_STUDENT_CONTEXT', '此操作需要指定班級或學生資料來源。');

  const scope = await getAllowedStudentIds(user, options);
  if (!scope.allowed) return scope;
  if (scope.unrestricted) return { allowed: true, scope: 'all' };
  if ((scope.allowedStudentIds || []).includes(sid)) {
    return { allowed: true, scope: 'own_class_student' };
  }
  return denied();
}

async function assertCanAccessStudent(user, studentId, options = {}) {
  const result = await canAccessStudentById(user, studentId, options);
  if (result.allowed) return result;

  const err = new Error(result.message || '您沒有存取此學生資料的權限。');
  err.status = 403;
  err.code = result.code || 'STUDENT_SCOPE_DENIED';
  throw err;
}

async function buildStudentScopeWhere(user, options = {}) {
  const scope = await getAllowedStudentIds(user, options);
  if (!scope.allowed) return null;
  if (scope.unrestricted) return {};
  return { studentId: { [Op.in]: scope.allowedStudentIds || [] } };
}

async function canAccessClassStudent(user, classId, studentId, options = {}) {
  const sid = normSid(studentId);
  const classRecord = await Class.findByPk(classId);
  if (!classRecord) return denied('MISSING_CLASS_CONTEXT', '此操作需要指定班級或學生資料來源。');
  try {
    await assertCanAccessClass(user, classRecord);
  } catch (_) {
    return denied('CLASS_SCOPE_DENIED', '您沒有存取此班級學生資料的權限。');
  }

  const where = { classId, studentId: sid };
  const semester = norm(options.semester || options.semesterId || classRecord.semester);
  if (semester) where.semester = semester;
  const member = await ClassMembership.findOne({ where, attributes: ['id'] });
  return member ? { allowed: true, scope: 'class_student' } : denied();
}

function sendStudentScopeDenied(res, err) {
  return res.status(err.status || 403).json({
    success: false,
    errorCode: err.code || 'STUDENT_SCOPE_DENIED',
    message: err.message || '您沒有存取此學生資料的權限。',
    requestId: err.requestId || undefined,
  });
}

module.exports = {
  canAccessStudentById,
  assertCanAccessStudent,
  buildStudentScopeWhere,
  canAccessClassStudent,
  getAllowedStudentIds,
  sendStudentScopeDenied,
};
