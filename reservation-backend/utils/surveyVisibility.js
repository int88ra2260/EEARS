'use strict';

/**
 * 問卷題目顯示條件。
 * 前端有一份相同判斷：reservation-frontend/src/utils/surveyVisibility.js
 * 改條件時兩邊一起改。
 */

function asList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (value == null || value === '') return [];
  return [String(value)];
}

function matchesWhen(when, data) {
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

function isQuestionVisible(question, data) {
  if (!question || !question.visibleWhen) return true;
  return matchesWhen(question.visibleWhen, data || {});
}

/** 依題目順序拿掉目前不該出現的答案，後面的題目就不會被舊答案打開。 */
function applySurveyVisibility(data, questions) {
  const next = { ...(data || {}) };
  for (const question of questions || []) {
    if (!question || !question.id) continue;
    if (!isQuestionVisible(question, next)) delete next[question.id];
  }
  return next;
}

module.exports = {
  asList,
  matchesWhen,
  isQuestionVisible,
  applySurveyVisibility,
};
