'use strict';

const { Survey, SurveyRule } = require('../models');
const { EVENT_TYPE_TO_SURVEY_KEY, ruleTimeAllows } = require('./surveyGateService');

const ACTIVITY_TO_SURVEY_KEY = EVENT_TYPE_TO_SURVEY_KEY;

function activityTypeToEventTypes(activityType) {
  if (!activityType) return [];
  if (activityType === 'ET' || activityType === 'English Table') return ['English Table'];
  if (activityType === 'EC' || activityType === 'English Club') return ['English Club'];
  if (activityType === 'PUBLIC' || activityType === 'STANDALONE' || activityType === 'HOME') {
    return [];
  }
  return [activityType];
}

function isStandaloneActivityType(activityType) {
  const t = String(activityType || '').trim().toUpperCase();
  return !t || t === 'PUBLIC' || t === 'STANDALONE' || t === 'HOME';
}

/**
 * 公開列表：啟用中的問卷（供首頁／問卷選擇頁）
 * - 活動問卷：需能對到 ET／EC（或規則上的活動類型）
 * - 獨立／首頁問卷：activityType 為 PUBLIC／STANDALONE／HOME 或未指定活動類型
 */
async function listEnabledActivitySurveys(now = new Date()) {
  const rules = await SurveyRule.findAll({
    where: { isEnabled: true },
    include: [{ model: Survey, attributes: ['id', 'surveyKey', 'name', 'title'], required: true }],
    order: [['priority', 'ASC'], ['updatedAt', 'DESC']],
  });

  const out = [];
  for (const rule of rules) {
    const time = ruleTimeAllows(rule, now);
    if (!time.ok) continue;

    const survey = rule.Survey;
    if (!survey?.surveyKey) continue;

    const activityType = rule.activityType || rule.targetEventType;
    let relatedEventTypes = activityTypeToEventTypes(activityType);
    let channel = 'activity';

    if (isStandaloneActivityType(activityType)) {
      channel = 'standalone';
      relatedEventTypes = [];
    } else if (!relatedEventTypes.length) {
      const fromKey = Object.entries(ACTIVITY_TO_SURVEY_KEY).find(([, key]) => key === survey.surveyKey);
      if (fromKey) relatedEventTypes = [fromKey[0]];
    }

    // 活動問卷：仍要求能對到 event type；獨立問卷可列出
    if (channel === 'activity' && !relatedEventTypes.length) continue;

    // 活動 Gate 清單過去只列必填；獨立問卷只要啟用即可出現在首頁選擇頁
    if (channel === 'activity' && !rule.isRequired) continue;

    out.push({
      surveyId: survey.surveyKey,
      surveyName: survey.title || survey.name || survey.surveyKey,
      relatedEventTypes,
      channel,
      isRequired: !!rule.isRequired,
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
