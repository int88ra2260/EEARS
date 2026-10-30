import { ENGLISH_TEST_DEFAULT_ADDRESS } from '../constants/englishTestDefaultAddress';

const GRADE_BY_CODE = {
  1: '一年級',
  2: '二年級',
  3: '三年級',
  4: '四年級以上',
  5: '四年級以上',
  6: '四年級以上',
};

function clean(value) {
  return String(value || '').trim();
}

function birthDateFromProfile(profile) {
  let year = Number(clean(profile.birthYear));
  const month = Number(clean(profile.birthMonth));
  const day = Number(clean(profile.birthDay));
  if (!year || !month || !day) return '';
  if (year < 1911) year += 1911;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return iso;
}

function optionValues(question) {
  return (question.options || []).flatMap((option) => {
    if (option && typeof option === 'object') {
      return [clean(option.value), clean(option.label)].filter(Boolean);
    }
    return [clean(option)].filter(Boolean);
  });
}

function questionAccepts(question, value) {
  if (!question || question.visible === false || !value) return false;
  if (question.studentEditable === false) return false;
  const type = question.type || 'text';
  if (type === 'select' || type === 'radio') {
    const options = optionValues(question);
    if (options.length === 0) return false;
    return options.includes(value);
  }
  return type === 'text' || type === 'email' || type === 'date' || type === 'tel';
}

function gradeLabel(profile, question) {
  const raw = clean(profile.grade);
  const mapped = GRADE_BY_CODE[raw] || raw;
  return questionAccepts(question, mapped) ? mapped : '';
}

/**
 * 只填目前表單有顯示、且學生可以改的欄位。
 * 表單設計設成不可改的欄位（例如預設校本部地址）維持表單自己的值。
 */
export function campusProfileFieldPatch(profile, questions = []) {
  if (!profile) return {};
  const byKey = new Map(questions.map((question) => [question.fieldKey, question]));
  const patch = {};
  const assign = (fieldKey, value) => {
    const next = clean(value);
    if (questionAccepts(byKey.get(fieldKey), next)) patch[fieldKey] = next;
  };

  assign('studentId', profile.studentId);
  assign('name', profile.name);
  assign('studentNameZh', profile.name);
  assign('nationalId', profile.nationalId);
  assign('idNumber', profile.nationalId);
  assign('phone', profile.phone);
  assign('email', profile.email);
  assign('postalCode', profile.postalCode);
  assign('city', profile.city);
  assign('address', profile.address);
  assign('department', profile.departmentName);
  assign('birthDate', birthDateFromProfile(profile));
  assign('grade', gradeLabel(profile, byKey.get('grade')));
  return patch;
}

export function mergeCampusProfileIntoForm(form, patch) {
  const next = { ...form };
  Object.entries(patch).forEach(([key, value]) => {
    const current = clean(form[key]);
    const addressDefault = ENGLISH_TEST_DEFAULT_ADDRESS[key];
    const stillDefault = addressDefault && current === addressDefault;
    if (!current || stillDefault) next[key] = value;
  });
  return next;
}
