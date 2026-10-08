'use strict';

const { Op } = require('sequelize');
const {
  Event,
  Reservation,
  EtEventGroupAssignment,
  EtSessionTaskMark,
  SpeakingAttempt,
  sequelize,
} = require('../../models');
const { listTaskTemplate } = require('./etTaskTemplateService');
const { getLeaderGroupLabels } = require('./etLeaderService');
const {
  filterTasksForBand,
  isMarkingWindowOpen,
  serializeTaskItem,
  MARKING_GRACE_DAYS,
} = require('./etTaskScope');
const { isEnglishTableEventType } = require('../../utils/eventCapacity');
const {
  dateKey,
  leaderDiscussionCue,
  firstHeardSentence,
  isEnglishTablePractice,
} = require('./etPracticeBrief');

async function loadEventContext(eventId) {
  const event = await Event.findByPk(eventId, {
    attributes: ['id', 'name', 'eventType', 'date', 'startTime', 'endTime', 'semesterId'],
  });
  if (!event) throw Object.assign(new Error('活動不存在'), { status: 404 });
  if (!isEnglishTableEventType(event.eventType)) {
    throw Object.assign(new Error('僅 English Table 活動支援任務勾選'), { status: 400 });
  }
  return event;
}

function buildStudentRows(reservations, assignmentMap) {
  return reservations.map((reservation) => {
    const assignment = assignmentMap.get(reservation.id);
    return {
      reservationId: reservation.id,
      studentId: reservation.studentId,
      studentName: reservation.studentName,
      checkinStatus: reservation.checkinStatus || '未簽到',
      groupLabel: assignment?.groupLabel || reservation.group || null,
      bandCode: assignment?.bandCode || null,
      canMark: (reservation.checkinStatus || '未簽到') === '已簽到',
    };
  });
}

async function getTaskMarksMatrix(eventId, {
  userId,
  canManage = false,
  canMark = false,
} = {}) {
  const event = await loadEventContext(eventId);
  const leaderGroups = canManage ? null : await getLeaderGroupLabels(eventId, userId);

  if (!canManage && !canMark) {
    throw Object.assign(new Error('無權限檢視任務勾選'), { status: 403 });
  }
  if (!canManage && (!leaderGroups || !leaderGroups.length)) {
    throw Object.assign(new Error('您尚未被指派為本場 Leader'), { status: 403 });
  }

  const [reservations, assignments, marks, templateData] = await Promise.all([
    Reservation.findAll({ where: { eventId }, order: [['id', 'ASC']] }),
    EtEventGroupAssignment.findAll({ where: { eventId } }),
    EtSessionTaskMark.findAll({ where: { eventId } }),
    listTaskTemplate({ semesterId: event.semesterId }),
  ]);

  const assignmentMap = new Map(assignments.map((row) => [row.reservationId, row]));
  const markMap = new Map(
    marks.map((row) => [`${row.reservationId}:${row.taskItemId}`, row])
  );

  let students = buildStudentRows(reservations, assignmentMap);
  if (!canManage && leaderGroups) {
    const allowed = new Set(leaderGroups);
    students = students.filter((student) => allowed.has(student.groupLabel));
  }

  const taskItems = templateData.items || [];
  const tasksByStudent = students.map((student) => {
    const applicable = filterTasksForBand(taskItems, student.bandCode).map(serializeTaskItem);
    const taskMarks = applicable.map((task) => {
      const existing = markMap.get(`${student.reservationId}:${task.id}`);
      return {
        taskItemId: task.id,
        code: task.code,
        label: task.label,
        isRequired: task.isRequired,
        completed: existing ? Boolean(existing.completed) : false,
        markedAt: existing?.markedAt || null,
      };
    });
    return { ...student, tasks: taskMarks };
  });

  const markingOpen = isMarkingWindowOpen(event);

  return {
    event: {
      id: event.id,
      name: event.name,
      date: event.date,
      endTime: event.endTime,
    },
    template: templateData.template,
    taskItems: taskItems.map(serializeTaskItem),
    students: tasksByStudent,
    markingOpen,
    markingGraceDays: MARKING_GRACE_DAYS,
    scope: canManage ? 'all' : 'leader',
    leaderGroups: leaderGroups || [],
  };
}

async function saveTaskMarks(eventId, payload = [], {
  userId,
  canManage = false,
  canMark = false,
} = {}) {
  const event = await loadEventContext(eventId);
  if (!canManage && !canMark) {
    throw Object.assign(new Error('無權限儲存任務勾選'), { status: 403 });
  }
  if (!isMarkingWindowOpen(event)) {
    throw Object.assign(new Error(`任務勾選已超過補登期限（活動結束後 ${MARKING_GRACE_DAYS} 天）`), { status: 400 });
  }

  const leaderGroups = canManage ? null : await getLeaderGroupLabels(eventId, userId);
  if (!canManage && (!leaderGroups || !leaderGroups.length)) {
    throw Object.assign(new Error('您尚未被指派為本場 Leader'), { status: 403 });
  }

  const marks = Array.isArray(payload) ? payload : payload?.marks;
  if (!Array.isArray(marks) || !marks.length) {
    throw new Error('請提供至少一筆任務勾選');
  }

  const [reservations, assignments, templateData] = await Promise.all([
    Reservation.findAll({ where: { eventId }, attributes: ['id', 'checkinStatus'] }),
    EtEventGroupAssignment.findAll({ where: { eventId } }),
    listTaskTemplate({ semesterId: event.semesterId }),
  ]);

  const reservationMap = new Map(reservations.map((row) => [row.id, row]));
  const assignmentMap = new Map(assignments.map((row) => [row.reservationId, row]));
  const taskItems = templateData.items || [];
  const taskById = new Map(taskItems.map((item) => [item.id, item]));
  const allowedGroups = leaderGroups ? new Set(leaderGroups) : null;
  const now = new Date();

  const transaction = await sequelize.transaction();
  try {
    for (const mark of marks) {
      const reservationId = Number(mark.reservationId);
      const taskItemId = Number(mark.taskItemId);
      if (!reservationId || !taskItemId) continue;

      const reservation = reservationMap.get(reservationId);
      if (!reservation) continue;
      if ((reservation.checkinStatus || '未簽到') !== '已簽到') continue;

      const assignment = assignmentMap.get(reservationId);
      if (allowedGroups && !allowedGroups.has(assignment?.groupLabel)) continue;

      const taskItem = taskById.get(taskItemId);
      if (!taskItem || taskItem.isActive === false) continue;
      if (!filterTasksForBand([taskItem], assignment?.bandCode).length) continue;

      const completed = Boolean(mark.completed);
      const [row] = await EtSessionTaskMark.findOrCreate({
        where: { eventId, reservationId, taskItemId },
        defaults: {
          eventId,
          reservationId,
          taskItemId,
          completed,
          markedBy: userId || null,
          markedAt: completed ? now : null,
        },
        transaction,
      });

      await row.update({
        completed,
        markedBy: userId || null,
        markedAt: completed ? now : null,
      }, { transaction });
    }

    await transaction.commit();
    return getTaskMarksMatrix(eventId, { userId, canManage, canMark });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function listPracticeBriefs(eventId, {
  userId,
  canManage = false,
  canMark = false,
} = {}) {
  const event = await loadEventContext(eventId);
  const leaderGroups = canManage ? null : await getLeaderGroupLabels(eventId, userId);

  if (!canManage && !canMark) {
    throw Object.assign(new Error('無權限檢視會前練習'), { status: 403 });
  }
  if (!canManage && (!leaderGroups || !leaderGroups.length)) {
    throw Object.assign(new Error('您尚未被指派為本場 Leader'), { status: 403 });
  }

  const [reservations, assignments] = await Promise.all([
    Reservation.findAll({
      where: { eventId },
      attributes: ['id', 'studentId', 'studentName', 'group'],
    }),
    EtEventGroupAssignment.findAll({
      where: { eventId },
      attributes: ['reservationId', 'groupLabel'],
    }),
  ]);
  const assignmentMap = new Map(assignments.map((row) => [row.reservationId, row]));
  let students = reservations.map((reservation) => ({
    studentId: String(reservation.studentId || '').trim(),
    studentName: reservation.studentName,
    groupLabel: assignmentMap.get(reservation.id)?.groupLabel || reservation.group || null,
  })).filter((student) => student.studentId);

  if (!canManage && leaderGroups) {
    const allowed = new Set(leaderGroups);
    students = students.filter((student) => allowed.has(student.groupLabel));
  }

  const nameById = new Map(students.map((student) => [student.studentId, student]));
  const ids = [...nameById.keys()];
  if (!ids.length) {
    return { eventDate: dateKey(event.date), briefs: [] };
  }

  const day = dateKey(event.date);
  const start = new Date(`${day}T00:00:00+08:00`);
  const where = { studentId: { [Op.in]: ids } };
  if (!Number.isNaN(start.getTime())) {
    where.submittedAt = {
      [Op.between]: [
        new Date(start.getTime() - 14 * 24 * 60 * 60 * 1000),
        new Date(start.getTime() + 8 * 24 * 60 * 60 * 1000),
      ],
    };
  }

  const attempts = await SpeakingAttempt.findAll({
    where,
    attributes: ['studentId', 'transcript', 'submittedAt', 'features'],
    order: [['submittedAt', 'DESC']],
    limit: 400,
  });

  const seen = new Set();
  const briefs = [];
  attempts.forEach((attempt) => {
    if (!isEnglishTablePractice(attempt.features, event.date)) return;
    const studentId = String(attempt.studentId || '').trim();
    const student = nameById.get(studentId);
    if (!student) return;
    const context = attempt.features?.context || {};
    const question = context.activityQuestionNumber || '';
    const phase = context.activityPhase || '';
    const key = `${studentId}:${question}:${phase}`;
    if (seen.has(key)) return;
    seen.add(key);
    briefs.push({
      studentId,
      studentName: student.studentName || studentId,
      groupLabel: student.groupLabel || null,
      questionNumber: question || null,
      phase: phase || null,
      heard: firstHeardSentence(attempt.transcript),
      cue: leaderDiscussionCue(attempt.transcript),
    });
  });

  briefs.sort((a, b) => (
    String(a.studentName).localeCompare(String(b.studentName), 'zh-Hant')
    || Number(a.questionNumber || 0) - Number(b.questionNumber || 0)
  ));

  return { eventDate: day, briefs };
}

module.exports = {
  getTaskMarksMatrix,
  saveTaskMarks,
  listPracticeBriefs,
};
