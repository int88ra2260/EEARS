/**
 * 預約 gating 與問卷狀態（產品化 survey_rules + legacy 相容）
 *
 * Gate 僅對 English Table / English Club 生效。
 * surveyKey 優先由啟用規則（activityType）解析；找不到時才回退預設 key。
 */
const { Op } = require('sequelize');
const {
  Survey,
  SurveyRule,
  SurveyModuleResponse,
  EnglishTableSurveyResponse,
  EnglishClubSurveyResponse,
} = require('../models');
const { getCurrentSemester } = require('../utils/semester');

/** 換學期後仍可當後援；正式應以啟用規則綁定問卷為準 */
const EVENT_TYPE_TO_SURVEY_KEY = {
  'English Table': 'english_table_feedback_114_1',
  'English Club': 'english_club_feedback_114_1',
};

const EVENT_TYPE_ACTIVITY_ALIASES = {
  'English Table': ['English Table', 'ET'],
  'English Club': ['English Club', 'EC'],
};

function legacyModelForSurveyKey(surveyKey) {
  const key = String(surveyKey || '');
  if (
    key === 'english_table_feedback_114_1'
    || key.startsWith('english_table_feedback')
  ) {
    return EnglishTableSurveyResponse;
  }
  if (
    key === 'english_club_feedback_114_1'
    || key.startsWith('english_club_feedback')
  ) {
    return EnglishClubSurveyResponse;
  }
  return null;
}

function isGateEventType(eventType) {
  return eventType === 'English Table' || eventType === 'English Club';
}

async function findGateRuleByActivity(eventType) {
  const aliases = EVENT_TYPE_ACTIVITY_ALIASES[eventType];
  if (!aliases?.length) return null;

  const rules = await SurveyRule.findAll({
    where: {
      isEnabled: true,
      [Op.or]: [
        { activityType: { [Op.in]: aliases } },
        { targetEventType: { [Op.in]: aliases } },
      ],
    },
    include: [{ model: Survey, required: true }],
    order: [['priority', 'ASC'], ['updatedAt', 'DESC']],
  });

  if (!rules.length) return null;
  const preferred = rules.find((r) => r.isRequired) || rules[0];
  return preferred;
}

async function findGateContextByFallbackKey(eventType) {
  const surveyKey = EVENT_TYPE_TO_SURVEY_KEY[eventType];
  if (!surveyKey) return null;

  const survey = await Survey.findOne({ where: { surveyKey } });
  if (!survey) return null;

  const rule = await SurveyRule.findOne({ where: { surveyId: survey.id } });
  if (!rule) return null;

  return { mode: 'product', survey, rule, surveyKey, source: 'fallback_key' };
}

/**
 * @returns {Promise<{ mode: 'product', survey: any, rule: any, surveyKey: string, source?: string } | { mode: 'legacy' }>}
 */
async function resolveGateContext(eventType) {
  if (!isGateEventType(eventType)) {
    return { mode: 'legacy' };
  }

  const matchedRule = await findGateRuleByActivity(eventType);
  if (matchedRule?.Survey?.surveyKey) {
    return {
      mode: 'product',
      survey: matchedRule.Survey,
      rule: matchedRule,
      surveyKey: matchedRule.Survey.surveyKey,
      source: 'survey_rule',
    };
  }

  const fallback = await findGateContextByFallbackKey(eventType);
  if (fallback) return fallback;

  return { mode: 'legacy' };
}

/**
 * 是否已有符合重填規則的完成紀錄（legacy 與 survey_responses；semester 可指定或預設當前學期）
 */
async function hasCompletedForGateWithSemester({
  surveyId,
  surveyKey,
  rule,
  studentId,
  eventId,
  semesterCode,
}) {
  const sid = String(studentId || '').trim();
  if (!sid) return false;

  const semester = semesterCode || getCurrentSemester();

  const LegacyModel = legacyModelForSurveyKey(surveyKey);
  if (LegacyModel) {
    const legacyRow = await LegacyModel.findOne({ where: { studentId: sid, semester } });
    if (legacyRow) return true;
  }

  if (!rule || surveyId == null) {
    return false;
  }

  const policy = rule.retakePolicy || 'once_ever';

  if (policy === 'unlimited') {
    return false;
  }

  if (policy === 'once_per_event') {
    if (eventId == null) return false;
    const row = await SurveyModuleResponse.findOne({
      where: { surveyId, studentId: sid, status: 'completed', eventId },
    });
    return !!row;
  }

  const row = await SurveyModuleResponse.findOne({
    where: { surveyId, studentId: sid, status: 'completed', semester },
  });
  return !!row;
}

/** @deprecated 介面保留；行為等同未傳 semesterCode 的 hasCompletedForGateWithSemester */
async function hasCompletedForGate(params) {
  return hasCompletedForGateWithSemester(params);
}

function ruleTimeAllows(rule, now = new Date()) {
  const startAt = rule.startAt || rule.startDate;
  const endAt = rule.endAt || rule.endDate;
  if (startAt && new Date(startAt) > now) {
    return { ok: false, reason: 'not_started' };
  }
  if (endAt && new Date(endAt) < now) {
    return { ok: false, reason: 'ended' };
  }
  return { ok: true };
}

module.exports = {
  EVENT_TYPE_TO_SURVEY_KEY,
  EVENT_TYPE_ACTIVITY_ALIASES,
  legacyModelForSurveyKey,
  isGateEventType,
  resolveGateContext,
  hasCompletedForGate,
  hasCompletedForGateWithSemester,
  ruleTimeAllows,
};
