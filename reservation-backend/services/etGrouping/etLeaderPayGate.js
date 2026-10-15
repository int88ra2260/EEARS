'use strict';

const { Op } = require('sequelize');
const {
  Reservation,
  Event,
  EtEventGroupAssignment,
  EtEventGroupLeader,
  EtSessionTaskMark,
  EtLeaderAttendance,
} = require('../../models');
const { listTaskTemplate } = require('./etTaskTemplateService');
const {
  filterTasksForBand,
  isMarkingWindowOpen,
  isLeaderMarkingOpen,
  markingDaysLeft,
  resolveMarkingExtensionUntil,
} = require('./etTaskScope');

const PAYABLE_ATTENDANCE = new Set(['on_time', 'late', 'manual']);

function extensionKeepsOpen(event, attendance, now) {
  if (!attendance?.markingOpenUntil) return false;
  if (isMarkingWindowOpen(event, { now })) return false;
  return isLeaderMarkingOpen(event, attendance, { now });
}

function evaluateSessionPayGate({
  attendance,
  groupLabels = [],
  students = [],
  markKeys = new Set(),
  taskItems = [],
  event,
  now = new Date(),
} = {}) {
  const status = String(attendance?.status || '');
  if (!PAYABLE_ATTENDANCE.has(status)) {
    return {
      status: 'unchecked',
      payable: false,
      checkedInCount: 0,
      incompleteCount: 0,
      markingOpen: isLeaderMarkingOpen(event, attendance, { now }),
      daysLeft: markingDaysLeft(event, attendance, { now }),
      releaseNote: null,
      markingOpenUntil: null,
      extended: false,
    };
  }

  const allowed = new Set(groupLabels.filter(Boolean));
  const checkedIn = students.filter((student) => (
    student.checkinStatus === '已簽到' && allowed.has(student.groupLabel)
  ));
  let incompleteCount = 0;
  checkedIn.forEach((student) => {
    const required = filterTasksForBand(taskItems, student.bandCode)
      .filter((task) => task.isRequired === true);
    required.forEach((task) => {
      if (!markKeys.has(`${student.reservationId}:${task.id}`)) incompleteCount += 1;
    });
  });

  const releaseNote = attendance.payReleaseNote ? String(attendance.payReleaseNote) : null;
  const markingOpen = isLeaderMarkingOpen(event, attendance, { now });
  const extended = extensionKeepsOpen(event, attendance, now);
  let payStatus = 'ready';
  if (attendance.payReleasedAt) payStatus = 'released';
  else if (incompleteCount > 0) payStatus = markingOpen ? 'pending' : 'expired';

  return {
    status: payStatus,
    payable: payStatus === 'ready' || payStatus === 'released',
    checkedInCount: checkedIn.length,
    incompleteCount,
    markingOpen,
    daysLeft: markingDaysLeft(event, attendance, { now }),
    releaseNote,
    markingOpenUntil: attendance.markingOpenUntil || null,
    markingOpenNote: attendance.markingOpenNote || null,
    extended,
  };
}

function plain(row) {
  return row?.toJSON ? row.toJSON() : row;
}

async function loadPayGateMap({ events = [], attendances = [], groupLabelMap = new Map(), now = new Date() } = {}) {
  const map = new Map();
  const eventIds = events.map((event) => event.id).filter(Boolean);
  if (!eventIds.length || !attendances.length) return map;

  const [reservations, assignments, marks] = await Promise.all([
    Reservation.findAll({
      where: { eventId: { [Op.in]: eventIds } },
      attributes: ['id', 'eventId', 'checkinStatus', 'group'],
    }),
    EtEventGroupAssignment.findAll({
      where: { eventId: { [Op.in]: eventIds } },
      attributes: ['eventId', 'reservationId', 'groupLabel', 'bandCode'],
    }),
    EtSessionTaskMark.findAll({
      where: { eventId: { [Op.in]: eventIds } },
      attributes: ['eventId', 'reservationId', 'taskItemId'],
    }),
  ]);

  const assignmentByReservation = new Map(
    assignments.map((row) => [row.reservationId, plain(row)])
  );
  const studentsByEvent = new Map();
  reservations.forEach((row) => {
    const reservation = plain(row);
    const assignment = assignmentByReservation.get(reservation.id);
    const bucket = studentsByEvent.get(reservation.eventId) || [];
    bucket.push({
      reservationId: reservation.id,
      checkinStatus: reservation.checkinStatus || '未簽到',
      groupLabel: assignment?.groupLabel || reservation.group || null,
      bandCode: assignment?.bandCode || null,
    });
    studentsByEvent.set(reservation.eventId, bucket);
  });

  const marksByEvent = new Map();
  marks.forEach((row) => {
    const mark = plain(row);
    const bucket = marksByEvent.get(mark.eventId) || new Set();
    bucket.add(`${mark.reservationId}:${mark.taskItemId}`);
    marksByEvent.set(mark.eventId, bucket);
  });

  const templateCache = new Map();
  async function itemsFor(semesterId) {
    const key = semesterId == null ? 'default' : String(semesterId);
    if (!templateCache.has(key)) {
      const data = await listTaskTemplate({ semesterId: semesterId ?? null });
      templateCache.set(key, data.items || []);
    }
    return templateCache.get(key);
  }

  const eventMap = new Map(events.map((event) => [event.id, event]));
  for (const attendance of attendances) {
    const event = eventMap.get(attendance.eventId);
    if (!event) continue;
    const taskItems = await itemsFor(event.semesterId ?? null);
    const gate = evaluateSessionPayGate({
      attendance: plain(attendance),
      groupLabels: groupLabelMap.get(`${attendance.eventId}:${attendance.leaderTeacherId}`) || [],
      students: studentsByEvent.get(attendance.eventId) || [],
      markKeys: marksByEvent.get(attendance.eventId) || new Set(),
      taskItems,
      event,
      now,
    });
    map.set(`${attendance.eventId}:${attendance.leaderTeacherId}`, gate);
  }
  return map;
}

async function setPayRelease({ eventId, leaderTeacherId, note, userId, released }) {
  const attendance = await EtLeaderAttendance.findOne({
    where: { eventId: Number(eventId), leaderTeacherId: Number(leaderTeacherId) },
  });
  if (!attendance) {
    throw Object.assign(new Error('這位 Leader 尚未簽到，無法調整計薪'), { status: 404 });
  }
  if (released) {
    const reason = String(note || '').trim();
    if (reason.length < 2) {
      throw Object.assign(new Error('請寫下放行原因'), { status: 400, code: 'PAY_RELEASE_NOTE_REQUIRED' });
    }
    await attendance.update({
      payReleasedAt: new Date(),
      payReleaseNote: reason.slice(0, 255),
      payReleasedBy: userId || null,
    });
  } else {
    await attendance.update({
      payReleasedAt: null,
      payReleaseNote: null,
      payReleasedBy: null,
    });
  }
  return {
    eventId: attendance.eventId,
    leaderTeacherId: attendance.leaderTeacherId,
    payReleasedAt: attendance.payReleasedAt,
    payReleaseNote: attendance.payReleaseNote,
  };
}

async function setMarkingExtension({
  eventId,
  leaderTeacherId,
  note,
  until,
  userId,
  open = true,
}) {
  const attendance = await EtLeaderAttendance.findOne({
    where: { eventId: Number(eventId), leaderTeacherId: Number(leaderTeacherId) },
  });
  if (!attendance) {
    throw Object.assign(new Error('這位 Leader 尚未簽到，無法開放補勾'), { status: 404 });
  }
  if (open) {
    const reason = String(note || '').trim();
    if (reason.length < 2) {
      throw Object.assign(new Error('請寫下開放補勾的原因'), { status: 400, code: 'MARKING_EXTENSION_NOTE_REQUIRED' });
    }
    const markingOpenUntil = resolveMarkingExtensionUntil(until);
    await attendance.update({
      markingOpenUntil,
      markingOpenNote: reason.slice(0, 255),
      markingOpenedBy: userId || null,
    });
  } else {
    await attendance.update({
      markingOpenUntil: null,
      markingOpenNote: null,
      markingOpenedBy: null,
    });
  }
  return {
    eventId: attendance.eventId,
    leaderTeacherId: attendance.leaderTeacherId,
    markingOpenUntil: attendance.markingOpenUntil,
    markingOpenNote: attendance.markingOpenNote,
  };
}

function attentionFromDate(now) {
  const taipei = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const prev = new Date(Date.UTC(taipei.getUTCFullYear(), taipei.getUTCMonth() - 1, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

async function listLeaderMarkingAttention(leaderTeacherId, { now = new Date() } = {}) {
  const teacherId = Number(leaderTeacherId);
  if (!teacherId) return { count: 0, items: [] };

  const attendances = await EtLeaderAttendance.findAll({
    where: {
      leaderTeacherId: teacherId,
      status: { [Op.in]: ['on_time', 'late', 'manual'] },
      [Op.or]: [
        { '$event.date$': { [Op.gte]: attentionFromDate(now) } },
        { markingOpenUntil: { [Op.gte]: now } },
      ],
    },
    include: [{
      model: Event,
      as: 'event',
      required: true,
      attributes: ['id', 'name', 'date', 'startTime', 'endTime', 'semesterId'],
    }],
  });
  if (!attendances.length) return { count: 0, items: [] };

  const events = attendances.map((row) => plain(row.event)).filter(Boolean);
  const leaderGroups = await EtEventGroupLeader.findAll({
    where: {
      leaderTeacherId: teacherId,
      eventId: { [Op.in]: events.map((event) => event.id) },
    },
    attributes: ['eventId', 'groupLabel'],
  });
  const groupLabelMap = new Map();
  leaderGroups.forEach((row) => {
    const key = `${row.eventId}:${teacherId}`;
    const bucket = groupLabelMap.get(key) || [];
    bucket.push(row.groupLabel);
    groupLabelMap.set(key, bucket);
  });

  const gates = await loadPayGateMap({ events, attendances, groupLabelMap, now });
  const items = attendances.flatMap((row) => {
    const event = plain(row.event);
    const gate = gates.get(`${event.id}:${teacherId}`);
    if (!gate || (gate.status !== 'pending' && gate.status !== 'expired')) return [];
    return [{
      eventId: event.id,
      eventName: event.name,
      date: event.date,
      status: gate.status,
      daysLeft: gate.daysLeft,
      extended: gate.extended === true,
      markingOpenUntil: gate.markingOpenUntil,
      incompleteCount: gate.incompleteCount,
    }];
  }).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return { count: items.length, items: items.slice(0, 20) };
}

module.exports = {
  evaluateSessionPayGate,
  loadPayGateMap,
  setPayRelease,
  setMarkingExtension,
  listLeaderMarkingAttention,
};
