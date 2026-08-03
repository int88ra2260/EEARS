'use strict';

const { EVENT_STATUS, TIMING } = require('../../../constants/learningJourneyEventConstants');
const { parseSemesterId } = require('./semIndexCalculator');

function assertEventQuality(event) {
  const issues = [];
  if (!event) return issues;

  if (!event.event_date) {
    issues.push({ code: 'MISSING_EVENT_DATE', message: 'event_date 必填', severity: 'error' });
  }

  if (event.status === EVENT_STATUS.REGISTERED_NO_SCORE && event.raw_score != null) {
    issues.push({
      code: 'REGISTERED_NO_SCORE_MUST_BE_NULL',
      message: 'registered_no_score 時 raw_score 必須為 NULL',
      severity: 'error',
    });
  }

  if (Number(event.raw_score) === 0 && event.status === EVENT_STATUS.VALID) {
    issues.push({
      code: 'ZERO_SCORE_SUSPICIOUS',
      message: 'valid 狀態不應以 0 表示缺值',
      severity: 'warning',
    });
  }

  if (event.sem_index != null && event.sem_index < 0 && event.timing !== TIMING.ENTRY) {
    issues.push({
      code: 'NEGATIVE_SEM_INDEX',
      message: 'sem_index 不得為負，除非 timing=entry',
      severity: 'error',
    });
  }

  if (event.exclude_flag && !event.reason_code) {
    issues.push({
      code: 'EXCLUDE_WITHOUT_REASON',
      message: 'exclude_flag 應附 reason_code',
      severity: 'warning',
    });
  }

  if (event.academic_term && !parseSemesterId(event.academic_term)) {
    issues.push({
      code: 'INVALID_ACADEMIC_TERM',
      message: `academic_term 格式異常: ${event.academic_term}`,
      severity: 'warning',
    });
  }

  return issues;
}

function assertExamDeltaPair(current, previous) {
  const issues = [];
  if (!current || !previous) return issues;
  if (current.instrument !== previous.instrument) {
    issues.push({
      code: 'CROSS_INSTRUMENT_DELTA',
      message: `不可跨工具相減: ${previous.instrument} vs ${current.instrument}`,
      severity: 'error',
    });
  }
  if (current.skill !== previous.skill) {
    issues.push({
      code: 'CROSS_SKILL_DELTA',
      message: `不可跨技能相減: ${previous.skill} vs ${current.skill}`,
      severity: 'error',
    });
  }
  return issues;
}

function assertBeforeExposure(examDate, resourceDate) {
  if (!examDate || !resourceDate) return true;
  return String(resourceDate).slice(0, 10) < String(examDate).slice(0, 10);
}

module.exports = {
  assertEventQuality,
  assertExamDeltaPair,
  assertBeforeExposure,
};
