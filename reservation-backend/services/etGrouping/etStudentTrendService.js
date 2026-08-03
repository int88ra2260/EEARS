'use strict';

const { Reservation, Event, EtEventGroupAssignment, EtSessionTaskMark } = require('../../models');
const { getSemesterInfo } = require('../../utils/eventSemesterFromDate');
const { listTaskTemplate } = require('./etTaskTemplateService');
const { filterTasksForBand } = require('./etTaskScope');

async function computeCompletion(eventId, reservationId, bandCode, semesterId) {
  const [marks, templateData] = await Promise.all([
    EtSessionTaskMark.findAll({
      where: { eventId, reservationId, completed: true },
      attributes: ['id'],
    }),
    listTaskTemplate({ semesterId }),
  ]);
  const applicable = filterTasksForBand(templateData.items || [], bandCode);
  const total = applicable.length;
  if (!total) return { completed: 0, total: 0, rate: null };
  const completed = marks.length;
  return {
    completed,
    total,
    rate: Math.round((completed / total) * 1000) / 10,
  };
}

async function getStudentEtTrends(studentId, { semesterLabel = null } = {}) {
  const sid = String(studentId || '').trim();
  if (!sid) throw Object.assign(new Error('請提供學號'), { status: 400 });

  const reservations = await Reservation.findAll({
    where: { studentId: sid },
    include: [{
      model: Event,
      required: true,
      where: { eventType: 'English Table' },
      attributes: ['id', 'name', 'date', 'startTime', 'semesterId', 'groupingMode'],
    }],
    order: [[{ model: Event }, 'date', 'ASC'], ['id', 'ASC']],
  });

  const points = [];
  for (const reservation of reservations) {
    const event = reservation.Event;
    if (semesterLabel && semesterLabel !== 'all' && getSemesterInfo(event.date) !== semesterLabel) {
      continue;
    }
    const assignment = await EtEventGroupAssignment.findOne({
      where: { eventId: event.id, reservationId: reservation.id },
    });
    const taskStats = await computeCompletion(
      event.id,
      reservation.id,
      assignment?.bandCode || null,
      event.semesterId
    );
    points.push({
      eventId: event.id,
      eventName: event.name,
      date: event.date,
      semester: getSemesterInfo(event.date),
      checkinStatus: reservation.checkinStatus || '未簽到',
      groupLabel: reservation.group || assignment?.groupLabel || null,
      bandCode: assignment?.bandCode || null,
      gseSnapshot: assignment?.gseSnapshot ?? null,
      taskCompleted: taskStats.completed,
      taskTotal: taskStats.total,
      taskCompletionRate: taskStats.rate,
    });
  }

  const rates = points.map((p) => p.taskCompletionRate).filter((v) => v != null);
  const trend = {
    sessionCount: points.length,
    checkedInCount: points.filter((p) => p.checkinStatus === '已簽到').length,
    avgCompletionRate: rates.length
      ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 10) / 10
      : null,
    latestCompletionRate: rates.length ? rates[rates.length - 1] : null,
  };

  return {
    studentId: sid,
    semesterLabel: semesterLabel || 'all',
    trend,
    points,
    links: {
      learningJourney: `/admin/learning-journey/students/${encodeURIComponent(sid)}`,
      learningAnalytics: `/admin/learning-analytics/students/${encodeURIComponent(sid)}`,
    },
    disclaimer: '學期趨勢為觀察性統計，不代表學習成效因果。',
  };
}

module.exports = {
  getStudentEtTrends,
};
