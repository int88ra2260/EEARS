/**
 * 題目連動顯示（visibleWhen）
 * 例：{ fieldKey: 'hasDisabilityCard', equals: '是' }
 * 或：{ fieldKey: 'hasDisabilityCard', in: ['是'] }
 */

export function normalizeVisibleWhen(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const fieldKey = String(raw.fieldKey || raw.field || '').trim();
  if (!fieldKey) return null;

  if (Array.isArray(raw.in) && raw.in.length > 0) {
    return {
      fieldKey,
      in: raw.in.map((v) => String(v)),
    };
  }

  if (raw.equals != null && String(raw.equals) !== '') {
    return {
      fieldKey,
      equals: String(raw.equals),
    };
  }

  if (raw.value != null && String(raw.value) !== '') {
    return {
      fieldKey,
      equals: String(raw.value),
    };
  }

  return { fieldKey, equals: '是' };
}

export function evaluateVisibleWhen(rule, answers = {}) {
  const normalized = normalizeVisibleWhen(rule);
  if (!normalized) return true;

  const current = answers?.[normalized.fieldKey];
  const currentStr = current == null ? '' : String(current);

  if (Array.isArray(normalized.in)) {
    return normalized.in.map(String).includes(currentStr);
  }

  return currentStr === String(normalized.equals);
}

/**
 * @param {object|null} question schema question
 * @param {object} answers formData / extraAnswers 合併後亦可
 * @param {{ fallback?: boolean }} [opts] 無 visibleWhen 時的預設（true=顯示）
 */
export function isQuestionVisibleForAnswers(question, answers, opts = {}) {
  if (!question || question.visible === false) return false;
  if (!question.visibleWhen) {
    return opts.fallback !== undefined ? Boolean(opts.fallback) : true;
  }
  return evaluateVisibleWhen(question.visibleWhen, answers);
}

export function findQuestionByFieldKey(questions, fieldKey) {
  return (questions || []).find((q) => q && q.fieldKey === fieldKey) || null;
}

/** 依 fieldKey 判斷連動是否顯示；無 schema 規則時可用 hardcodedFallback */
export function isFieldVisibleWithLinkage(questions, fieldKey, answers, hardcodedFallback) {
  const q = findQuestionByFieldKey(questions, fieldKey);
  if (q?.visible === false) return false;
  if (q?.visibleWhen) return evaluateVisibleWhen(q.visibleWhen, answers);
  if (typeof hardcodedFallback === 'boolean') return hardcodedFallback;
  return true;
}
