const { Op } = require('sequelize');
const { Event, SurveyModuleResponse, SurveyRule } = require('../models');

const VALID_RESPONSE_WHERE = { surveyId: { [Op.ne]: null } };
const { normalizeSurveyResponseAnswers } = require('./surveyResponseNormalizationService');
const { detectRuleConflicts } = require('./surveyRuleEvaluationService');
const { backfillEventSemesters, backfillResponseLinks } = require('./surveyDataGovernanceService');

async function getHealthOverview() {
  const totalResponses = await SurveyModuleResponse.count({ where: VALID_RESPONSE_WHERE });
  const orphanResponses = await SurveyModuleResponse.count({ where: { surveyId: null } });
  const missingSemesterCount = await SurveyModuleResponse.count({
    where: { ...VALID_RESPONSE_WHERE, semesterId: null },
  });
  const missingVersionCount = await SurveyModuleResponse.count({
    where: { ...VALID_RESPONSE_WHERE, surveyVersionId: null },
  });
  const eventsMissingSemester = await Event.count({ where: { semesterId: null } });

  const scanLimit = Math.min(totalResponses, 800);
  const sample = await SurveyModuleResponse.findAll({
    where: VALID_RESPONSE_WHERE,
    limit: scanLimit,
    order: [['updatedAt', 'DESC']],
  });
  let unmatchedAnswersCount = 0;
  let fallbackRenderedResponsesCount = 0;
  let responsesWithUnmatched = 0;
  for (const r of sample) {
    const n = await normalizeSurveyResponseAnswers(r);
    const u = Number(n?.dataIntegrity?.unmatchedAnswerCount || 0);
    unmatchedAnswersCount += u;
    if (u > 0) responsesWithUnmatched += 1;
    if (n?.dataIntegrity?.normalizedWithFallback && u > 0) fallbackRenderedResponsesCount += 1;
  }

  return {
    responsesTotal: totalResponses,
    orphanResponses,
    missingSemesterCount,
    missingVersionCount,
    unresolvedSemesterCount: missingSemesterCount,
    unresolvedVersionCount: missingVersionCount,
    unmatchedAnswersCount,
    responsesWithUnmatched,
    fallbackRenderedResponsesCount,
    eventsMissingSemester,
    sampleSizeForNormalization: sample.length,
    normalizationScanComplete: scanLimit >= totalResponses,
  };
}

async function getHealthProblems() {
  const [responsesMissingSemester, responsesMissingVersion, eventsMissingSemester] = await Promise.all([
    SurveyModuleResponse.findAll({
      where: { ...VALID_RESPONSE_WHERE, semesterId: null },
      limit: 200,
      order: [['submittedAt', 'DESC']],
    }),
    SurveyModuleResponse.findAll({
      where: { ...VALID_RESPONSE_WHERE, surveyVersionId: null },
      limit: 200,
      order: [['submittedAt', 'DESC']],
    }),
    Event.findAll({ where: { semesterId: null }, limit: 200, order: [['id', 'DESC']] }),
  ]);

  const answerIssues = [];
  const scanForAnswers = await SurveyModuleResponse.findAll({
    where: VALID_RESPONSE_WHERE,
    limit: 300,
    order: [['submittedAt', 'DESC']],
  });
  for (const r of scanForAnswers) {
    const n = await normalizeSurveyResponseAnswers(r);
    if (n.dataIntegrity.unmatchedAnswerCount > 0) {
      answerIssues.push({
        responseId: r.id,
        unmatchedAnswerCount: n.dataIntegrity.unmatchedAnswerCount,
      });
    }
  }

  return {
    responsesMissingSemester,
    responsesMissingVersion,
    responsesWithUnmatchedAnswers: answerIssues,
    eventsMissingSemester,
  };
}

async function getRuleHealth() {
  const rules = await SurveyRule.findAll();
  const { conflicts } = detectRuleConflicts(rules);
  return {
    totalRules: rules.length,
    conflictCount: conflicts.length,
    conflicts,
  };
}

async function dataQualityForWhere(where = {}) {
  const totalBaseResponses = await SurveyModuleResponse.count({ where });
  const missingSemesterCount = await SurveyModuleResponse.count({ where: { ...where, semesterId: null } });
  const missingVersionCount = await SurveyModuleResponse.count({ where: { ...where, surveyVersionId: null } });
  const sample = await SurveyModuleResponse.findAll({ where, limit: Math.min(totalBaseResponses, 100), order: [['updatedAt', 'DESC']] });
  let fallbackNormalizedCount = 0;
  let unmatchedAnswersCount = 0;
  for (const r of sample) {
    const n = await normalizeSurveyResponseAnswers(r);
    if (n?.dataIntegrity?.normalizedWithFallback) fallbackNormalizedCount += 1;
    unmatchedAnswersCount += Number(n?.dataIntegrity?.unmatchedAnswerCount || 0);
  }
  const excludedResponses = missingSemesterCount + missingVersionCount;
  return {
    totalBaseResponses,
    excludedResponses,
    missingSemesterCount,
    missingVersionCount,
    fallbackNormalizedCount,
    unmatchedAnswersCount,
  };
}

async function recheckSemester({ dryRun = true } = {}) {
  const [eventReport, responseReport] = await Promise.all([backfillEventSemesters({ dryRun }), backfillResponseLinks({ dryRun })]);
  return { dryRun, eventReport, responseReport };
}

async function recheckVersion({ dryRun = true } = {}) {
  const responseReport = await backfillResponseLinks({ dryRun });
  return { dryRun, responseReport };
}

async function recheckAnswers({ dryRun = true } = {}) {
  const rows = await SurveyModuleResponse.findAll({ limit: 300, order: [['updatedAt', 'DESC']] });
  let fallback = 0;
  let unmatched = 0;
  for (const r of rows) {
    const n = await normalizeSurveyResponseAnswers(r);
    if (n.dataIntegrity.normalizedWithFallback) fallback += 1;
    unmatched += Number(n.dataIntegrity.unmatchedAnswerCount || 0);
  }
  return {
    dryRun,
    sampledResponses: rows.length,
    fallbackNormalizedResponses: fallback,
    unmatchedAnswersCount: unmatched,
    note: 'answers recheck is read-only scan',
  };
}

module.exports = {
  getHealthOverview,
  getHealthProblems,
  getRuleHealth,
  dataQualityForWhere,
  recheckSemester,
  recheckVersion,
  recheckAnswers,
};
