'use strict';

const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { LearningTraceEvent, Reservation, Event, EnglishLearningPassport } = require('../../models');

const BADGE_DEFS = [
  {
    id: 'first_word_bridge',
    title: '詞彙連橋初體驗',
    description: '完成第一場 Word Bridge 微學習',
    test: (ctx) => ctx.microLearningSessions >= 1,
  },
  {
    id: 'practice_streak_3',
    title: '連續練習 3 週',
    description: '最近 3 週每週至少完成 1 場微學習',
    test: (ctx) => ctx.weeklyPracticeStreak >= 3,
  },
  {
    id: 'activity_starter',
    title: '活動起步',
    description: '至少完成 1 次英語活動簽到',
    test: (ctx) => ctx.checkedInCount >= 1,
  },
  {
    id: 'et_regular_5',
    title: 'ET 常客',
    description: 'English Table 簽到達 5 次',
    test: (ctx) => ctx.etCheckins >= 5,
  },
  {
    id: 'passport_halfway',
    title: '護照半程',
    description: '英語實踐歷程護照達 50 點',
    test: (ctx) => ctx.elpPoints >= 50,
  },
  {
    id: 'passport_certified',
    title: '護照認證',
    description: '英語實踐歷程護照達 100 點門檻',
    test: (ctx) => ctx.elpPoints >= 100,
  },
];

function computeWeeklyPracticeStreak(traces) {
  if (!traces.length) return 0;
  const weekKeys = new Set(
    traces.map((row) => dayjs(row.occurredAt).startOf('week').format('YYYY-MM-DD')),
  );
  let streak = 0;
  let cursor = dayjs().startOf('week');
  while (weekKeys.has(cursor.format('YYYY-MM-DD'))) {
    streak += 1;
    cursor = cursor.subtract(1, 'week');
  }
  return streak;
}

async function buildGamificationContext(studentId) {
  const since = dayjs().subtract(120, 'day').toDate();
  const [traces, reservations, passport] = await Promise.all([
    LearningTraceEvent.findAll({
      where: {
        studentId,
        eventType: 'session_complete',
        occurredAt: { [Op.gte]: since },
      },
      attributes: ['occurredAt', 'gameId', 'cefrLevel'],
      order: [['occurredAt', 'DESC']],
      limit: 200,
    }),
    Reservation.findAll({
      where: { studentId },
      attributes: ['checkinStatus', 'eventId'],
      include: [{ model: Event, attributes: ['eventType'] }],
      limit: 500,
    }),
    EnglishLearningPassport.findOne({
      where: { studentId },
      order: [['id', 'DESC']],
      attributes: ['totalApprovedPoints', 'certificationStatus'],
    }),
  ]);

  const checkedIn = reservations.filter((row) => row.checkinStatus === '已簽到');
  const etCheckins = checkedIn.filter((row) => row.Event?.eventType === 'English Table').length;

  return {
    microLearningSessions: traces.length,
    weeklyPracticeStreak: computeWeeklyPracticeStreak(traces),
    checkedInCount: checkedIn.length,
    etCheckins,
    elpPoints: Number(passport?.totalApprovedPoints || 0),
    latestEstimatedLevel: traces[0]?.cefrLevel || null,
  };
}

async function getStudentGamificationProfile(studentId) {
  const context = await buildGamificationContext(studentId);
  const badges = BADGE_DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    description: def.description,
    earned: def.test(context),
  }));
  const earnedCount = badges.filter((badge) => badge.earned).length;
  const nextBadge = badges.find((badge) => !badge.earned) || null;

  return {
    badges,
    earnedCount,
    totalBadges: badges.length,
    nextGoal: nextBadge,
    stats: context,
    srlSummary: {
      practiceSessions: context.microLearningSessions,
      weeklyStreak: context.weeklyPracticeStreak,
      activityCheckins: context.checkedInCount,
      elpPoints: context.elpPoints,
    },
  };
}

module.exports = {
  getStudentGamificationProfile,
  BADGE_DEFS,
};
