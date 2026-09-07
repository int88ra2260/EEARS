import { fieldRequired, fieldVisible } from './englishTestFormSchemaMeta';

function pushError(newErrors, errorOrder, field, message) {
  newErrors[field] = message;
  if (!errorOrder.includes(field)) {
    errorOrder.push(field);
  }
}

function shouldCheck(formOptions, fieldKey) {
  return fieldVisible(formOptions, fieldKey);
}

function isRequired(formOptions, fieldKey, fallback = true) {
  return fieldRequired(formOptions, fieldKey, fallback);
}

function validateCommonFields(formData, formOptions = null) {
  const newErrors = {};
  const errorOrder = [];

  if (shouldCheck(formOptions, 'email')) {
    if (!formData.email) {
      if (isRequired(formOptions, 'email', true)) {
        pushError(newErrors, errorOrder, 'email', '請填寫電子郵件');
      }
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      pushError(newErrors, errorOrder, 'email', '電子郵件格式不正確');
    }
  }

  if (shouldCheck(formOptions, 'studentNameZh') && isRequired(formOptions, 'studentNameZh', true) && !formData.studentNameZh) {
    pushError(newErrors, errorOrder, 'studentNameZh', '請填寫中文姓名');
  }

  if (shouldCheck(formOptions, 'lastNameEn') && isRequired(formOptions, 'lastNameEn', true) && !formData.lastNameEn) {
    pushError(newErrors, errorOrder, 'lastNameEn', '請填寫英文拼音姓');
  }
  if (shouldCheck(formOptions, 'firstNameEn') && isRequired(formOptions, 'firstNameEn', true) && !formData.firstNameEn) {
    pushError(newErrors, errorOrder, 'firstNameEn', '請填寫英文拼音名');
  }

  if (shouldCheck(formOptions, 'birthDate') && isRequired(formOptions, 'birthDate', true) && !formData.birthDate) {
    pushError(newErrors, errorOrder, 'birthDate', '請填寫出生年月日');
  }

  if (shouldCheck(formOptions, 'phone')) {
    if (!formData.phone) {
      if (isRequired(formOptions, 'phone', true)) {
        pushError(newErrors, errorOrder, 'phone', '請填寫行動電話');
      }
    } else if (!/^09\d{8}$/.test(formData.phone)) {
      pushError(newErrors, errorOrder, 'phone', '行動電話格式不正確（應為 09xxxxxxxx）');
    }
  }

  if (shouldCheck(formOptions, 'postalCode') && isRequired(formOptions, 'postalCode', true) && !formData.postalCode) {
    pushError(newErrors, errorOrder, 'postalCode', '請填寫郵遞區號');
  }
  if (shouldCheck(formOptions, 'city') && isRequired(formOptions, 'city', true) && !formData.city) {
    pushError(newErrors, errorOrder, 'city', '請填寫縣市');
  }
  if (shouldCheck(formOptions, 'district') && isRequired(formOptions, 'district', true) && !formData.district) {
    pushError(newErrors, errorOrder, 'district', '請填寫行政區');
  }
  if (shouldCheck(formOptions, 'address') && isRequired(formOptions, 'address', true) && !formData.address) {
    pushError(newErrors, errorOrder, 'address', '請填寫詳細地址');
  }

  if (shouldCheck(formOptions, 'degreeLevel') && isRequired(formOptions, 'degreeLevel', true) && !formData.degreeLevel) {
    pushError(newErrors, errorOrder, 'degreeLevel', '請選擇就讀身分');
  }
  if (shouldCheck(formOptions, 'grade') && isRequired(formOptions, 'grade', true) && !formData.grade) {
    pushError(newErrors, errorOrder, 'grade', '請選擇年級');
  }
  if (shouldCheck(formOptions, 'college') && isRequired(formOptions, 'college', true) && !formData.college) {
    pushError(newErrors, errorOrder, 'college', '請選擇學院');
  }
  if (shouldCheck(formOptions, 'department') && isRequired(formOptions, 'department', true) && !formData.department) {
    pushError(newErrors, errorOrder, 'department', '請選擇或填寫科系');
  }

  if (shouldCheck(formOptions, 'isLowIncome') && isRequired(formOptions, 'isLowIncome', true) && formData.isLowIncome === '') {
    pushError(newErrors, errorOrder, 'isLowIncome', '請選擇是否為中低收入戶');
  }
  if (shouldCheck(formOptions, 'hasDisabilityCard') && isRequired(formOptions, 'hasDisabilityCard', true) && formData.hasDisabilityCard === '') {
    pushError(newErrors, errorOrder, 'hasDisabilityCard', '請選擇是否有身心障礙手冊');
  }

  if (shouldCheck(formOptions, 'agreedToTerms') && isRequired(formOptions, 'agreedToTerms', true) && !formData.agreedToTerms) {
    pushError(newErrors, errorOrder, 'agreedToTerms', '請同意個資與報名規範');
  }

  if (shouldCheck(formOptions, 'infoSource') && isRequired(formOptions, 'infoSource', true) && !formData.infoSource) {
    pushError(newErrors, errorOrder, 'infoSource', '請選擇從何得知培力英檢');
  }

  return { newErrors, errorOrder };
}

export function validateEnglishTestDetailForm(formData, formOptions = null) {
  const { newErrors, errorOrder } = validateCommonFields(formData, formOptions);

  if (
    shouldCheck(formOptions, 'addressConfirmed')
    && isRequired(formOptions, 'addressConfirmed', true)
    && !formData.addressConfirmed
  ) {
    pushError(newErrors, errorOrder, 'addressConfirmed', '請確認地址資訊');
  }

  if (shouldCheck(formOptions, 'idPhoto') && isRequired(formOptions, 'idPhoto', true) && !formData.idPhoto) {
    pushError(newErrors, errorOrder, 'idPhoto', '請上傳證件照');
  }

  if (
    shouldCheck(formOptions, 'infoSource')
    && formData.infoSource === '其他'
    && !(formData.infoSourceOther || '').trim()
  ) {
    pushError(newErrors, errorOrder, 'infoSourceOther', '請填寫其他資訊來源');
  }

  return {
    isValid: Object.keys(newErrors).length === 0,
    firstErrorField: errorOrder.length > 0 ? errorOrder[0] : null,
    errors: newErrors,
  };
}

export function validateEnglishTestEditForm(formData, registration, fileInputs, formOptions = null) {
  const { newErrors, errorOrder } = validateCommonFields(formData, formOptions);

  if (
    shouldCheck(formOptions, 'idPhoto')
    && isRequired(formOptions, 'idPhoto', true)
    && !registration.idPhoto
    && !formData.idPhoto
    && !fileInputs?.idPhoto
  ) {
    pushError(newErrors, errorOrder, 'idPhoto', '請上傳證件照');
  }

  return {
    isValid: Object.keys(newErrors).length === 0,
    firstErrorField: errorOrder.length > 0 ? errorOrder[0] : null,
    errors: newErrors,
  };
}

/** 依錯誤鍵順序，找到第一個實際掛在 DOM 上的欄位 */
export function resolveScrollableErrorField(getFieldRef, preferredField, errorKeys = []) {
  const ordered = [];
  if (preferredField) ordered.push(preferredField);
  for (const key of errorKeys) {
    if (!ordered.includes(key)) ordered.push(key);
  }

  for (const field of ordered) {
    const ref = typeof getFieldRef === 'function' ? getFieldRef(field) : null;
    if (ref?.current) return field;
  }
  return preferredField || errorKeys[0] || null;
}
