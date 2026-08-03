/**
 * Phase 0：問卷 Gate 設定與規則診斷
 * 用法：node scripts/phase0-survey-gate-check.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { getFeatureFlag } = require('../utils/featureFlags');
const { getCurrentSemester } = require('../utils/semester');
const { Survey, SurveyRule, Event, Settings } = require('../models');
const { resolveGateContext, hasCompletedForGate } = require('../services/surveyGateService');

const SURVEY_KEYS = {
  'English Table': 'english_table_feedback_114_1',
  'English Club': 'english_club_feedback_114_1',
};

const TEST_STUDENT_ID = process.env.PHASE0_TEST_STUDENT_ID || 'B999999999';

function inDateRange(rule, now = new Date()) {
  if (rule.startDate && new Date(rule.startDate) > now) return { ok: false, reason: 'not_started' };
  if (rule.endDate && new Date(rule.endDate) < now) return { ok: false, reason: 'ended' };
  return { ok: true };
}

async function checkFeatureFlag() {
  const envDefault = process.env.FEATURE_SURVEY_GATE !== 'false';
  const enabled = await getFeatureFlag('SURVEY_GATE_ENABLED', true);
  const dbRow = await Settings.findOne({ where: { key: 'feature_flag_SURVEY_GATE_ENABLED' } });
  return {
    enabled,
    envDefault,
    dbOverride: dbRow ? dbRow.value : null,
    pass: enabled === true,
  };
}

async function checkSurveyRule(eventType) {
  const surveyKey = SURVEY_KEYS[eventType];
  const now = new Date();
  const semester = getCurrentSemester();
  const ctx = await resolveGateContext(eventType);

  const row = {
    eventType,
    surveyKey,
    semester,
    mode: ctx.mode,
    pass: false,
    issues: [],
  };

  if (ctx.mode !== 'product') {
    row.issues.push('產品化 survey+rule 不存在，將走 legacy survey_settings');
    row.pass = null;
    return row;
  }

  const { survey, rule } = ctx;
  row.surveyId = survey.id;
  row.rule = {
    isEnabled: rule.isEnabled,
    isRequired: rule.isRequired,
    startDate: rule.startDate,
    endDate: rule.endDate,
    retakePolicy: rule.retakePolicy,
  };

  if (!rule.isEnabled) row.issues.push('rule.isEnabled = false');
  if (!rule.isRequired) row.issues.push('rule.isRequired = false');
  const dates = inDateRange(rule, now);
  if (!dates.ok) row.issues.push(`日期範圍：${dates.reason}`);

  row.pass = row.issues.length === 0;
  return row;
}

async function findSampleEvent(eventType) {
  const { Op } = require('sequelize');
  const now = new Date();
  return Event.findOne({
    where: {
      eventType,
      date: { [Op.gte]: now.toISOString().slice(0, 10) },
    },
    order: [['date', 'ASC']],
    attributes: ['id', 'name', 'eventType', 'date', 'maxCapacity'],
  });
}

async function simulateGate409(eventType, studentId) {
  const event = await findSampleEvent(eventType);
  if (!event) return { eventType, skip: true, reason: '找不到未來 ET/EC 活動' };

  const ctx = await resolveGateContext(eventType);
  if (ctx.mode !== 'product') {
    return { eventType, eventId: event.id, skip: true, reason: 'legacy mode' };
  }

  const completed = await hasCompletedForGate({
    surveyId: ctx.survey.id,
    surveyKey: ctx.surveyKey,
    rule: ctx.rule,
    studentId,
    eventId: event.id,
  });

  return {
    eventType,
    eventId: event.id,
    eventName: event.name,
    studentId,
    wouldBlock: !completed && ctx.rule.isEnabled && ctx.rule.isRequired && inDateRange(ctx.rule).ok,
    completed,
  };
}

(async () => {
  console.log('=== Phase 0: Survey Gate Check ===\n');
  console.log('日期:', new Date().toISOString());
  console.log('當前學期 (getCurrentSemester):', getCurrentSemester());
  console.log('測試學號:', TEST_STUDENT_ID);
  console.log('FEATURE_SURVEY_GATE env:', process.env.FEATURE_SURVEY_GATE ?? '(未設定，預設啟用)');

  const flag = await checkFeatureFlag();
  console.log('\n--- 1. SURVEY_GATE_ENABLED ---');
  console.log(JSON.stringify(flag, null, 2));

  console.log('\n--- 2. ET / EC survey_rules ---');
  for (const et of ['English Table', 'English Club']) {
    const r = await checkSurveyRule(et);
    console.log(JSON.stringify(r, null, 2));
  }

  console.log('\n--- 3. Gate 模擬（測試學號未填問卷時應 wouldBlock=true）---');
  for (const et of ['English Table', 'English Club']) {
    const sim = await simulateGate409(et, TEST_STUDENT_ID);
    console.log(JSON.stringify(sim, null, 2));
  }

  const allPass = flag.pass && (await Promise.all(
    ['English Table', 'English Club'].map((t) => checkSurveyRule(t))
  )).every((r) => r.pass === true);

  console.log('\n=== 總結 ===');
  console.log(allPass ? 'PASS: Feature flag 與 ET/EC 產品化 rules 符合 Phase 0 預期' : 'WARN: 請檢查上方 issues');
  process.exit(allPass ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
