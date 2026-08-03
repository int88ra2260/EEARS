const { maskEmail } = require('./piiMask');

const EMAIL_QUESTION_KEY_RE = /^(studentemail|email|contactemail|respondentemail)$/i;

function isEmailQuestionKey(key) {
  return EMAIL_QUESTION_KEY_RE.test(String(key || '').trim());
}

function maskEmailLikeString(value) {
  if (value == null || value === '') return value;
  const s = String(value);
  if (!s.includes('@')) return s;
  return maskEmail(s);
}

/**
 * 問卷填答後台一般 API：遮蔽 email 欄位。
 * 完整 studentEmail 僅限 CAN_EXPORT_SURVEY_RESPONSES 匯出流程（__forExport）使用。
 */
function maskSurveyResponseForAdminApi(record) {
  if (record == null) return record;
  const data = record && typeof record.toJSON === 'function' ? record.toJSON() : { ...record };
  const raw = data.studentEmail || data.email || '';
  const studentEmailMasked = raw ? maskEmail(raw) : null;

  const out = { ...data };
  if ('studentEmail' in data) {
    out.studentEmail = studentEmailMasked;
    out.studentEmailMasked = studentEmailMasked;
  }
  if ('email' in data) {
    out.email = studentEmailMasked;
    out.emailMasked = studentEmailMasked;
  }
  return out;
}

function maskSurveyResponseListForAdminApi(records) {
  if (!Array.isArray(records)) return records;
  return records.map(maskSurveyResponseForAdminApi);
}

function maskSurveyAnswerForAdminApi(answer) {
  if (!answer || typeof answer !== 'object') return answer;
  const emailLike =
    isEmailQuestionKey(answer.questionKey)
    || isEmailQuestionKey(answer.mappedQuestionKey)
    || answer.questionType === 'email';

  if (!emailLike) return answer;

  const maskVal = (v) => {
    if (v == null) return v;
    if (typeof v === 'string') return maskEmailLikeString(v);
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? maskEmailLikeString(x) : x));
    return v;
  };

  return {
    ...answer,
    displayAnswer: maskVal(answer.displayAnswer),
    normalizedAnswer: maskVal(answer.normalizedAnswer),
    rawAnswer: answer.rawAnswer
      ? {
          ...answer.rawAnswer,
          answerText: answer.rawAnswer.answerText != null ? maskVal(answer.rawAnswer.answerText) : answer.rawAnswer.answerText,
        }
      : answer.rawAnswer,
  };
}

function maskSurveyResponseDetailForAdminApi(detail) {
  if (!detail) return detail;
  const response = detail.response
    ? maskSurveyResponseForAdminApi(
        detail.response && typeof detail.response.toJSON === 'function'
          ? detail.response.toJSON()
          : detail.response
      )
    : detail.response;

  return {
    ...detail,
    response,
    answers: Array.isArray(detail.answers)
      ? detail.answers.map(maskSurveyAnswerForAdminApi)
      : detail.answers,
  };
}

module.exports = {
  isEmailQuestionKey,
  maskSurveyResponseForAdminApi,
  maskSurveyResponseListForAdminApi,
  maskSurveyResponseDetailForAdminApi,
};
