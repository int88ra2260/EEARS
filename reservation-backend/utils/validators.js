// utils/validators.js
// 統一的驗證工具
const { createErrorMessage } = require('./errorMessages');

// 學號驗證：一位大寫英文(B/M/D/I/J) + 9位數字
const studentIdRegex = /^[BMDNIJ]\d{9}$/;

// 姓名驗證：只能是中文或英文(可包含空格)
const studentNameRegex = /^[\u4E00-\u9FA5A-Za-z\s]+$/;

// Email 驗證
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 中山大學學生信箱網域（英語實踐歷程護照等） */
const NSYSU_STUDENT_EMAIL_DOMAIN = 'student.nsysu.edu.tw';

/**
 * 驗證學號格式
 * @param {string} studentId 學號
 * @returns {boolean} 是否有效
 */
function validateStudentId(studentId) {
  return studentIdRegex.test(studentId);
}

/**
 * 驗證姓名格式
 * @param {string} name 姓名
 * @returns {boolean} 是否有效
 */
function validateName(name) {
  return studentNameRegex.test(name);
}

/**
 * 驗證Email格式
 * @param {string} email Email地址
 * @returns {boolean} 是否有效
 */
function validateEmail(email) {
  return emailRegex.test(email);
}

/**
 * 是否為中山大學學生信箱（@student.nsysu.edu.tw）
 * @param {string} email
 * @returns {boolean}
 */
function validateNsysuStudentEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!validateEmail(value)) return false;
  return value.endsWith(`@${NSYSU_STUDENT_EMAIL_DOMAIN}`);
}

/**
 * 驗證預約所需的基本資料
 * @param {Object} data 包含 studentId, studentName, studentEmail 的物件
 * @returns {Object} { isValid: boolean, errors: string[], errorMessages: Object[] }
 */
function validateReservationData(data) {
  const { studentId, studentName, studentEmail } = data;
  const errors = [];
  const errorMessages = [];

  if (!studentId || studentId.trim() === '') {
    const errorMsg = createErrorMessage('REQUIRED_FIELD_MISSING', '學號');
    errors.push(errorMsg.zh);
    errorMessages.push(errorMsg);
  } else if (!validateStudentId(studentId.trim())) {
    const errorMsg = createErrorMessage('INVALID_STUDENT_ID');
    errors.push(errorMsg.zh);
    errorMessages.push(errorMsg);
  }

  if (!studentName || studentName.trim() === '') {
    const errorMsg = createErrorMessage('REQUIRED_FIELD_MISSING', '姓名');
    errors.push(errorMsg.zh);
    errorMessages.push(errorMsg);
  } else if (!validateName(studentName.trim())) {
    const errorMsg = createErrorMessage('INVALID_NAME');
    errors.push(errorMsg.zh);
    errorMessages.push(errorMsg);
  }

  if (!studentEmail || studentEmail.trim() === '') {
    const errorMsg = createErrorMessage('REQUIRED_FIELD_MISSING', '電子郵件');
    errors.push(errorMsg.zh);
    errorMessages.push(errorMsg);
  } else if (!validateEmail(studentEmail.trim())) {
    const errorMsg = createErrorMessage('INVALID_EMAIL');
    errors.push(errorMsg.zh);
    errorMessages.push(errorMsg);
  }

  return {
    isValid: errors.length === 0,
    errors,
    errorMessages
  };
}

module.exports = {
  validateStudentId,
  validateName,
  validateEmail,
  validateNsysuStudentEmail,
  validateReservationData,
  NSYSU_STUDENT_EMAIL_DOMAIN,
  // 導出正則表達式供其他地方使用
  studentIdRegex,
  studentNameRegex,
  emailRegex
};

