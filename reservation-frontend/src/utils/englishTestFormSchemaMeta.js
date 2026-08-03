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
    sectionsById,
    questions: meta.questions || [],
  };
}

export function fieldLabel(formOptions, fieldKey, fallback) {
  const fromSchema = formOptions?.labelsByFieldKey?.[fieldKey];
  return (fromSchema != null && String(fromSchema).trim() !== '') ? String(fromSchema) : fallback;
}

export function fieldVisible(formOptions, fieldKey) {
  if (!formOptions?.visibleByFieldKey || formOptions.visibleByFieldKey[fieldKey] === undefined) {
    return true;
  }
  return formOptions.visibleByFieldKey[fieldKey] !== false;
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

export function sectionTitleOf(formOptions, sectionId, fallback) {
  const title = formOptions?.sectionsById?.[sectionId]?.title;
  return (title != null && String(title).trim() !== '') ? String(title) : fallback;
}

export function fieldOptionPairs(formOptions, fieldKey, fallbackPairs = []) {
  const pairs = formOptions?.optionPairsByFieldKey?.[fieldKey];
  if (Array.isArray(pairs) && pairs.length > 0) return pairs;
  return toOptionPairs(fallbackPairs);
}
