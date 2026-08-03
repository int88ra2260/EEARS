'use strict';

const { ClassTeacher } = require('../../models');
const { buildAccessProfile } = require('../../auth/accessProfile');
const {
  isExecutiveProfile,
  isOwnClassScopedTeacherProfile,
} = require('./teacherOwnClassScope');

function norm(v) {
  return String(v || '').trim();
}

function normLower(v) {
  return norm(v).toLowerCase();
}

function denied(code = 'CLASS_SCOPE_DENIED', message = '您沒有存取此班級資料的權限。') {
  return { allowed: false, code, message };
}

function isTeacherNameOwner(user, classRecord) {
  const teacherName = normLower(classRecord?.teacherName);
  const userName = normLower(user?.name);
  return Boolean(teacherName && userName && teacherName === userName);
}

async function hasClassTeacherMapping(user, classRecord) {
  const classId = Number(classRecord?.id);
  const teacherId = Number(user?.id);
  if (!Number.isInteger(classId) || !Number.isInteger(teacherId)) return false;

  const row = await ClassTeacher.findOne({
    where: {
      classId,
      teacherId,
      semester: classRecord.semester,
      isActive: true,
    },
    attributes: ['id'],
  });
  return Boolean(row);
}

async function canAccessClassByRecord(user, classRecord) {
  const profile = buildAccessProfile(user);

  if (!classRecord) {
    return denied('MISSING_CLASS_CONTEXT', '此操作需要指定活動或班級資料來源。');
  }

  if (profile.isAdmin || isExecutiveProfile(profile)) {
    return { allowed: true, scope: 'all' };
  }

  if (isOwnClassScopedTeacherProfile(profile)) {
    if (await hasClassTeacherMapping(user, classRecord)) {
      return { allowed: true, scope: 'own_class_mapping' };
    }
    if (isTeacherNameOwner(user, classRecord)) {
      return { allowed: true, scope: 'own_class_teacher_name' };
    }
    return denied();
  }

  return denied();
}

async function assertCanAccessClass(user, classRecord) {
  const result = await canAccessClassByRecord(user, classRecord);
  if (result.allowed) return result;

  const err = new Error(result.message || '您沒有存取此班級資料的權限。');
  err.status = 403;
  err.code = result.code || 'CLASS_SCOPE_DENIED';
  throw err;
}

function buildClassScopeWhere(user) {
  const profile = buildAccessProfile(user);
  if (profile.isAdmin || isExecutiveProfile(profile)) return {};

  if (isOwnClassScopedTeacherProfile(profile)) {
    const teacherName = norm(user?.name);
    if (!teacherName) return null;
    // P1 fallback: classes currently expose teacherName but not a stable teacherId column.
    return { teacherName };
  }

  return null;
}

function sendClassScopeDenied(res, err) {
  return res.status(err.status || 403).json({
    success: false,
    errorCode: err.code || 'CLASS_SCOPE_DENIED',
    message: err.message || '您沒有存取此班級資料的權限。',
  });
}

module.exports = {
  canAccessClassByRecord,
  assertCanAccessClass,
  buildClassScopeWhere,
  sendClassScopeDenied,
  isExecutiveProfile,
  isOwnClassScopedTeacherProfile,
};
