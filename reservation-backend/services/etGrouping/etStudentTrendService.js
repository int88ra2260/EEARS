'use strict';

const { Op } = require('sequelize');
const { Reservation, Event, EtEventGroupAssignment, EtSessionTaskMark } = require('../../models');
const { getSemesterInfo } = require('../../utils/eventSemesterFromDate');
const { listTaskTemplate } = require('./etTaskTemplateService');
const { filterTasksForBand } = require('./etTaskScope');
const { computeApplicableCompletion, isCheckedInStatus } = require('./etTaskCompletion');
const { ENGLISH_TABLE_EVENT_TYPE_ALIASES } = require('../../utils/eventCapacity');
const {
  OBSERVATION_DISCLAIMER,
  READING_GUIDE,
  classifySessionTiming,
} = require('./etExamObservation');
const { loadLatestExamsByStudent, summaryForStudent } = require('./etExamObservationLoader');
const {
  loadEnglishTableAttempts,
  summarizeStudentPractice,
  formatPracticeMove,
} = require('./etPracticeProgress');

async function loadTemplates(semesterIds) {
  const cache = new Map();
  await Promise.all([...semesterIds].map(async (semesterId) => {
    const key = semesterId == null ? 'null' : String(semesterId);
    cache.set(key, await listTaskTemplate({ semesterId }));
  }));
  return cache;
}

function templateItems(cache, semesterId) {
  const key = semesterId == null ? 'null' : String(semesterId);
  return cache.get(key)?.items || [];
}

async function getStudentEtTrends(studentId, { semesterLabel = null } = {}) {
  const sid = String(studentId || '').trim();
  if (!sid) throw Object.assign(new Error('請提供學號'), { status: 400 });

  const reservations = await Reservation.findAll({
    where: { studentId: sid },
    include: [{
      model: Event,
      required: true,
      where: { eventType: { [Op.in]: ENGLISH_TABLE_EVENT_TYPE_ALIASES } },
      attributes: ['id', 'name', 'date', 'startTime', 'semesterId', 'groupingMode'],
    }],
    order: [[{ model: Event }, 'date', 'ASC'], ['id', 'ASC']],
  });

  const selected = reservations.filter((reservation) => {
    if (!semesterLabel || semesterLabel === 'all') return true;
    return getSemesterInfo(reservation.Event.date) === semesterLabel;
  });

  const reservationIds = selected.map((reservation) => reservation.id);
  const semesterIds = new Set(selected.map((reservation) => reservation.Event.semesterId));
  const [assignments, marks, templates, examLoad, practiceAttempts] = await Promise.all([
    reservationIds.length
      ? EtEventGroupAssignment.findAll({ where: { reservationId: { [Op.in]: reservationIds } } })
      : [],
    reservationIds.length
      ? EtSessionTaskMark.findAll({
        where: { reservationId: { [Op.in]: reservationIds }, completed: true },
        attributes: ['reservationId', 'taskItemId', 'completed'],
      })
      : [],
    loadTemplates(semesterIds),
    loadLatestExamsByStudent([sid]),
    loadEnglishTableAttempts([sid]),
  ]);

  const assignmentByReservation = new Map(assignments.map((row) => [row.reservationId, row]));
  const marksByReservation = new Map();
  for (const mark of marks) {
    if (!marksByReservation.has(mark.reservationId)) marksByReservation.set(mark.reservationId, []);
    marksByReservation.get(mark.reservationId).push(mark);
  }

  const examComparison = {
    ...summaryForStudent(examLoad.byStudent, sid),
    snapshotVersion: examLoad.snapshotVersion,
  };

  const points = selected.map((reservation) => {
    const event = reservation.Event;
    const assignment = assignmentByReservation.get(reservation.id) || null;
    const checkedIn = isCheckedInStatus(reservation.checkinStatus);
    const applicable = filterTasksForBand(templateItems(templates, event.semesterId), assignment?.bandCode || null);
    const taskStats = computeApplicableCompletion(
      applicable,
      marksByReservation.get(reservation.id) || [],
      { checkedIn }
    );
    const examTiming = classifySessionTiming(event.date, examComparison);
    return {
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
      examTiming,
      practiceMove: formatPracticeMove(summarizeStudentPractice(practiceAttempts, event.date)),
    };
  });

  const rates = points.map((point) => point.taskCompletionRate).filter((value) => value != null);
  const trend = {
    sessionCount: points.length,
    checkedInCount: points.filter((point) => point.checkinStatus === '已簽到').length,
    avgCompletionRate: rates.length
      ? Math.round((rates.reduce((sum, value) => sum + value, 0) / rates.length) * 10) / 10
      : null,
    latestCompletionRate: rates.length ? rates[rates.length - 1] : null,
  };

  return {
    studentId: sid,
    semesterLabel: semesterLabel || 'all',
    trend,
    points,
    examComparison,
    readingGuide: READING_GUIDE,
    links: {
      learningJourney: `/admin/learning-journey/students/${encodeURIComponent(sid)}`,
      learningAnalytics: `/admin/learning-analytics/students/${encodeURIComponent(sid)}`,
    },
    disclaimer: OBSERVATION_DISCLAIMER,
  };
}

module.exports = {
  getStudentEtTrends,
};
