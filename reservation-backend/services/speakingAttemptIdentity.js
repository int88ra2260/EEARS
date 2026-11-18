'use strict';

function resolveSpeakingStudentId({ bodyStudentId, studentAccount, linkedToEnglishTable }) {
  if (linkedToEnglishTable) {
    if (!studentAccount?.studentId) {
      const err = new Error('請先登入學生帳號。練習會用登入學號對到你的預約，Leader 才看得到。');
      err.status = 401;
      err.code = 'STUDENT_AUTH_REQUIRED';
      throw err;
    }
    if (!studentAccount.emailVerifiedAt) {
      const err = new Error('請先到我的帳號收驗證碼，確認收信信箱後再練習。');
      err.status = 403;
      err.code = 'EMAIL_ACTIVATION_REQUIRED';
      err.redirectUrl = '/student/account';
      throw err;
    }
    return studentAccount.studentId;
  }
  if (studentAccount?.studentId) return studentAccount.studentId;
  return bodyStudentId;
}

module.exports = {
  resolveSpeakingStudentId,
};
