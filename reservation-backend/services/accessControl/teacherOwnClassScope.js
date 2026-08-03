'use strict';

/**
 * 老師「僅能看自己授課班級／學生」之層級判斷（與 executive 全視野區分）。
 */

function isExecutiveProfile(profile) {
  return profile.role === 'teacher' && profile.teacherLevel === 'executive';
}

function isRegularTeacherProfile(profile) {
  return profile.role === 'teacher' && (!profile.teacherLevel || profile.teacherLevel === 'regular');
}

/** regular + 各活動負責人（若同時授課，適用班級名單／ClassTeacher 對應） */
function isOwnClassScopedTeacherProfile(profile) {
  if (profile.role !== 'teacher' || isExecutiveProfile(profile)) return false;
  const level = profile.teacherLevel || 'regular';
  return (
    level === 'regular' ||
    level === 'et_manager' ||
    level === 'if_manager' ||
    level === 'jt_manager'
  );
}

module.exports = {
  isExecutiveProfile,
  isRegularTeacherProfile,
  isOwnClassScopedTeacherProfile,
};
