/**
 * 預約 gating 與問卷狀態（產品化 survey_rules + legacy 相容）
 *
 * Gate 依活動類型 surveyGateEnabled；ET/EC 預設啟用。
 * surveyKey 優先由啟用規則（activityType）解析；找不到時才回退預設 key。
 */
const { Op } = require('sequelize');
const {
  Survey,
  SurveyRule,
  SurveyModuleResponse,
  EnglishTableSurveyResponse,
  EnglishClubSurveyResponse,
  Reservation,
  Event,
} = require('../models');
const { getCurrentSemester } = require('../utils/semester');
const { SEMESTER_RANGES, semesterIdFromDate, toTaipeiDateOnly } = require('../utils/semesterConstants');
const eventTypeService = require('./eventTypeService');
const { normalizeRetakePolicy } = require('./surveyRetakePolicy');

/** 換學期後仍可當後援；正式應以啟用規則綁定問卷為準 */
const EVENT_TYPE_TO_SURVEY_KEY = {
  english_table: 'english_table_feedback_114_1',
  'English Table': 'english_table_feedback_114_1',
  english_club: 'english_club_feedback_114_1',
  'English Club': 'english_club_feedback_114_1',
};

const EVENT_TYPE_ACTIVITY_ALIASES = {
  english_table: ['english_table', 'English Table', 'ET'],
  'English Table': ['english_table', 'English Table', 'ET'],
  english_club: ['english_club', 'English Club', 'EC'],
  'English Club': ['english_club', 'English Club', 'EC'],
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
  return eventTypeService.isSurveyGateEnabledForType(eventType);
}

function aliasesForEventType(eventType) {
  const cfg = eventTypeService.resolveTypeConfigSync(eventType);
  const code = cfg?.code;
  const fromMap = EVENT_TYPE_ACTIVITY_ALIASES[eventType] || EVENT_TYPE_ACTIVITY_ALIASES[code];
  if (fromMap?.length) return fromMap;
  if (!cfg) return [String(eventType || '').trim()].filter(Boolean);
  const set = new Set([cfg.code, cfg.displayName, cfg.abbreviation, ...(cfg.legacyAliases || [])].filter(Boolean));
  return Array.from(set);
}

async function findGateRuleByActivity(eventType) {
  const aliases = aliasesForEventType(eventType);
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

  const policy = normalizeRetakePolicy(rule);

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

function addUtcDays(ymd, days) {
  const [year, month, day] = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * 學期區間對半。115-1（2026-08-01～2027-01-31）上半到 2026-10-31，下半從 2026-11-01。
 */
function semesterHalves(semesterCode) {
  const range = SEMESTER_RANGES[semesterCode];
  if (!range?.start || !range?.end || range.start > range.end) return null;
  const startMs = Date.parse(`${range.start}T00:00:00Z`);
  const endMs = Date.parse(`${range.end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  const inclusive = Math.round((endMs - startMs) / 86400000) + 1;
  if (inclusive < 2) return null;
  const firstLen = Math.floor(inclusive / 2);
  const firstEnd = addUtcDays(range.start, firstLen - 1);
  const secondStart = addUtcDays(firstEnd, 1);
  return {
    semester: semesterCode,
    first: { start: range.start, end: firstEnd },
    second: { start: secondStart, end: range.end },
  };
}

async function hasPriorSameActivityReservation({ studentId, eventType, start, end, excludeEventId }) {
  const sid = String(studentId || '').trim();
  const types = eventTypeService.getEventTypeQueryValues(eventType);
  if (!sid || !types.length || !start || !end) return false;
  const where = { studentId: sid, checkinStatus: '已簽到' };
  if (excludeEventId != null && excludeEventId !== '') {
    where.eventId = { [Op.ne]: excludeEventId };
  }
  const row = await Reservation.findOne({
    attributes: ['id'],
    where,
    include: [{
      model: Event,
      required: true,
      attributes: [],
      where: {
        eventType: { [Op.in]: types },
        date: { [Op.between]: [start, end] },
      },
    }],
  });
  return !!row;
}

/**
 * 問卷從下半學期才開始要求。這個學期同一類活動已有簽到時，
 * 下半學期再預約就要先填；還沒簽到參加過的不擋。ET／EC 分開計算。
 */
async function surveyAppliesToBooking({ studentId, event, semesterCode }) {
  const eventDay = toTaipeiDateOnly(event?.date);
  if (!eventDay) return false;
  const semester = semesterCode || semesterIdFromDate(eventDay) || getCurrentSemester();
  const range = SEMESTER_RANGES[semester];
  const halves = semesterHalves(semester);
  if (!range?.start || !range?.end || !halves) return false;
  if (eventDay < halves.second.start || eventDay > halves.second.end) return false;
  return hasPriorSameActivityReservation({
    studentId,
    eventType: event?.eventType,
    start: range.start,
    end: range.end,
    excludeEventId: event?.id,
  });
}

/** 帳號頁：這個學期是否已簽到參加過同一類活動，因此再次預約前要先填問卷。 */
async function priorReservationRequiresSurvey({ studentId, eventTypes, semesterCode }) {
  const semester = semesterCode || getCurrentSemester();
  const range = SEMESTER_RANGES[semester];
  if (!range?.start || !range?.end) return false;
  const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
  for (const eventType of types) {
    if (!eventType) continue;
    const booked = await hasPriorSameActivityReservation({
      studentId,
      eventType,
      start: range.start,
      end: range.end,
    });
    if (booked) return true;
  }
  return false;
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
  semesterHalves,
  surveyAppliesToBooking,
  priorReservationRequiresSurvey,
};
