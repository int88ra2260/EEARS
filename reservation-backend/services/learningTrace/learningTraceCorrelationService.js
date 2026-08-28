'use strict';

const { Op } = require('sequelize');
const { LearningTraceEvent, LjAnalyticStudent, Reservation, Event } = require('../../models');

function isCheckedIn(status) {
  return status === '已簽到';
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

async function getTraceLjCorrelationSummary(query = {}) {
  const days = Math.min(Math.max(Number(query.days) || 90, 14), 180);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const traces = await LearningTraceEvent.findAll({
    where: {
      eventType: 'session_complete',
      occurredAt: { [Op.gte]: since },
      studentId: { [Op.ne]: null },
    },
    attributes: ['studentId', 'cefrLevel', 'durationMs', 'occurredAt'],
    limit: 5000,
  });

  const studentIds = [...new Set(traces.map((row) => row.studentId).filter(Boolean))];
  if (!studentIds.length) {
    return {
      windowDays: days,
      sampleSize: 0,
      researchNote: '需有自願關聯學號的微學習軌跡，才能與 LJ 讀模型做關聯分析。',
      causalClaimAllowed: false,
    };
  }

  const analyticRows = await LjAnalyticStudent.findAll({
    where: { studentId: { [Op.in]: studentIds } },
    attributes: [
      'studentId',
      'isB2plus',
      'activityHoursTotal',
      'bestListeningCefr',
      'bestSpeakingCefr',
    ],
    limit: 5000,
  });
  const analyticByStudent = new Map(analyticRows.map((row) => [row.studentId, row]));

  const reservations = await Reservation.findAll({
    where: {
      studentId: { [Op.in]: studentIds },
    },
    attributes: ['studentId', 'eventId', 'checkinStatus'],
    include: [{
      model: Event,
      attributes: ['eventType', 'date', 'startTime'],
      where: {
        date: { [Op.gte]: since.toISOString().slice(0, 10) },
      },
      required: true,
    }],
    limit: 10000,
  });

  const practiced = new Set(traces.map((row) => row.studentId));
  const reservedEt = new Set();
  const checkedIn = new Set();
  reservations.forEach((row) => {
    const type = row.Event?.eventType || '';
    if (!['English Table', 'English Club', 'International Forum', 'Job Talk'].includes(type)) return;
    reservedEt.add(row.studentId);
    if (isCheckedIn(row.checkinStatus)) {
      checkedIn.add(row.studentId);
    }
  });

  const withPracticeAndReserve = [...practiced].filter((sid) => reservedEt.has(sid)).length;
  const withPracticeAndCheckin = [...practiced].filter((sid) => checkedIn.has(sid)).length;
  const b2AmongPracticed = [...practiced].filter((sid) => analyticByStudent.get(sid)?.isB2plus).length;

  const levelGroups = {};
  traces.forEach((row) => {
    const level = row.cefrLevel || 'unknown';
    if (!levelGroups[level]) levelGroups[level] = { count: 0, reserved: 0, b2plus: 0 };
    levelGroups[level].count += 1;
    if (reservedEt.has(row.studentId)) levelGroups[level].reserved += 1;
    if (analyticByStudent.get(row.studentId)?.isB2plus) levelGroups[level].b2plus += 1;
  });

  return {
    windowDays: days,
    since: since.toISOString(),
    sampleSize: practiced.size,
    totals: {
      microLearningStudents: practiced.size,
      withActivityReservation: withPracticeAndReserve,
      withActivityCheckin: withPracticeAndCheckin,
      b2plusAmongPracticed: b2AmongPracticed,
    },
    rates: {
      practiceToReservation: pct(withPracticeAndReserve, practiced.size),
      practiceToCheckin: pct(withPracticeAndCheckin, practiced.size),
      b2plusAmongPracticed: pct(b2AmongPracticed, practiced.size),
    },
    byEstimatedLevel: Object.entries(levelGroups).map(([level, stats]) => ({
      level,
      sessions: stats.count,
      reservationRate: pct(stats.reserved, stats.count),
      b2plusRate: pct(stats.b2plus, stats.count),
    })),
    researchNote: '微學習與活動參與、B2+ 達標為觀察性關聯，不作因果宣稱。',
    causalClaimAllowed: false,
  };
}

module.exports = {
  getTraceLjCorrelationSummary,
};
