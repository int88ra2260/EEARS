'use strict';

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isoWeek = require('dayjs/plugin/isoWeek');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const { Op } = require('sequelize');
const {
  EnglishLearningPointRule,
  EnglishLearningSubmission,
} = require('../../models');
const {
  RULE_CODES,
  EXTERNAL_EXAM_BONUS_THRESHOLDS,
  DIRECT_PASS_EXAM_THRESHOLDS,
} = require('./constants');

const TZ = 'Asia/Taipei';

function weekKeyFromDate(dateStr) {
  if (!dateStr) return null;
  const d = dayjs.tz(dateStr, TZ);
  if (!d.isValid()) return null;
  return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, '0')}`;
}

function parseNumericScore(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function metadataWonAward(metadata) {
  const v = metadata && (metadata.wonAward ?? metadata.isWinner ?? metadata.is_winner);
  if (v === true || v === 'true' || v === 'yes' || v === '是' || v === 1 || v === '1') return true;
  return false;
}

function calculateSuggestedPoints(ruleCode, metadata = {}, rule = null) {
  const base = rule ? rule.basePoints : null;
  switch (ruleCode) {
    case RULE_CODES.ENGLISH_COMPETITION:
      return metadataWonAward(metadata) ? 50 : 20;
    case RULE_CODES.EXTERNAL_EXAM:
      return calculateExternalExamPoints(metadata);
    case RULE_CODES.ENGLISH_COURSE:
      return 60;
    case RULE_CODES.TUTOR_CONSULTATION:
    case RULE_CODES.ASSIGNED_TASK:
    case RULE_CODES.SELF_STUDY_SOFTWARE:
      return base != null ? base : 2;
    case RULE_CODES.SELF_LEARNING_ACTIVITY:
    case RULE_CODES.COLLEGE_ENGLISH_CORNER:
      return base != null ? base : 5;
    default:
      return base != null ? base : 0;
  }
}

function calculateExternalExamPoints(metadata = {}) {
  const examType = String(metadata.examType || metadata.exam_type || '').toUpperCase();
  const score = parseNumericScore(metadata.score ?? metadata.examScore);
  const level = String(metadata.level || metadata.examLevel || '').trim();

  for (const t of EXTERNAL_EXAM_BONUS_THRESHOLDS) {
    if (examType && t.examType !== examType) continue;
    if (t.minScore != null && score != null && score >= t.minScore) return 40;
    if (t.minLevel && level && level.includes(t.minLevel)) return 40;
  }
  return 20;
}

function meetsDirectEnglishStandard(metadata = {}) {
  const examType = String(metadata.examType || metadata.exam_type || '').toUpperCase();
  const score = parseNumericScore(metadata.score ?? metadata.examScore);
  const level = String(metadata.level || metadata.examLevel || '').trim();

  for (const t of DIRECT_PASS_EXAM_THRESHOLDS) {
    if (examType && t.examType !== examType) continue;
    if (t.minScore != null && score != null && score >= t.minScore) return true;
    if (t.minLevel && level && level.includes(t.minLevel)) return true;
  }
  return false;
}

async function getRuleByCode(ruleCode, transaction) {
  return EnglishLearningPointRule.findOne({
    where: { code: ruleCode, isEnabled: true },
    transaction,
  });
}

async function sumApprovedPointsForWeek(studentId, ruleCode, activityDate, excludeSubmissionId, transaction) {
  const weekKey = weekKeyFromDate(activityDate);
  if (!weekKey) return 0;

  const approved = await EnglishLearningSubmission.findAll({
    where: {
      studentId,
      ruleCode,
      status: 'approved',
      ...(excludeSubmissionId ? { id: { [Op.ne]: excludeSubmissionId } } : {}),
    },
    attributes: ['id', 'activityDate', 'pointsApproved'],
    transaction,
  });

  return approved.reduce((sum, row) => {
    if (weekKeyFromDate(row.activityDate) === weekKey) {
      return sum + (row.pointsApproved || 0);
    }
    return sum;
  }, 0);
}

async function sumApprovedPointsByRule(studentId, ruleCode, excludeSubmissionId, transaction) {
  const rows = await EnglishLearningSubmission.findAll({
    where: {
      studentId,
      ruleCode,
      status: 'approved',
      ...(excludeSubmissionId ? { id: { [Op.ne]: excludeSubmissionId } } : {}),
    },
    attributes: ['pointsApproved'],
    transaction,
  });
  return rows.reduce((sum, r) => sum + (r.pointsApproved || 0), 0);
}

async function hasApprovedOnceOnly(studentId, ruleCode, excludeSubmissionId, transaction) {
  const count = await EnglishLearningSubmission.count({
    where: {
      studentId,
      ruleCode,
      status: 'approved',
      ...(excludeSubmissionId ? { id: { [Op.ne]: excludeSubmissionId } } : {}),
    },
    transaction,
  });
  return count > 0;
}

/**
 * 審核前驗證點數規則
 * @returns {{ ok: boolean, suggestedPoints?: number, code?: string, message?: string }}
 */
async function validateApproval({
  studentId,
  ruleCode,
  activityDate,
  metadata,
  pointsToApprove,
  excludeSubmissionId,
  transaction,
}) {
  const rule = await getRuleByCode(ruleCode, transaction);
  if (!rule) {
    return { ok: false, code: 'RULE_NOT_FOUND', message: '點數規則不存在或已停用' };
  }

  const suggested = calculateSuggestedPoints(ruleCode, metadata, rule);
  const points = pointsToApprove != null ? Number(pointsToApprove) : suggested;
  if (!Number.isFinite(points) || points < 0) {
    return { ok: false, code: 'INVALID_POINTS', message: '核定點數無效' };
  }

  if (rule.isOnceOnly) {
    const exists = await hasApprovedOnceOnly(studentId, ruleCode, excludeSubmissionId, transaction);
    if (exists) {
      return { ok: false, code: 'ONCE_ONLY_EXCEEDED', message: '此項目每位學生只能採計一次' };
    }
  }

  if (rule.maxPointsPerWeek != null && activityDate) {
    const weekSum = await sumApprovedPointsForWeek(
      studentId,
      ruleCode,
      activityDate,
      excludeSubmissionId,
      transaction,
    );
    if (weekSum + points > rule.maxPointsPerWeek) {
      return {
        ok: false,
        code: 'WEEKLY_LIMIT_EXCEEDED',
        message: `每週此類別最多 ${rule.maxPointsPerWeek} 點，本週已核准 ${weekSum} 點`,
        suggestedPoints: suggested,
      };
    }
  }

  if (rule.maxPointsTotal != null) {
    const total = await sumApprovedPointsByRule(studentId, ruleCode, excludeSubmissionId, transaction);
    if (total + points > rule.maxPointsTotal) {
      return {
        ok: false,
        code: 'CATEGORY_LIMIT_EXCEEDED',
        message: `此類別最多採計 ${rule.maxPointsTotal} 點，已核准 ${total} 點`,
        suggestedPoints: suggested,
      };
    }
  }

  return { ok: true, suggestedPoints: suggested, points };
}

module.exports = {
  weekKeyFromDate,
  calculateSuggestedPoints,
  calculateExternalExamPoints,
  meetsDirectEnglishStandard,
  validateApproval,
  getRuleByCode,
  sumApprovedPointsByRule,
  metadataWonAward,
};
