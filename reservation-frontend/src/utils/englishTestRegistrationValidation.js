// 培力英檢報名表單驗證

export function validateStudentId(studentId) {
  const trimmed = String(studentId || '').trim();
  if (!trimmed) {
    return '請填寫學號';
  }
  const pattern = /^B\d{9}$/;
  if (!pattern.test(trimmed)) {
    return '學號必須是字母B開頭加上9位數字（例如：B123456789）';
  }
  return '';
}

export function validateName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    return '請填寫姓名';
  }
  const chinesePattern = /^[\u4e00-\u9fa5]+$/;
  if (!chinesePattern.test(trimmed)) {
    return '姓名必須是中文';
  }
  if (trimmed.length < 2) {
    return '姓名必須至少兩個中文字以上';
  }
  return '';
}

export function validateIdNumber(idNumber) {
  const trimmed = String(idNumber || '').trim().toUpperCase();
  if (!trimmed) {
    return '請填寫身分證字號';
  }
  const pattern = /^[A-Z][12]\d{8}$/;
  if (!pattern.test(trimmed)) {
    return '身分證字號格式錯誤：第一碼必須為大寫英文字母（A-Z），第二碼為1或2，後8碼為數字';
  }

  const letterMap = {
    A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17,
    I: 34, J: 18, K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25,
    S: 26, T: 27, U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33,
  };

  const firstLetter = trimmed.charAt(0);
  const letterValue = letterMap[firstLetter];

  if (!letterValue) {
    return '身分證字號第一碼無效';
  }

  const letterNumber = Math.floor(letterValue / 10) + (letterValue % 10) * 9;

  let sum = letterNumber;
  for (let i = 1; i < 9; i++) {
    sum += parseInt(trimmed.charAt(i), 10) * (9 - i);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  const lastDigit = parseInt(trimmed.charAt(9), 10);

  if (checkDigit !== lastDigit) {
    return '身分證字號檢查碼錯誤';
  }

  return '';
}

export function validateEnglishTestBasicForm(form) {
  return {
    studentId: validateStudentId(form.studentId),
    name: validateName(form.name),
    idNumber: validateIdNumber(form.idNumber),
  };
}
