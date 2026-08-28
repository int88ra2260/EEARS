'use strict';

const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { Reservation, Event } = require('../../models');
const { getEtActivityRecommendations } = require('../etGrouping/etActivityRecommendationService');
const { getStudentRecommendations } = require('../learningAnalytics/learningAnalyticsDecisionSupportService');
const { getStudentGamificationProfile } = require('./learningGamificationService');
const { generateRegulatoryFocusFeedback } = require('./learningFeedbackService');
const { LearningTraceEvent } = require('../../models');

function normalizeStudentContext(ctx = {}) {
  return {
    studentId: String(ctx.studentId || '').trim(),
    studentName: String(ctx.studentName || '').trim(),
    studentEmail: String(ctx.studentEmail || '').trim().toLowerCase(),
  };
}

async function verifyStudentIdentity(ctx) {
  const n = normalizeStudentContext(ctx);
  if (!n.studentId || !n.studentName || !n.studentEmail) {
    const err = new Error('請提供學號、姓名與 Email');
    err.status = 400;
    err.code = 'REQUIRED_FIELD_MISSING';
    throw err;
  }

  const reservation = await Reservation.findOne({
    where: {
      studentId: n.studentId,
      studentName: n.studentName,
      studentEmail: n.studentEmail,
    },
    attributes: ['id'],
  });

  if (!reservation) {
    const err = new Error('查無符合身分的預約紀錄，請確認學號、姓名與 Email');
    err.status = 404;
    err.code = 'STUDENT_IDENTITY_NOT_FOUND';
    throw err;
  }

  return n;
}

async function getStudentReservationEngagement(studentId) {
  const now = dayjs();
  const reservations = await Reservation.findAll({
    where: { studentId },
    attributes: ['checkinStatus', 'eventId'],
    include: [{ model: Event, attributes: ['date', 'startTime'] }],
    limit: 500,
  });

  let upcomingReservations = 0;
  let noShowCount = 0;

  reservations.forEach((row) => {
    if (row.checkinStatus === '已登記違規') {
      noShowCount += 1;
      return;
    }
    if (row.checkinStatus !== '未簽到' || !row.Event) return;
    const eventStart = dayjs(`${row.Event.date}T${row.Event.startTime}`);
    if (eventStart.isAfter(now)) {
      upcomingReservations += 1;
    }
  });

  return { upcomingReservations, noShowCount };
}

async function getStudentLearningJourneyDashboard(ctx, query = {}) {
  const identity = await verifyStudentIdentity(ctx);
  const [gamification, etRecommendations, lvaRecommendations, recentTraces, engagement] = await Promise.all([
    getStudentGamificationProfile(identity.studentId),
    getEtActivityRecommendations(identity.studentId, { limit: 5 }).catch(() => null),
    getStudentRecommendations(identity.studentId, query).catch(() => null),
    LearningTraceEvent.findAll({
      where: {
        [Op.or]: [
          { studentId: identity.studentId },
        ],
        eventType: 'session_complete',
      },
      attributes: ['traceId', 'gameId', 'occurredAt', 'durationMs', 'cefrLevel', 'payload'],
      order: [['occurredAt', 'DESC']],
      limit: 8,
    }),
    getStudentReservationEngagement(identity.studentId),
  ]);

  const latestTrace = recentTraces[0] || null;
  const feedback = await generateRegulatoryFocusFeedback({
    weakSkills: lvaRecommendations?.weakSkills || ['speaking'],
    estimatedLevel: latestTrace?.cefrLevel || gamification.stats.latestEstimatedLevel,
    stats: latestTrace?.payload || {},
    upcomingReservations: engagement.upcomingReservations,
    noShowCount: engagement.noShowCount,
  }, query);

  return {
    identity: {
      studentId: identity.studentId,
      studentName: identity.studentName,
    },
    gamification,
    feedback,
    microLearning: {
      recentSessions: recentTraces.map((row) => ({
        traceId: row.traceId,
        gameId: row.gameId,
        occurredAt: row.occurredAt,
        durationMs: row.durationMs,
        cefrLevel: row.cefrLevel,
        endReason: row.payload?.endReason || null,
      })),
    },
    recommendations: {
      activities: etRecommendations?.recommendations || [],
      resources: lvaRecommendations?.recommendations || [],
      disclaimer: '建議為觀察性參考，不代表保證成效。',
      causalClaimAllowed: false,
    },
    researchNote: '學生端歷程整合微學習、活動推薦與調節焦點回饋；不作因果宣稱。',
  };
}

module.exports = {
  normalizeStudentContext,
  verifyStudentIdentity,
  getStudentLearningJourneyDashboard,
};
