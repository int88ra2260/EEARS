function pushError(newErrors, errorOrder, field, message) {
  newErrors[field] = message;
  if (!errorOrder.includes(field)) {
    errorOrder.push(field);
  }
}

function validateCommonFields(formData) {
  const newErrors = {};
  const errorOrder = [];

  if (!formData.email) {
    pushError(newErrors, errorOrder, 'email', '請填寫電子郵件');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    pushError(newErrors, errorOrder, 'email', '電子郵件格式不正確');
  }

  if (!formData.studentNameZh) {
    pushError(newErrors, errorOrder, 'studentNameZh', '請填寫中文姓名');
  }

  if (!formData.lastNameEn) {
    pushError(newErrors, errorOrder, 'lastNameEn', '請填寫英文拼音姓');
  }
  if (!formData.firstNameEn) {
    pushError(newErrors, errorOrder, 'firstNameEn', '請填寫英文拼音名');
  }

  if (!formData.birthDate) {
    pushError(newErrors, errorOrder, 'birthDate', '請填寫出生年月日');
  }

  if (!formData.phone) {
    pushError(newErrors, errorOrder, 'phone', '請填寫行動電話');
  } else if (!/^09\d{8}$/.test(formData.phone)) {
    pushError(newErrors, errorOrder, 'phone', '行動電話格式不正確（應為 09xxxxxxxx）');
  }

  if (!formData.postalCode) {
    pushError(newErrors, errorOrder, 'postalCode', '請填寫郵遞區號');
  }
  if (!formData.city) {
    pushError(newErrors, errorOrder, 'city', '請填寫縣市');
  }
  if (!formData.district) {
    pushError(newErrors, errorOrder, 'district', '請填寫行政區');
  }
  if (!formData.address) {
    pushError(newErrors, errorOrder, 'address', '請填寫詳細地址');
  }

  if (!formData.degreeLevel) {
    pushError(newErrors, errorOrder, 'degreeLevel', '請選擇就讀身分');
  }
  if (!formData.grade) {
    pushError(newErrors, errorOrder, 'grade', '請選擇年級');
  }
  if (!formData.college) {
    pushError(newErrors, errorOrder, 'college', '請選擇學院');
  }
  if (!formData.department) {
    pushError(newErrors, errorOrder, 'department', '請選擇或填寫科系');
  }

  if (formData.isLowIncome === '') {
    pushError(newErrors, errorOrder, 'isLowIncome', '請選擇是否為中低收入戶');
  }
  if (formData.hasDisabilityCard === '') {
    pushError(newErrors, errorOrder, 'hasDisabilityCard', '請選擇是否有身心障礙手冊');
  }

  if (!formData.agreedToTerms) {
    pushError(newErrors, errorOrder, 'agreedToTerms', '請同意個資與報名規範');
  }

  if (!formData.infoSource) {
    pushError(newErrors, errorOrder, 'infoSource', '請選擇從何得知培力英檢');
  }

  return { newErrors, errorOrder };
}

export function validateEnglishTestDetailForm(formData) {
  const { newErrors, errorOrder } = validateCommonFields(formData);

  if (!formData.addressConfirmed) {
    pushError(newErrors, errorOrder, 'addressConfirmed', '請確認地址資訊');
  }

  if (!formData.idPhoto) {
    pushError(newErrors, errorOrder, 'idPhoto', '請上傳證件照');
  }

  if (formData.infoSource === '其他' && !formData.infoSourceOther.trim()) {
    pushError(newErrors, errorOrder, 'infoSourceOther', '請填寫其他資訊來源');
  }

  return {
    isValid: Object.keys(newErrors).length === 0,
    firstErrorField: errorOrder.length > 0 ? errorOrder[0] : null,
    errors: newErrors,
  };
}

export function validateEnglishTestEditForm(formData, registration, fileInputs) {
  const { newErrors, errorOrder } = validateCommonFields(formData);

  if (!registration.idPhoto && !formData.idPhoto && !fileInputs.idPhoto) {
    pushError(newErrors, errorOrder, 'idPhoto', '請上傳證件照');
  }

  return {
    isValid: Object.keys(newErrors).length === 0,
    firstErrorField: errorOrder.length > 0 ? errorOrder[0] : null,
    errors: newErrors,
  };
}
