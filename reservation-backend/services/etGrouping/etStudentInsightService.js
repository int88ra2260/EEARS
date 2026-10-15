'use strict';

const { Op } = require('sequelize');
const {
  Reservation,
  Event,
  EtEventGroupAssignment,
  EtSessionTaskMark,
} = require('../../models');
const { getGseSnapshotForStudent } = require('./etGseSnapshotService');
const { listTaskTemplate } = require('./etTaskTemplateService');
const { filterTasksForBand } = require('./etTaskScope');
const { computeApplicableCompletion, isCheckedInStatus } = require('./etTaskCompletion');
const { ENGLISH_TABLE_EVENT_TYPE_ALIASES } = require('../../utils/eventCapacity');
const { OBSERVATION_DISCLAIMER, classifySessionTiming } = require('./etExamObservation');
const { loadLatestExamsByStudent, summaryForStudent } = require('./etExamObservationLoader');
const {
  loadEnglishTableAttempts,
  summarizeStudentPractice,
  formatPracticeMove,
} = require('./etPracticeProgress');

async function getStudentEtInsights(studentId) {
  const sid = String(studentId || '').trim();
  if (!sid) throw Object.assign(new Error('請提供學號'), { status: 400 });

  const reservations = await Reservation.findAll({
    where: { studentId: sid },
    include: [{
      model: Event,
      required: true,
      where: { eventType: { [Op.in]: ENGLISH_TABLE_EVENT_TYPE_ALIASES } },
      attributes: ['id', 'name', 'date', 'startTime', 'endTime', 'semesterId', 'groupingMode'],
    }],
    order: [[{ model: Event }, 'date', 'DESC'], ['id', 'DESC']],
    limit: 30,
  });

  const reservationIds = reservations.map((reservation) => reservation.id);
  const semesterIds = [...new Set(reservations.map((reservation) => reservation.Event.semesterId))];
  const [assignments, marks, examLoad, gseSnapshot, templates, practiceAttempts] = await Promise.all([
    reservationIds.length
      ? EtEventGroupAssignment.findAll({ where: { reservationId: { [Op.in]: reservationIds } } })
      : [],
    reservationIds.length
      ? EtSessionTaskMark.findAll({
        where: { reservationId: { [Op.in]: reservationIds }, completed: true },
        attributes: ['reservationId', 'taskItemId', 'completed'],
      })
      : [],
    loadLatestExamsByStudent([sid]),
    getGseSnapshotForStudent(sid),
    Promise.all(semesterIds.map(async (semesterId) => {
      const data = await listTaskTemplate({ semesterId });
      return [semesterId == null ? 'null' : String(semesterId), data.items || []];
    })),
    loadEnglishTableAttempts([sid]),
  ]);

  const assignmentByReservation = new Map(assignments.map((row) => [row.reservationId, row]));
  const marksByReservation = new Map();
  for (const mark of marks) {
    if (!marksByReservation.has(mark.reservationId)) marksByReservation.set(mark.reservationId, []);
    marksByReservation.get(mark.reservationId).push(mark);
  }
  const templateBySemester = new Map(templates);
  const examComparison = {
    ...summaryForStudent(examLoad.byStudent, sid),
    snapshotVersion: examLoad.snapshotVersion,
  };

  let checkedInCount = 0;
  let completionSum = 0;
  let completionCount = 0;
  const sessions = reservations.map((reservation) => {
    const event = reservation.Event;
    const assignment = assignmentByReservation.get(reservation.id) || null;
    const checkedIn = isCheckedInStatus(reservation.checkinStatus);
    const semesterKey = event.semesterId == null ? 'null' : String(event.semesterId);
    const applicable = filterTasksForBand(templateBySemester.get(semesterKey) || [], assignment?.bandCode || null);
    const taskStats = computeApplicableCompletion(
      applicable,
      marksByReservation.get(reservation.id) || [],
      { checkedIn }
    );
    if (checkedIn) checkedInCount += 1;
    if (taskStats.rate != null) {
      completionSum += taskStats.rate;
      completionCount += 1;
    }
    return {
      eventId: event.id,
      eventName: event.name,
      date: event.date,
      startTime: event.startTime,
      groupingMode: event.groupingMode || 'legacy_sequential',
      checkinStatus: reservation.checkinStatus || '未簽到',
      groupLabel: reservation.group || assignment?.groupLabel || null,
      bandCode: assignment?.bandCode || null,
      gseSnapshot: assignment?.gseSnapshot ?? null,
      cefrSnapshot: assignment?.cefrSnapshot ?? null,
      taskCompleted: taskStats.completed,
      taskTotal: taskStats.total,
      taskCompletionRate: taskStats.rate,
      examTiming: classifySessionTiming(event.date, examComparison),
      practiceMove: formatPracticeMove(summarizeStudentPractice(practiceAttempts, event.date)),
      adminEventPath: `/admin/operations/${event.id}`,
    };
  });

  return {
    studentId: sid,
    gseSnapshot,
    summary: {
      totalSessions: sessions.length,
      checkedInCount,
      avgTaskCompletionRate: completionCount
        ? Math.round((completionSum / completionCount) * 10) / 10
        : null,
    },
    sessions,
    examComparison,
    links: {
      learningJourney: `/admin/learning-journey/students/${encodeURIComponent(sid)}`,
      learningAnalytics: `/admin/learning-analytics/students/${encodeURIComponent(sid)}`,
      etStudentTrends: `/admin/et-grouping/student-trends?studentId=${encodeURIComponent(sid)}`,
    },
    disclaimer: OBSERVATION_DISCLAIMER,
  };
}

module.exports = {
  getStudentEtInsights,
};
