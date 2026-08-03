'use strict';

const { Survey, SurveyRule } = require('../models');
const { EVENT_TYPE_TO_SURVEY_KEY, ruleTimeAllows } = require('./surveyGateService');

const EVENT_TYPE_LABELS = {
  ET: 'English Table',
  EC: 'English Club',
};

const ACTIVITY_TO_SURVEY_KEY = EVENT_TYPE_TO_SURVEY_KEY;

function activityTypeToEventTypes(activityType) {
  if (!activityType) return [];
  if (activityType === 'ET' || activityType === 'English Table') return ['English Table'];
  if (activityType === 'EC' || activityType === 'English Club') return ['English Club'];
  return [activityType];
}

/**
 * 公開列表：目前依 survey_rules 判定「啟用中」的活動問卷（供首頁／活動頁提示）
 */
async function listEnabledActivitySurveys(now = new Date()) {
  const rules = await SurveyRule.findAll({
    where: { isEnabled: true, isRequired: true },
    include: [{ model: Survey, attributes: ['id', 'surveyKey', 'name', 'title'], required: true }],
  });

  const out = [];
  for (const rule of rules) {
    const time = ruleTimeAllows(rule, now);
    if (!time.ok) continue;

    const survey = rule.Survey;
    if (!survey?.surveyKey) continue;

    let relatedEventTypes = activityTypeToEventTypes(rule.activityType || rule.targetEventType);
    if (!relatedEventTypes.length) {
      const fromKey = Object.entries(ACTIVITY_TO_SURVEY_KEY).find(([, key]) => key === survey.surveyKey);
      if (fromKey) relatedEventTypes = [fromKey[0]];
    }
    if (!relatedEventTypes.length) continue;

    out.push({
      surveyId: survey.surveyKey,
      surveyName: survey.title || survey.name || survey.surveyKey,
      relatedEventTypes,
    });
  }

  const seen = new Set();
  return out.filter((item) => {
    const k = item.surveyId;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

module.exports = { listEnabledActivitySurveys };
