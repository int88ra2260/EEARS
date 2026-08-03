/**
 * 學生預約 trio（學號／姓名／Email）localStorage 讀寫
 * 僅供學生端 UX 預填，不作為後端 Gate 依據。
 */

const KEYS = {
  studentId: 'lastStudentId',
  studentName: 'lastStudentName',
  studentEmail: 'lastStudentEmail',
};

export function loadStudentTrio() {
  try {
    return {
      studentId: localStorage.getItem(KEYS.studentId) || '',
      studentName: localStorage.getItem(KEYS.studentName) || '',
      studentEmail: localStorage.getItem(KEYS.studentEmail) || '',
    };
  } catch {
    return { studentId: '', studentName: '', studentEmail: '' };
  }
}

export function saveStudentTrio({ studentId, studentName, studentEmail }) {
  try {
    if (studentId != null) localStorage.setItem(KEYS.studentId, String(studentId).trim());
    if (studentName != null) localStorage.setItem(KEYS.studentName, String(studentName).trim());
    if (studentEmail != null) localStorage.setItem(KEYS.studentEmail, String(studentEmail).trim());
  } catch {
    // private mode / quota — 略過
  }
}
