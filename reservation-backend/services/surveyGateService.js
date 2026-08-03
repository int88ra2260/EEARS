/**
 * 預約 gating 與問卷狀態（產品化 survey_rules + legacy 相容）
 */
const {
  Survey,
  SurveyRule,
  SurveyModuleResponse,
  EnglishTableSurveyResponse,
  EnglishClubSurveyResponse,
} = require('../models');
const { getCurrentSemester } = require('../utils/semester');

const EVENT_TYPE_TO_SURVEY_KEY = {
  'English Table': 'english_table_feedback_114_1',
  'English Club': 'english_club_feedback_114_1',
};

function legacyModelForSurveyKey(surveyKey) {
  if (surveyKey === 'english_table_feedback_114_1') return EnglishTableSurveyResponse;
  if (surveyKey === 'english_club_feedback_114_1') return EnglishClubSurveyResponse;
  return null;
}

/**
 * @returns {Promise<{ mode: 'product', survey: any, rule: any, surveyKey: string } | { mode: 'legacy' }>}
 */
async function resolveGateContext(eventType) {
  const surveyKey = EVENT_TYPE_TO_SURVEY_KEY[eventType];
  if (!surveyKey) return { mode: 'legacy' };

  const survey = await Survey.findOne({ where: { surveyKey } });
  if (!survey) return { mode: 'legacy' };

  const rule = await SurveyRule.findOne({ where: { surveyId: survey.id } });
  if (!rule) return { mode: 'legacy' };

  return { mode: 'product', survey, rule, surveyKey };
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
  legacyModelForSurveyKey,
  resolveGateContext,
  hasCompletedForGate,
  hasCompletedForGateWithSemester,
  ruleTimeAllows,
};
