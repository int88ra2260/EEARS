'use strict';

const { Op } = require('sequelize');
const { Course, CourseEnrollment } = require('../../models');
const { getAllowedStudentIds } = require('../accessControl/studentScopeGuard');
const { buildAccessProfile } = require('../../auth/accessProfile');
const { P } = require('../../auth/permissions');

function norm(v) {
  return String(v || '').trim();
}

function normLower(v) {
  return norm(v).toLowerCase();
}

function normSid(v) {
  return norm(v).toUpperCase();
}

function isAdmin(user) {
  return String(user?.role || '').toLowerCase() === 'admin';
}

function isExecutive(user) {
  return String(user?.role || '').toLowerCase() === 'teacher'
    && String(user?.teacherLevel || '').toLowerCase() === 'executive';
}

function isTeacher(user) {
  return String(user?.role || '').toLowerCase() === 'teacher' && !isExecutive(user);
}

/** 行政職員具英語學習歷程中心檢視／管理權限（如培力英檢行政） */
function hasOfficeStaffLearningJourneyCenterAccess(user) {
  const profile = buildAccessProfile(user);
  if (!profile.isOfficeStaff) return false;
  return (
    profile.permissionSet.has(P.CAN_MANAGE_ENGLISH_TEST_TRACKING)
    || profile.permissionSet.has(P.CAN_VIEW_ENGLISH_TEST_TRACKING)
  );
}

async function getTeacherAllowedStudentsBySemester(user, semesterId) {
  const sem = norm(semesterId);
  const teacherName = normLower(user?.name);
  const courseIds = new Set();
  const studentIds = new Set();

  if (teacherName) {
    const rows = await Course.findAll({
      where: { semesterId: sem },
      include: [{
        model: CourseEnrollment,
        as: 'enrollments',
        required: true,
        where: {
          semesterId: sem,
          enrollmentStatus: { [Op.in]: ['enrolled', 'completed'] }
        },
        attributes: ['courseId', 'studentId']
      }],
      attributes: ['id', 'instructorName']
    });

    for (const course of rows) {
      if (normLower(course.instructorName) !== teacherName) continue;
      courseIds.add(Number(course.id));
      for (const e of course.enrollments || []) {
        const sid = normSid(e.studentId);
        if (sid) studentIds.add(sid);
      }
    }
  }

  // 與班級參與概況一致：合併 Class／ClassTeacher 名單（避免僅 Course 有資料時老師看到空表）
  const classScope = await getAllowedStudentIds(user, { semester: sem, semesterId: sem });
  if (classScope.allowed && !classScope.unrestricted && Array.isArray(classScope.allowedStudentIds)) {
    for (const sid of classScope.allowedStudentIds) {
      const normalized = normSid(sid);
      if (normalized) studentIds.add(normalized);
    }
  }

  return { courseIds: [...courseIds], allowedStudentIds: [...studentIds] };
}

async function getUserLearningJourneyScope(user, semesterId) {
  if (isAdmin(user) || isExecutive(user)) return { scope: 'all' };
  if (hasOfficeStaffLearningJourneyCenterAccess(user)) return { scope: 'all' };
  if (!isTeacher(user)) return { scope: 'none', semesterId: norm(semesterId), allowedStudentIds: [], courseIds: [] };
  const sem = norm(semesterId);
  const { courseIds, allowedStudentIds } = await getTeacherAllowedStudentsBySemester(user, sem);
  return { scope: 'teacher', semesterId: sem, allowedStudentIds, courseIds };
}

module.exports = {
  getUserLearningJourneyScope,
  hasOfficeStaffLearningJourneyCenterAccess,
  isAdmin,
  isExecutive,
  isTeacher
};
