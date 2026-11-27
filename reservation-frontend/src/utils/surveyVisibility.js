/**
 * 問卷題目顯示條件。
 * 後端有一份相同判斷：reservation-backend/utils/surveyVisibility.js
 * 改條件時兩邊一起改。
 */

export function asList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (value == null || value === '') return [];
  return [String(value)];
}

export function matchesWhen(when, data) {
  if (!when || typeof when !== 'object') return true;
  if (Array.isArray(when.all)) return when.all.every((rule) => matchesWhen(rule, data));
  if (Array.isArray(when.any)) return when.any.some((rule) => matchesWhen(rule, data));
  const list = asList(data?.[when.questionId]);
  if (Object.prototype.hasOwnProperty.call(when, 'equals')) {
    return list.length === 1 && list[0] === String(when.equals);
  }
  if (Object.prototype.hasOwnProperty.call(when, 'notEquals')) {
    return list.length > 0 && list[0] !== String(when.notEquals);
  }
  if (Array.isArray(when.includesAny)) {
    const wanted = when.includesAny.map(String);
    return wanted.some((item) => list.includes(item));
  }
  return true;
}

export function isQuestionVisible(question, data) {
  if (!question || !question.visibleWhen) return true;
  return matchesWhen(question.visibleWhen, data || {});
}

/** 依題目順序拿掉目前不該出現的答案，後面的題目就不會被舊答案打開。 */
export function applySurveyVisibility(data, questions) {
  const next = { ...(data || {}) };
  for (const question of questions || []) {
    if (!question || !question.id) continue;
    if (!isQuestionVisible(question, next)) delete next[question.id];
  }
  return next;
}

function isEmptyAnswer(question, value) {
  if (value === undefined || value === null || value === '') return true;
  if (question.type === 'checkbox' && Array.isArray(value) && value.length === 0) return true;
  return false;
}

/** 與後端 validateSurveyData 對可見題目的必填判斷對齊，供送出前先標出缺題。 */
export function validateVisibleAnswers(data, questions) {
  const visibleData = applySurveyVisibility(data, questions);
  for (const question of questions || []) {
    if (!question || !question.id) continue;
    if (!isQuestionVisible(question, visibleData)) continue;
    const value = visibleData[question.id];
    if (question.required && isEmptyAnswer(question, value)) {
      return { ok: false, id: question.id, error: `請填寫：${question.label}`, data: visibleData };
    }
    if (question.exclusiveValue && Array.isArray(value)
      && value.includes(question.exclusiveValue) && value.length > 1) {
      return {
        ok: false,
        id: question.id,
        error: `${question.label}選了「${question.exclusiveValue}」時，請不要同時選其他項目`,
        data: visibleData,
      };
    }
    if (question.type === 'checkbox' && Array.isArray(value) && question.maxSelect) {
      const max = Number(question.maxSelect);
      if (Number.isFinite(max) && max > 0 && value.length > max) {
        return { ok: false, id: question.id, error: `${question.label}最多選 ${max} 項`, data: visibleData };
      }
    }
    if (!isEmptyAnswer(question, value) && question.type === 'likert') {
      const score = parseInt(value, 10);
      if (Number.isNaN(score) || score < 1 || score > 5) {
        return { ok: false, id: question.id, error: `${question.label}分數必須在1-5之間`, data: visibleData };
      }
    }
  }
  return { ok: true, id: '', error: '', data: visibleData };
}
