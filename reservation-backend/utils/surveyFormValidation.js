/**
 * 問卷表單驗證與正規化（與舊 surveyRouter 邏輯一致，供公開／後台共用）
 */

const { applySurveyVisibility, isQuestionVisible } = require('./surveyVisibility');

function isEmptyAnswer(question, value) {
  if (value === undefined || value === null || value === '') return true;
  if (question.type === 'checkbox' && Array.isArray(value) && value.length === 0) return true;
  return false;
}

function validateSurveyData(data, config) {
  const questions = config.questions || [];
  const visibleData = applySurveyVisibility(data, questions);
  for (const question of questions) {
    if (!question || !question.id) continue;
    if (!isQuestionVisible(question, visibleData)) continue;
    const value = visibleData[question.id];
    if (question.required && isEmptyAnswer(question, value)) {
      return { isValid: false, error: `請填寫：${question.label}` };
    }

    if (question.exclusiveValue && Array.isArray(value)
      && value.includes(question.exclusiveValue) && value.length > 1) {
      return { isValid: false, error: `${question.label}選了「${question.exclusiveValue}」時，請不要同時選其他項目` };
    }

    if (question.type === 'checkbox' && Array.isArray(value) && question.maxSelect) {
      const max = Number(question.maxSelect);
      if (Number.isFinite(max) && max > 0 && value.length > max) {
        return { isValid: false, error: `${question.label}最多選 ${max} 項` };
      }
    }

    if (!isEmptyAnswer(question, value) && question.type === 'likert') {
      const score = parseInt(value, 10);
      if (Number.isNaN(score) || score < 1 || score > 5) {
        return { isValid: false, error: `${question.label}分數必須在1-5之間` };
      }
    }

    if (!isEmptyAnswer(question, value) && question.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return { isValid: false, error: `${question.label}格式不正確` };
      }
    }
  }
  return { isValid: true };
}

function processSurveyData(data, config) {
  const processed = { ...data };
  const questions = config.questions || [];

  for (const question of questions) {
    if (question.type === 'checkbox' && data[question.id]) {
      if (Array.isArray(data[question.id])) {
        processed[question.id] = data[question.id];
      } else {
        processed[question.id] = [data[question.id]];
      }
    }
  }

  if (processed.studentName && !processed.name) {
    processed.name = processed.studentName;
  }
  if (processed.studentEmail && !processed.email) {
    processed.email = processed.studentEmail;
  }
  if (processed.interview_email && !processed.interviewEmail) {
    processed.interviewEmail = processed.interview_email;
  }
  if (processed.reason_attend && !processed.reasonAttend) {
    processed.reasonAttend = processed.reason_attend;
  }
  if (processed.information_channel && !processed.informationChannel) {
    processed.informationChannel = processed.information_channel;
  }
  if (processed.ability_improved && !processed.abilityImproved) {
    processed.abilityImproved = processed.ability_improved;
  }
  if (processed.ability_description && !processed.abilityDescription) {
    processed.abilityDescription = processed.ability_description;
  }
  if (processed.other_comments && !processed.otherComments) {
    processed.otherComments = processed.other_comments;
  }

  return processed;
}

module.exports = {
  validateSurveyData,
  processSurveyData,
};
