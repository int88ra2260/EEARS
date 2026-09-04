// src/utils/validators.js
// 前端驗證工具 (與後端保持一致)

// 學號驗證：一位大寫英文(B/M/D/I/J) + 9位數字
const studentIdRegex = /^[BMDNIJ]\d{9}$/;

// 姓名驗證：只能是中文或英文(可包含空格)
const studentNameRegex = /^[\u4E00-\u9FA5A-Za-z\s]+$/;

// Email 驗證
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 中山大學學生信箱網域（英語實踐歷程護照） */
export const NSYSU_STUDENT_EMAIL_DOMAIN = 'student.nsysu.edu.tw';

/**
 * 驗證學號格式
 * @param {string} studentId 學號
 * @returns {boolean} 是否有效
 */
export function validateStudentId(studentId) {
  return studentIdRegex.test(studentId);
}

/**
 * 驗證姓名格式
 * @param {string} name 姓名
 * @returns {boolean} 是否有效
 */
export function validateName(name) {
  return studentNameRegex.test(name);
}

/**
 * 驗證Email格式
 * @param {string} email Email地址
 * @returns {boolean} 是否有效
 */
export function validateEmail(email) {
  return emailRegex.test(email);
}

/**
 * 是否為中山大學學生信箱（@student.nsysu.edu.tw）
 */
export function validateNsysuStudentEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!validateEmail(value)) return false;
  return value.endsWith(`@${NSYSU_STUDENT_EMAIL_DOMAIN}`);
}

/**
 * 驗證預約所需的基本資料（欄位級錯誤，供表單 inline 顯示）
 * @returns {{ isValid: boolean, fieldErrors: Record<string, string> }}
 */
export function validateReservationFields(data) {
  const { studentId, studentName, studentEmail } = data;
  const fieldErrors = {};

  if (!studentId || !String(studentId).trim()) {
    fieldErrors.studentId = '請填寫學號';
  } else if (!validateStudentId(String(studentId).trim())) {
    fieldErrors.studentId = '學號格式應為 B/M/D/I/J 開頭加 9 位數字';
  }

  const name = String(studentName || '').trim();
  if (!name) {
    fieldErrors.studentName = '請填寫姓名';
  } else if (name.length < 2) {
    fieldErrors.studentName = '姓名至少需 2 個字元';
  } else if (!validateName(name)) {
    fieldErrors.studentName = '姓名只能包含中文或英文';
  }

  const email = String(studentEmail || '').trim();
  if (!email) {
    fieldErrors.studentEmail = '請填寫 Email';
  } else if (!validateEmail(email)) {
    fieldErrors.studentEmail = 'Email 格式不正確';
  }

  return {
    isValid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

/**
 * 英語實踐歷程護照：同預約欄位，且 Email 必須為 @student.nsysu.edu.tw
 */
export function validateElpStudentFields(data) {
  const result = validateReservationFields(data);
  const email = String(data?.studentEmail || '').trim();
  if (email && validateEmail(email) && !validateNsysuStudentEmail(email)) {
    result.fieldErrors.studentEmail = '請使用中山大學學生信箱（@student.nsysu.edu.tw）';
  }
  return {
    isValid: Object.keys(result.fieldErrors).length === 0,
    fieldErrors: result.fieldErrors,
  };
}

/**
 * 驗證預約所需的基本資料
 * @param {Object} data 包含 studentId, studentName, studentEmail 的物件
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateReservationData(data) {
  const { isValid, fieldErrors } = validateReservationFields(data);
  return {
    isValid,
    errors: Object.values(fieldErrors),
  };
}

