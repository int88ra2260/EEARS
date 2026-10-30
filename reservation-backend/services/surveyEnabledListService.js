'use strict';

const { Survey, SurveyRule } = require('../models');
const { EVENT_TYPE_TO_SURVEY_KEY, hasCompletedForGate, ruleTimeAllows } = require('./surveyGateService');
const { normalizeRetakePolicy, semesterStatusLabel } = require('./surveyRetakePolicy');
const { getCurrentSemester } = require('../utils/semester');

const ACTIVITY_TO_SURVEY_KEY = EVENT_TYPE_TO_SURVEY_KEY;

function activityTypeToEventTypes(activityType) {
  if (!activityType) return [];
  const eventTypeService = require('./eventTypeService');
  if (activityType === 'ET' || activityType === 'English Table' || activityType === 'english_table') {
    return eventTypeService.getEventTypeQueryValues('english_table');
  }
  if (activityType === 'EC' || activityType === 'English Club' || activityType === 'english_club') {
    return eventTypeService.getEventTypeQueryValues('english_club');
  }
  if (activityType === 'PUBLIC' || activityType === 'STANDALONE' || activityType === 'HOME') {
    return [];
  }
  return eventTypeService.getEventTypeQueryValues(activityType);
}

function isStandaloneActivityType(activityType) {
  const t = String(activityType || '').trim().toUpperCase();
  return !t || t === 'PUBLIC' || t === 'STANDALONE' || t === 'HOME';
}

function relatedTypesFromSurveyKey(surveyKey) {
  const key = String(surveyKey || '');
  if (key.startsWith('english_table_feedback')) return activityTypeToEventTypes('english_table');
  if (key.startsWith('english_club_feedback')) return activityTypeToEventTypes('english_club');
  const fromKey = Object.entries(ACTIVITY_TO_SURVEY_KEY).find(([, value]) => value === key);
  return fromKey ? [fromKey[0]] : [];
}

/** 學生端名稱跟啟用中的活動走，不把問卷代碼裡的學期寫進標題。 */
function studentFacingSurveyName(survey, activityType) {
  const activity = String(activityType || '');
  if (activity === 'ET' || activity === 'english_table' || activity === 'English Table') return 'English Table 問卷';
  if (activity === 'EC' || activity === 'english_club' || activity === 'English Club') return 'English Club 問卷';
  const key = String(survey?.surveyKey || '');
  if (key.startsWith('english_table_feedback')) return 'English Table 問卷';
  if (key.startsWith('english_club_feedback')) return 'English Club 問卷';
  const raw = String(survey?.title || survey?.name || survey?.surveyKey || '').trim();
  return raw.replace(/\s*[（(]\s*\d{3}-[12][^）)]*[）)]/g, '').trim() || raw;
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
      relatedEventTypes = relatedTypesFromSurveyKey(survey.surveyKey);
    }

    // 活動問卷：仍要求能對到 event type；獨立問卷可列出
    if (channel === 'activity' && !relatedEventTypes.length) continue;

    // 活動 Gate 清單過去只列必填；獨立問卷只要啟用即可出現在首頁選擇頁
    if (channel === 'activity' && !rule.isRequired) continue;

    out.push({
      surveyId: survey.surveyKey,
      surveyName: studentFacingSurveyName(survey, activityType),
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

/**
 * 登入學生的本學期問卷狀態。身分只用 session 學號，不接受呼叫端自填學號。
 */
async function listSemesterSurveyStatus(studentId) {
  const sid = String(studentId || '').trim();
  const items = await listEnabledActivitySurveys();
  const keys = items.map((item) => item.surveyId).filter(Boolean);
  const surveys = keys.length
    ? await Survey.findAll({
      where: { surveyKey: keys },
      include: [{ model: SurveyRule, required: false }],
    })
    : [];
  const byKey = new Map(surveys.map((row) => [row.surveyKey, row]));
  const out = [];
  for (const item of items) {
    const survey = byKey.get(item.surveyId);
    const rule = survey?.SurveyRule || null;
    const policy = normalizeRetakePolicy(rule);
    let filled = false;
    if (sid && survey && rule && !rule.isAnonymous && policy !== 'unlimited') {
      filled = await hasCompletedForGate({
        surveyId: survey.id,
        surveyKey: survey.surveyKey,
        rule,
        studentId: sid,
      });
    }
    out.push({
      ...item,
      filled,
      statusLabel: rule?.isAnonymous ? '可填寫' : semesterStatusLabel(filled, policy),
      retakePolicy: policy,
    });
  }
  return { currentSemester: getCurrentSemester(), surveys: out };
}

module.exports = {
  listEnabledActivitySurveys,
  listSemesterSurveyStatus,
  studentFacingSurveyName,
};
