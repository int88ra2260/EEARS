const { SurveyVersion, SurveyResponseAnswer } = require('../models');
const { applyMappingsToAnswer } = require('./surveyAnswerMappingService');
const {
  isSurveyAnswerMetadataKey,
  resolveSurveyQuestionKeyAlias,
} = require('./surveyAnswerKeyRegistry');

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

async function normalizeAnswerItem(raw, schemaQuestions = [], surveyId = null, surveyVersionId = null) {
  const sourceKey = raw.questionKey;
  if (isSurveyAnswerMetadataKey(sourceKey)) {
    return {
      questionKey: sourceKey,
      mappedQuestionKey: sourceKey,
      questionTitle: sourceKey,
      questionType: 'metadata',
      rawAnswer: {
        answerText: raw.answerText,
        answerJson: raw.answerJson,
        scoreValue: raw.scoreValue,
      },
      normalizedAnswer: raw.answerText ?? raw.answerJson ?? raw.scoreValue,
      displayAnswer:
        raw.answerText != null && raw.answerText !== ''
          ? String(raw.answerText)
          : raw.scoreValue != null
            ? String(raw.scoreValue)
            : '-',
      hasSchemaMatch: true,
      isMetadataField: true,
      warningCode: null,
      warningMessage: null,
      appliedMappingId: null,
    };
  }

  const mapped = await applyMappingsToAnswer(raw, surveyId, surveyVersionId);
  const aliasedKey = resolveSurveyQuestionKeyAlias(mapped.mapped ? mapped.questionKey : raw.questionKey);
  const effectiveQuestionKey = mapped.mapped ? mapped.questionKey : aliasedKey;
  const q =
    schemaQuestions.find((x) => x.id === effectiveQuestionKey) ||
    schemaQuestions.find((x) => x.id === aliasedKey);
  const hasSchemaMatch = !!q;
  const questionType = raw.questionType || q?.type || 'unknown';

  let normalizedAnswer = raw.answerText;
  if (questionType === 'checkbox') {
    normalizedAnswer = raw.answerJson ? asArray(raw.answerJson) : asArray((raw.answerText || '').split('|').map((s) => s.trim()).filter(Boolean));
  } else if (questionType === 'likert') {
    normalizedAnswer = raw.scoreValue != null ? Number(raw.scoreValue) : Number(raw.answerText || 0);
  } else if (raw.answerJson && !raw.answerText) {
    normalizedAnswer = raw.answerJson;
  }

  let displayAnswer = '-';
  if (Array.isArray(normalizedAnswer)) displayAnswer = normalizedAnswer.join('、');
  else if (normalizedAnswer && typeof normalizedAnswer === 'object') displayAnswer = JSON.stringify(normalizedAnswer);
  else if (normalizedAnswer != null && normalizedAnswer !== '') displayAnswer = String(normalizedAnswer);

  return {
    questionKey: raw.questionKey,
    mappedQuestionKey: effectiveQuestionKey,
    questionTitle: q?.label || q?.title || raw.questionKey,
    questionType,
    rawAnswer: {
      answerText: raw.answerText,
      answerJson: raw.answerJson,
      scoreValue: raw.scoreValue,
    },
    normalizedAnswer,
    displayAnswer,
    hasSchemaMatch,
    warningCode: hasSchemaMatch ? null : 'SCHEMA_MISMATCH',
    warningMessage: hasSchemaMatch ? null : '答案題號無法對應目前版本 schema',
    appliedMappingId: mapped.mapping?.id || null,
  };
}

async function buildResponseDisplayModel({ response, schemaJson, rawAnswers, sourceOfSemesterInference, sourceOfVersionInference }) {
  const schemaQuestions = Array.isArray(schemaJson?.questions) ? schemaJson.questions : [];
  const normalizedAnswers = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const a of rawAnswers) {
    // eslint-disable-next-line no-await-in-loop
    normalizedAnswers.push(await normalizeAnswerItem(a, schemaQuestions, response.surveyId, response.surveyVersionId));
  }
  const questionAnswers = normalizedAnswers.filter((a) => !a.isMetadataField);
  const unmatchedAnswerCount = questionAnswers.filter((a) => !a.hasSchemaMatch).length;
  const warnings = [];
  if (!response.semesterId) warnings.push({ code: 'MISSING_SEMESTER', message: '此回覆缺少 semester linkage' });
  if (!response.surveyVersionId) warnings.push({ code: 'MISSING_VERSION', message: '此回覆缺少 surveyVersion linkage' });
  if (!schemaQuestions.length) warnings.push({ code: 'SCHEMA_MISSING', message: '找不到版本 schema，已使用 fallback 顯示' });
  if (unmatchedAnswerCount > 0) warnings.push({ code: 'UNMATCHED_ANSWERS', message: `有 ${unmatchedAnswerCount} 題無法對應 schema` });

  return {
    warnings,
    answers: normalizedAnswers,
    dataIntegrity: {
      hasSemester: !!response.semesterId,
      hasVersion: !!response.surveyVersionId,
      schemaMatchedCount: questionAnswers.length - unmatchedAnswerCount,
      unmatchedAnswerCount,
      metadataFieldCount: normalizedAnswers.length - questionAnswers.length,
      normalizedWithFallback: !schemaQuestions.length || unmatchedAnswerCount > 0,
      sourceOfSemesterInference: sourceOfSemesterInference || null,
      sourceOfVersionInference: sourceOfVersionInference || null,
    },
  };
}

async function normalizeSurveyResponseAnswers(response) {
  const schemaVersion = response?.surveyVersionId ? await SurveyVersion.findByPk(response.surveyVersionId) : null;
  const schemaJson = schemaVersion?.schemaJson || null;
  let rawAnswers = await SurveyResponseAnswer.findAll({ where: { responseId: response.id }, raw: true });

  if (!rawAnswers.length && response.answersJson && typeof response.answersJson === 'object') {
    rawAnswers = Object.entries(response.answersJson)
      .filter(([questionKey]) => !isSurveyAnswerMetadataKey(questionKey))
      .map(([questionKey, value]) => ({
        responseId: response.id,
        questionKey: resolveSurveyQuestionKeyAlias(questionKey),
        questionType: Array.isArray(value) ? 'checkbox' : typeof value === 'number' ? 'likert' : 'text',
        answerText: Array.isArray(value) || (value && typeof value === 'object') ? null : String(value ?? ''),
        answerJson: Array.isArray(value) || (value && typeof value === 'object') ? value : null,
        scoreValue: typeof value === 'number' ? value : null,
      }));
  }

  const sourceOfSemesterInference = response?.metadataJson?.sourceOfSemesterInference;
  const sourceOfVersionInference = response?.metadataJson?.sourceOfVersionInference;
  const display = await buildResponseDisplayModel({
    response,
    schemaJson,
    rawAnswers,
    sourceOfSemesterInference,
    sourceOfVersionInference,
  });
  return {
    schemaJson,
    ...display,
  };
}

module.exports = {
  normalizeSurveyResponseAnswers,
  buildResponseDisplayModel,
};
