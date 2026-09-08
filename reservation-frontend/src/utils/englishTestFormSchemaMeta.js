import {
  COLLEGES,
  GRADES,
  DEPARTMENT_OPTIONS,
  DISABILITY_TYPES,
  EXAM_ASSISTANCE_OPTIONS,
  EXAM_ASSISTANCE_OPTIONS_EDIT,
  INFO_SOURCE_OPTIONS,
  INFO_SOURCE_OPTIONS_EDIT,
  DEGREE_LEVEL_OPTIONS,
} from './englishTestFormOptions';

function toOptionPairs(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  return list.map((item) => {
    if (typeof item === 'string') return { value: item, label: item };
    const value = String(item?.value ?? item?.label ?? '');
    const label = String(item?.label ?? item?.value ?? value);
    return { value, label };
  }).filter((o) => o.value);
}

/**
 * 將公開 API meta（或完整 schema）轉成學生端表單用的 options 物件。
 */
export function buildFormOptionsFromMeta(meta, { mode = 'create' } = {}) {
  const empty = !meta || (!meta.optionsByFieldKey && !meta.labelsByFieldKey && !meta.questions);
  if (empty) {
    return {
      colleges: COLLEGES,
      grades: GRADES,
      departmentOptions: DEPARTMENT_OPTIONS,
      disabilityTypes: DISABILITY_TYPES,
      examAssistanceOptions: mode === 'create' ? EXAM_ASSISTANCE_OPTIONS : EXAM_ASSISTANCE_OPTIONS_EDIT,
      infoSourceOptions: mode === 'create' ? INFO_SOURCE_OPTIONS : INFO_SOURCE_OPTIONS_EDIT,
      degreeLevelOptions: DEGREE_LEVEL_OPTIONS,
      labelsByFieldKey: {},
      requiredByFieldKey: {},
      visibleByFieldKey: {},
      helpTextByFieldKey: {},
      optionPairsByFieldKey: {},
      sectionsById: {},
      questions: [],
      typeByFieldKey: {},
      defaultValueByFieldKey: {},
      studentEditableByFieldKey: {},
      schemaStrict: false,
    };
  }

  const o = meta.optionsByFieldKey || {};
  const pairs = meta.optionPairsByFieldKey || {};
  const sectionsById = meta.sectionsById || Object.fromEntries(
    (meta.sections || []).map((s) => [s.id, s])
  );

  // 若只有 questions 陣列，補齊 pairs / labels
  let labelsByFieldKey = { ...(meta.labelsByFieldKey || {}) };
  let requiredByFieldKey = { ...(meta.requiredByFieldKey || {}) };
  let visibleByFieldKey = { ...(meta.visibleByFieldKey || {}) };
  let helpTextByFieldKey = { ...(meta.helpTextByFieldKey || {}) };
  let optionPairsByFieldKey = { ...pairs };
  let typeByFieldKey = { ...(meta.typeByFieldKey || {}) };
  let defaultValueByFieldKey = { ...(meta.defaultValueByFieldKey || {}) };
  let studentEditableByFieldKey = { ...(meta.studentEditableByFieldKey || {}) };

  if (Array.isArray(meta.questions)) {
    for (const q of meta.questions) {
      if (!q?.fieldKey) continue;
      if (q.label != null) labelsByFieldKey[q.fieldKey] = q.label;
      if (requiredByFieldKey[q.fieldKey] === undefined) {
        requiredByFieldKey[q.fieldKey] = Boolean(q.required);
      }
      if (visibleByFieldKey[q.fieldKey] === undefined) {
        visibleByFieldKey[q.fieldKey] = q.visible !== false;
      }
      if (q.helpText != null) helpTextByFieldKey[q.fieldKey] = q.helpText;
      if (q.type != null) typeByFieldKey[q.fieldKey] = String(q.type);
      if (q.defaultValue != null && String(q.defaultValue).trim() !== '') {
        defaultValueByFieldKey[q.fieldKey] = String(q.defaultValue);
      }
      if (q.studentEditable !== undefined) {
        studentEditableByFieldKey[q.fieldKey] = q.studentEditable !== false;
      } else if (studentEditableByFieldKey[q.fieldKey] === undefined) {
        studentEditableByFieldKey[q.fieldKey] = true;
      }
      if (!optionPairsByFieldKey[q.fieldKey] && Array.isArray(q.options) && q.options.length) {
        optionPairsByFieldKey[q.fieldKey] = toOptionPairs(q.options);
      }
    }
  }

  return {
    colleges: o.college?.length ? o.college : COLLEGES,
    grades: o.grade?.length ? o.grade : GRADES,
    departmentOptions: meta.departmentOptions || DEPARTMENT_OPTIONS,
    disabilityTypes: o.disabilityTypes?.length ? o.disabilityTypes : DISABILITY_TYPES,
    examAssistanceOptions: o.examAssistanceOptions?.length
      ? o.examAssistanceOptions
      : (mode === 'create' ? EXAM_ASSISTANCE_OPTIONS : EXAM_ASSISTANCE_OPTIONS_EDIT),
    infoSourceOptions: o.infoSource?.length
      ? o.infoSource
      : (mode === 'create' ? INFO_SOURCE_OPTIONS : INFO_SOURCE_OPTIONS_EDIT),
    degreeLevelOptions: o.degreeLevel?.length ? o.degreeLevel : DEGREE_LEVEL_OPTIONS,
    examTypeOptions: optionPairsByFieldKey.examType || null,
    scoreExamTypeOptions: optionPairsByFieldKey.listeningScore || null,
    hasCEFRB2Options: optionPairsByFieldKey.hasCEFRB2 || null,
    labelsByFieldKey,
    requiredByFieldKey,
    visibleByFieldKey,
    helpTextByFieldKey,
    optionPairsByFieldKey,
    typeByFieldKey,
    defaultValueByFieldKey,
    studentEditableByFieldKey,
    sectionsById,
    questions: meta.questions || [],
    /** 有載入 schema 題目時，學生端嚴格依 schema 決定顯示（刪題＝不顯示） */
    schemaStrict: Array.isArray(meta.questions) && meta.questions.length > 0,
  };
}

export function fieldLabel(formOptions, fieldKey, fallback) {
  const fromSchema = formOptions?.labelsByFieldKey?.[fieldKey];
  return (fromSchema != null && String(fromSchema).trim() !== '') ? String(fromSchema) : fallback;
}

export function fieldVisible(formOptions, fieldKey) {
  const map = formOptions?.visibleByFieldKey;
  if (!map) return true;
  if (map[fieldKey] === undefined) {
    // schema 已載入：未出現在題目清單 → 視為已刪除／不顯示
    if (formOptions?.schemaStrict) return false;
    return true;
  }
  return map[fieldKey] !== false;
}

export function fieldRequired(formOptions, fieldKey, fallback = false) {
  if (!formOptions?.requiredByFieldKey || formOptions.requiredByFieldKey[fieldKey] === undefined) {
    return fallback;
  }
  return Boolean(formOptions.requiredByFieldKey[fieldKey]);
}

export function fieldHelp(formOptions, fieldKey, fallback = '') {
  const fromSchema = formOptions?.helpTextByFieldKey?.[fieldKey];
  return (fromSchema != null && String(fromSchema).trim() !== '') ? String(fromSchema) : fallback;
}

export function fieldType(formOptions, fieldKey, fallback = 'text') {
  const fromMap = formOptions?.typeByFieldKey?.[fieldKey];
  if (fromMap != null && String(fromMap).trim() !== '') return String(fromMap);
  const fromQuestion = (formOptions?.questions || []).find((q) => q?.fieldKey === fieldKey);
  if (fromQuestion?.type != null && String(fromQuestion.type).trim() !== '') {
    return String(fromQuestion.type);
  }
  return fallback;
}

export function fieldDefaultValue(formOptions, fieldKey, fallback = '') {
  const fromMap = formOptions?.defaultValueByFieldKey?.[fieldKey];
  if (fromMap != null && String(fromMap).trim() !== '') return String(fromMap);
  const fromQuestion = (formOptions?.questions || []).find((q) => q?.fieldKey === fieldKey);
  if (fromQuestion?.defaultValue != null && String(fromQuestion.defaultValue).trim() !== '') {
    return String(fromQuestion.defaultValue);
  }
  return fallback;
}

/**
 * 學生端是否可修改此欄。
 * @param {boolean} fallback 無 schema 標記時的預設（通訊地址建議傳 false）
 */
export function fieldStudentEditable(formOptions, fieldKey, fallback = true) {
  const fromMap = formOptions?.studentEditableByFieldKey?.[fieldKey];
  if (fromMap !== undefined) return fromMap !== false;
  const fromQuestion = (formOptions?.questions || []).find((q) => q?.fieldKey === fieldKey);
  if (fromQuestion && fromQuestion.studentEditable !== undefined) {
    return fromQuestion.studentEditable !== false;
  }
  return fallback;
}

export function sectionTitleOf(formOptions, sectionId, fallback) {
  const title = formOptions?.sectionsById?.[sectionId]?.title;
  return (title != null && String(title).trim() !== '') ? String(title) : fallback;
}

export function fieldOptionPairs(formOptions, fieldKey, fallbackPairs = []) {
  const pairs = formOptions?.optionPairsByFieldKey?.[fieldKey];
  if (Array.isArray(pairs) && pairs.length > 0) return pairs;
  return toOptionPairs(fallbackPairs);
}
