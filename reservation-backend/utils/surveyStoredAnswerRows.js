'use strict';

const {
  isSurveyAnswerMetadataKey,
  resolveSurveyQuestionKeyAlias,
} = require('../services/surveyAnswerKeyRegistry');

function parseLikertScore(value) {
  if (value == null || value === '' || typeof value === 'object') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return n;
}

function inferQuestionType(questionKey, value) {
  if (Array.isArray(value)) return 'checkbox';
  if (parseLikertScore(value) != null && /^q\d+$/i.test(questionKey)) return 'likert';
  return 'text';
}

/**
 * 把公開送出或 answersJson 轉成 survey_response_answers 列。
 * 受訪者欄位不寫入；同一題的別名與正式題號只留一列。
 */
function asAnswerObject(answers) {
  if (typeof answers === 'string') {
    try {
      const parsed = JSON.parse(answers);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }
  return answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
}

function buildStoredAnswerRows(answers, schemaQuestions = []) {
  const source = asAnswerObject(answers);
  const typeById = new Map();
  (schemaQuestions || []).forEach((question) => {
    if (question && question.id) typeById.set(String(question.id), question.type || null);
  });

  const byKey = new Map();
  Object.entries(source).forEach(([rawKey, value]) => {
    if (value == null || value === '') return;
    if (isSurveyAnswerMetadataKey(rawKey)) return;
    const questionKey = resolveSurveyQuestionKeyAlias(rawKey);
    if (!questionKey || isSurveyAnswerMetadataKey(questionKey)) return;
    const incomingIsAlias = questionKey !== String(rawKey).trim();
    if (byKey.has(questionKey) && incomingIsAlias) return;
    const questionType = typeById.get(questionKey) || inferQuestionType(questionKey, value);
    byKey.set(questionKey, toStoredRow(questionKey, questionType, value));
  });
  return [...byKey.values()];
}

function toStoredRow(questionKey, questionType, value) {
  if (questionType === 'likert') {
    const score = parseLikertScore(value);
    return {
      questionKey,
      questionType,
      answerText: score == null ? String(value) : String(score),
      answerJson: null,
      scoreValue: score,
    };
  }
  if (questionType === 'checkbox' || Array.isArray(value)) {
    const items = Array.isArray(value) ? value : [value];
    return {
      questionKey,
      questionType: questionType || 'checkbox',
      answerText: null,
      answerJson: items,
      scoreValue: null,
    };
  }
  if (value && typeof value === 'object') {
    return {
      questionKey,
      questionType: questionType || 'text',
      answerText: null,
      answerJson: value,
      scoreValue: null,
    };
  }
  return {
    questionKey,
    questionType: questionType || 'text',
    answerText: String(value),
    answerJson: null,
    scoreValue: null,
  };
}

function activityTypeForSurveyKey(surveyKey) {
  const key = String(surveyKey || '');
  if (key.startsWith('english_table_feedback')) return 'English Table';
  if (key.startsWith('english_club_feedback')) return 'English Club';
  return null;
}

module.exports = {
  buildStoredAnswerRows,
  activityTypeForSurveyKey,
};
