'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  EnglishLearningPassport,
  EnglishLearningSubmission,
  Reservation,
  Event,
} = require('../../models');
const {
  RULE_CODES,
  PASSPORT_STATUS,
  SUBMISSION_STATUS,
} = require('./constants');
const {
  getRuleByCode,
  validateApproval,
  calculateSuggestedPoints,
  sumApprovedPointsByRule,
} = require('./pointValidationService');
const { logElpAudit } = require('./auditService');

function recalculatePassportPoints(passportId, transaction, req) {
  // lazy require：避免與 passportService 循環依賴
  const passportService = require('./passportService');
  return passportService.recalculatePassportPoints(passportId, transaction, req);
}

const RULE_CODE = RULE_CODES.SELF_LEARNING_ACTIVITY;
const MAX_TIMES = 12;
const GRANT_SOURCE = 'eears_event_checkin';

const GRANT_STATUS = Object.freeze({
  PENDING: 'pending',
  GRANTED: 'granted',
  BLOCKED_LIMIT: 'blocked_limit',
  FAILED: 'failed',
});

function toBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

async function countApprovedTimes(studentId, excludeSubmissionId, transaction) {
  const where = {
    studentId,
    ruleCode: RULE_CODE,
    status: SUBMISSION_STATUS.APPROVED,
  };
  if (excludeSubmissionId) {
    where.id = { [Op.ne]: excludeSubmissionId };
  }
  return EnglishLearningSubmission.count({ where, transaction });
}

async function getUsageSummary(studentId, transaction) {
  const rule = await getRuleByCode(RULE_CODE, transaction);
  const maxPoints = rule?.maxPointsTotal != null ? Number(rule.maxPointsTotal) : 60;
  const basePoints = rule?.basePoints != null ? Number(rule.basePoints) : 5;
  const usedPoints = await sumApprovedPointsByRule(studentId, RULE_CODE, null, transaction);
  const usedCount = await countApprovedTimes(studentId, null, transaction);
  const maxCount = MAX_TIMES;
  return {
    ruleCode: RULE_CODE,
    ruleName: rule?.name || '英語增能活動',
    basePoints,
    usedPoints,
    maxPoints,
    usedCount,
    maxCount,
    remainingPoints: Math.max(0, maxPoints - usedPoints),
    remainingCount: Math.max(0, maxCount - usedCount),
    isFull: usedPoints >= maxPoints || usedCount >= maxCount,
  };
}

async function findActivePassportByStudentId(studentId, transaction) {
  return EnglishLearningPassport.findOne({
    where: {
      studentId,
      status: PASSPORT_STATUS.ACTIVE,
    },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
}

async function findExistingGrantForEvent(studentId, eventId, excludeReservationId, transaction) {
  const where = {
    studentId,
    eventId,
    passportPointsStatus: GRANT_STATUS.GRANTED,
  };
  if (excludeReservationId) {
    where.id = { [Op.ne]: excludeReservationId };
  }
  const grantedReservation = await Reservation.findOne({
    where,
    attributes: ['id', 'passportSubmissionId'],
    transaction,
  });
  if (grantedReservation) return { via: 'reservation', row: grantedReservation };

  const submissions = await EnglishLearningSubmission.findAll({
    where: {
      studentId,
      ruleCode: RULE_CODE,
      status: SUBMISSION_STATUS.APPROVED,
    },
    attributes: ['id', 'metadataJson'],
    transaction,
  });
  const hit = submissions.find((s) => {
    const meta = s.metadataJson || {};
    return String(meta.sourceEventId) === String(eventId) && meta.source === GRANT_SOURCE;
  });
  if (hit) return { via: 'submission', row: hit };
  return null;
}

/**
 * 簽到且勾選「計入護照點數」後嘗試入點；無護照則標 pending 待補發。
 * 不拋錯中斷簽到：失敗時回傳 status 供前端提示。
 */
async function tryGrantPassportPointsForReservation({
  reservation,
  event,
  countsTowardPassport,
  actorUserId = null,
  req = null,
  externalTransaction = null,
} = {}) {
  const wantPoints = toBool(countsTowardPassport);
  const usage = await getUsageSummary(reservation.studentId, externalTransaction);

  if (!wantPoints) {
    if (reservation.countsTowardPassport) {
      await reservation.update(
        {
          countsTowardPassport: false,
          passportPointsStatus:
            reservation.passportPointsStatus === GRANT_STATUS.GRANTED
              ? GRANT_STATUS.GRANTED
              : null,
        },
        { transaction: externalTransaction },
      );
    }
    return {
      requested: false,
      status: null,
      message: null,
      usage,
    };
  }

  if (reservation.checkinStatus !== '已簽到') {
    return {
      requested: true,
      status: GRANT_STATUS.FAILED,
      code: 'NOT_CHECKED_IN',
      message: '需先完成簽到才能累計護照點數',
      usage,
    };
  }

  if (reservation.passportPointsStatus === GRANT_STATUS.GRANTED && reservation.passportSubmissionId) {
    return {
      requested: true,
      status: GRANT_STATUS.GRANTED,
      code: 'ALREADY_GRANTED',
      message: '此預約已入過護照點數',
      submissionId: reservation.passportSubmissionId,
      usage,
    };
  }

  const dup = await findExistingGrantForEvent(
    reservation.studentId,
    event.id,
    reservation.id,
    externalTransaction,
  );
  if (dup) {
    await reservation.update(
      {
        countsTowardPassport: true,
        passportPointsStatus: GRANT_STATUS.GRANTED,
        passportSubmissionId:
          dup.via === 'submission' ? dup.row.id : (dup.row.passportSubmissionId || null),
      },
      { transaction: externalTransaction },
    );
    return {
      requested: true,
      status: GRANT_STATUS.GRANTED,
      code: 'ALREADY_GRANTED_EVENT',
      message: '同一場活動已入過護照點數（每位學生僅一次）',
      usage,
    };
  }

  if (usage.isFull) {
    await reservation.update(
      {
        countsTowardPassport: true,
        passportPointsStatus: GRANT_STATUS.BLOCKED_LIMIT,
        passportSubmissionId: null,
      },
      { transaction: externalTransaction },
    );
    return {
      requested: true,
      status: GRANT_STATUS.BLOCKED_LIMIT,
      code: 'CATEGORY_LIMIT_EXCEEDED',
      message: `「${usage.ruleName}」已達上限（最多 ${usage.maxCount} 次／${usage.maxPoints} 點），無法再累計`,
      usage,
    };
  }

  const passport = await findActivePassportByStudentId(reservation.studentId, externalTransaction);
  if (!passport) {
    await reservation.update(
      {
        countsTowardPassport: true,
        passportPointsStatus: GRANT_STATUS.PENDING,
        passportSubmissionId: null,
      },
      { transaction: externalTransaction },
    );
    return {
      requested: true,
      status: GRANT_STATUS.PENDING,
      code: 'PASSPORT_PENDING_QUEUE',
      message: '已標記計入護照；學生尚未有啟用中護照，待開通後自動補發',
      usage,
    };
  }

  const run = async (transaction) => {
    const rule = await getRuleByCode(RULE_CODE, transaction);
    if (!rule) {
      await reservation.update(
        {
          countsTowardPassport: true,
          passportPointsStatus: GRANT_STATUS.FAILED,
        },
        { transaction },
      );
      return {
        requested: true,
        status: GRANT_STATUS.FAILED,
        code: 'RULE_NOT_FOUND',
        message: '護照點數規則不存在或已停用',
        usage,
      };
    }

    const metadataJson = {
      source: GRANT_SOURCE,
      sourceEventId: event.id,
      reservationId: reservation.id,
      activityName: event.name,
      activityType: event.eventType || '英語增能活動',
    };
    const points = calculateSuggestedPoints(RULE_CODE, metadataJson, rule);
    const activityDate = event.date || null;

    const validation = await validateApproval({
      studentId: reservation.studentId,
      ruleCode: RULE_CODE,
      activityDate,
      metadata: metadataJson,
      pointsToApprove: points,
      transaction,
    });
    if (!validation.ok) {
      const blocked = validation.code === 'CATEGORY_LIMIT_EXCEEDED' || validation.code === 'WEEKLY_LIMIT_EXCEEDED';
      await reservation.update(
        {
          countsTowardPassport: true,
          passportPointsStatus: blocked ? GRANT_STATUS.BLOCKED_LIMIT : GRANT_STATUS.FAILED,
        },
        { transaction },
      );
      return {
        requested: true,
        status: blocked ? GRANT_STATUS.BLOCKED_LIMIT : GRANT_STATUS.FAILED,
        code: validation.code,
        message: validation.message,
        usage: await getUsageSummary(reservation.studentId, transaction),
      };
    }

    const usedCount = await countApprovedTimes(reservation.studentId, null, transaction);
    if (usedCount >= MAX_TIMES) {
      await reservation.update(
        {
          countsTowardPassport: true,
          passportPointsStatus: GRANT_STATUS.BLOCKED_LIMIT,
        },
        { transaction },
      );
      return {
        requested: true,
        status: GRANT_STATUS.BLOCKED_LIMIT,
        code: 'CATEGORY_LIMIT_EXCEEDED',
        message: `「${rule.name}」已達 ${MAX_TIMES} 次上限，無法再累計`,
        usage: await getUsageSummary(reservation.studentId, transaction),
      };
    }

    const now = new Date();
    const submission = await EnglishLearningSubmission.create(
      {
        passportId: passport.id,
        studentId: reservation.studentId,
        ruleCode: RULE_CODE,
        status: SUBMISSION_STATUS.APPROVED,
        activityDate,
        title: event.name,
        description: `系統依活動簽到自動入點（預約 #${reservation.id}）`,
        pointsRequested: validation.points,
        pointsApproved: validation.points,
        metadataJson,
        submittedAt: now,
        reviewedBy: actorUserId || null,
        reviewedAt: now,
        rejectionReason: null,
      },
      { transaction },
    );

    await reservation.update(
      {
        countsTowardPassport: true,
        passportPointsStatus: GRANT_STATUS.GRANTED,
        passportSubmissionId: submission.id,
      },
      { transaction },
    );

    await recalculatePassportPoints(passport.id, transaction, req);

    if (typeof logElpAudit === 'function') {
      await logElpAudit({
        req,
        action: 'submission_auto_approve_from_event_checkin',
        targetType: 'EnglishLearningSubmission',
        targetId: submission.id,
        after: {
          studentId: reservation.studentId,
          eventId: event.id,
          reservationId: reservation.id,
          points: validation.points,
        },
      });
    }

    return {
      requested: true,
      status: GRANT_STATUS.GRANTED,
      code: 'GRANTED',
      message: `已自動累計護照「${rule.name}」${validation.points} 點`,
      submissionId: submission.id,
      points: validation.points,
      usage: await getUsageSummary(reservation.studentId, transaction),
    };
  };

  if (externalTransaction) {
    return run(externalTransaction);
  }
  return sequelize.transaction((transaction) => run(transaction));
}

/**
 * 學生護照啟用後，補發先前標記 pending 的簽到入點。
 */
async function flushPendingEventPassportPointsForStudent(studentId, { req = null, actorUserId = null } = {}) {
  const pendingRows = await Reservation.findAll({
    where: {
      studentId,
      countsTowardPassport: true,
      checkinStatus: '已簽到',
      passportPointsStatus: GRANT_STATUS.PENDING,
    },
    include: [{ model: Event, required: true }],
    order: [['id', 'ASC']],
  });

  const results = [];
  for (const reservation of pendingRows) {
    const event = reservation.Event;
    if (!event) continue;
    try {
      const result = await tryGrantPassportPointsForReservation({
        reservation,
        event,
        countsTowardPassport: true,
        actorUserId,
        req,
      });
      results.push({ reservationId: reservation.id, eventId: event.id, ...result });
    } catch (err) {
      results.push({
        reservationId: reservation.id,
        eventId: event?.id,
        status: GRANT_STATUS.FAILED,
        message: err.message || '補發失敗',
      });
    }
  }
  return results;
}

module.exports = {
  GRANT_STATUS,
  GRANT_SOURCE,
  RULE_CODE,
  MAX_TIMES,
  toBool,
  getUsageSummary,
  tryGrantPassportPointsForReservation,
  flushPendingEventPassportPointsForStudent,
};
