'use strict';

const { assertCanAccessSurveyById } = require('./accessControl/surveyScopeGuard');
const { buildAnalyticsWhere } = require('./surveyCenterService');
const { loadAssociationRecords, loadVersionContext } = require('./surveyAnswerReadService');
const { buildItemRelations } = require('../utils/surveyAssociationMath');

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function clampMinN(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 10;
  return Math.min(50, Math.max(5, Math.round(n)));
}

async function itemRelations(query = {}, user = null) {
  const versionId = Number(query.versionId);
  if (!Number.isInteger(versionId) || versionId <= 0) {
    throw httpError(400, 'SURVEY_VERSION_REQUIRED', '請先選擇單一問卷版本，再計算題目關聯。');
  }

  const context = await loadVersionContext(versionId);
  if (!context) {
    throw httpError(404, 'SURVEY_VERSION_NOT_FOUND', '找不到這個問卷版本。');
  }
  if (query.surveyId != null && query.surveyId !== '' && Number(query.surveyId) !== Number(context.version.surveyId)) {
    throw httpError(400, 'SURVEY_VERSION_MISMATCH', '問卷版本不屬於目前選擇的問卷。');
  }

  await assertCanAccessSurveyById(user, context.version.surveyId);

  const where = buildAnalyticsWhere({
    ...query,
    surveyId: context.version.surveyId,
    versionId,
  });
  const { records, eventLabels } = await loadAssociationRecords({
    where,
    questions: context.questions,
  });

  return buildItemRelations({
    records,
    schemaQuestions: context.questions,
    groupBy: query.groupBy,
    minN: clampMinN(query.minN),
    eventLabels,
    versionId,
    versionNumber: context.version.versionNumber,
    surveyId: context.version.surveyId,
  });
}

module.exports = {
  clampMinN,
  itemRelations,
};
