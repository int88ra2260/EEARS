'use strict';

const crypto = require('crypto');
const {
  Event,
  Teacher,
  EtEventGroupLeader,
  EtLeaderAttendance,
  EtLeaderCheckinToken,
  sequelize,
} = require('../../models');
const { isEnglishTableEventType } = require('../../utils/eventCapacity');

const STATUS = Object.freeze({
  ON_TIME: 'on_time',
  LATE: 'late',
  MANUAL: 'manual',
});

const METHOD = Object.freeze({
  QR: 'qr',
  MANUAL: 'manual',
});

const EARLY_MINUTES = 30;
const ON_TIME_GRACE_MINUTES = 10;

function hashToken(plain) {
  return crypto.createHash('sha256').update(String(plain || ''), 'utf8').digest('hex');
}

function generatePlainToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function parseEventDateTime(event, timeField, fallbackTime) {
  if (!event?.date) return null;
  const raw = (event[timeField] || fallbackTime || '00:00').toString().trim();
  const time = /^\d{1,2}:\d{2}/.test(raw) ? raw.slice(0, 5) : fallbackTime;
  const iso = `${event.date}T${time}:00+08:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getEventWindow(event) {
  const startAt = parseEventDateTime(event, 'startTime', '00:00');
  const endAt = parseEventDateTime(event, 'endTime', '23:59');
  if (!startAt || !endAt) return null;
  const openAt = new Date(startAt.getTime() - EARLY_MINUTES * 60 * 1000);
  const onTimeUntil = new Date(startAt.getTime() + ON_TIME_GRACE_MINUTES * 60 * 1000);
  return { startAt, endAt, openAt, onTimeUntil };
}

function resolveCheckInStatus(event, now = new Date()) {
  const window = getEventWindow(event);
  if (!window) {
    throw Object.assign(new Error('活動時間設定不完整，無法簽到'), { status: 400, code: 'EVENT_TIME_INVALID' });
  }
  if (now < window.openAt) {
    throw Object.assign(
      new Error(`簽到尚未開放（活動開始前 ${EARLY_MINUTES} 分鐘起可簽）`),
      { status: 400, code: 'CHECKIN_TOO_EARLY' }
    );
  }
  if (now > window.endAt) {
    throw Object.assign(
      new Error('活動已結束，請由行政補登出席'),
      { status: 400, code: 'CHECKIN_WINDOW_CLOSED' }
    );
  }
  if (now <= window.onTimeUntil) return STATUS.ON_TIME;
  return STATUS.LATE;
}

function serializeAttendance(row) {
  if (!row) return null;
  return {
    eventId: row.eventId,
    leaderTeacherId: row.leaderTeacherId,
    checkInAt: row.checkInAt,
    status: row.status,
    method: row.method,
    markedBy: row.markedBy || null,
    note: row.note || null,
    leaderName: row.leader?.name || null,
  };
}

async function assertEnglishTableEvent(eventId) {
  const event = await Event.findByPk(eventId, {
    attributes: ['id', 'name', 'date', 'startTime', 'endTime', 'eventType', 'semesterId'],
  });
  if (!event) throw Object.assign(new Error('活動不存在'), { status: 404 });
  if (!isEnglishTableEventType(event.eventType)) {
    throw Object.assign(new Error('僅 English Table 活動支援 Leader 出席簽到'), { status: 400 });
  }
  return event;
}

async function assertAssignedLeader(eventId, teacherId) {
  if (!teacherId) {
    throw Object.assign(new Error('未登入'), { status: 401 });
  }
  const row = await EtEventGroupLeader.findOne({
    where: { eventId, leaderTeacherId: teacherId },
    attributes: ['id', 'groupLabel'],
  });
  if (!row) {
    throw Object.assign(new Error('您尚未被指派為本場 Leader'), { status: 403, code: 'NOT_ASSIGNED_LEADER' });
  }
  return row;
}

async function getActiveTokenRow(eventId) {
  return EtLeaderCheckinToken.findOne({ where: { eventId } });
}

async function rotateCheckinQr(eventId, { userId } = {}) {
  const event = await assertEnglishTableEvent(eventId);
  const window = getEventWindow(event);
  if (!window) {
    throw Object.assign(new Error('活動時間設定不完整'), { status: 400 });
  }

  const plainToken = generatePlainToken();
  const tokenHash = hashToken(plainToken);
  const now = new Date();
  const expiresAt = window.endAt;

  const transaction = await sequelize.transaction();
  try {
    const [row, created] = await EtLeaderCheckinToken.findOrCreate({
      where: { eventId },
      defaults: {
        eventId,
        tokenHash,
        expiresAt,
        rotatedAt: now,
        createdBy: userId || null,
      },
      transaction,
    });
    if (!created) {
      await row.update({
        tokenHash,
        expiresAt,
        rotatedAt: now,
        createdBy: userId || null,
      }, { transaction });
    }
    await transaction.commit();
    return {
      eventId: Number(eventId),
      eventName: event.name,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      token: plainToken,
      expiresAt,
      rotatedAt: now,
      earlyMinutes: EARLY_MINUTES,
      onTimeGraceMinutes: ON_TIME_GRACE_MINUTES,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getCheckinQrMeta(eventId) {
  const event = await assertEnglishTableEvent(eventId);
  const tokenRow = await getActiveTokenRow(eventId);
  return {
    eventId: event.id,
    eventName: event.name,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    hasToken: Boolean(tokenRow),
    expiresAt: tokenRow?.expiresAt || null,
    rotatedAt: tokenRow?.rotatedAt || null,
    earlyMinutes: EARLY_MINUTES,
    onTimeGraceMinutes: ON_TIME_GRACE_MINUTES,
  };
}

async function checkInWithQr(eventId, { teacherId, token, now = new Date() } = {}) {
  const event = await assertEnglishTableEvent(eventId);
  await assertAssignedLeader(eventId, teacherId);

  const plain = String(token || '').trim();
  if (!plain) {
    throw Object.assign(new Error('請提供現場簽到碼'), { status: 400, code: 'TOKEN_REQUIRED' });
  }

  const tokenRow = await getActiveTokenRow(eventId);
  if (!tokenRow) {
    throw Object.assign(new Error('本場尚未產生簽到 QR，請聯繫現場行政'), { status: 400, code: 'TOKEN_MISSING' });
  }
  if (tokenRow.expiresAt && now > new Date(tokenRow.expiresAt)) {
    throw Object.assign(new Error('簽到碼已過期，請聯繫現場行政重新產生'), { status: 400, code: 'TOKEN_EXPIRED' });
  }
  if (tokenRow.tokenHash !== hashToken(plain)) {
    throw Object.assign(new Error('簽到碼無效'), { status: 400, code: 'TOKEN_INVALID' });
  }

  const existing = await EtLeaderAttendance.findOne({
    where: { eventId, leaderTeacherId: teacherId },
  });
  if (existing) {
    throw Object.assign(new Error('您已完成本場簽到'), {
      status: 409,
      code: 'ALREADY_CHECKED_IN',
      data: serializeAttendance(existing),
    });
  }

  const status = resolveCheckInStatus(event, now);
  const row = await EtLeaderAttendance.create({
    eventId,
    leaderTeacherId: teacherId,
    checkInAt: now,
    status,
    method: METHOD.QR,
    markedBy: null,
    note: null,
  });
  return serializeAttendance(row);
}

async function listEventAttendance(eventId) {
  const event = await assertEnglishTableEvent(eventId);
  const [leaders, attendances] = await Promise.all([
    EtEventGroupLeader.findAll({
      where: { eventId },
      include: [{ model: Teacher, as: 'leader', attributes: ['id', 'name', 'studentId'], required: false }],
      order: [['groupLabel', 'ASC']],
    }),
    EtLeaderAttendance.findAll({
      where: { eventId },
      include: [{ model: Teacher, as: 'leader', attributes: ['id', 'name'], required: false }],
    }),
  ]);

  const attendanceByLeader = new Map(
    attendances.map((row) => [row.leaderTeacherId, serializeAttendance(row)])
  );

  const uniqueLeaders = new Map();
  for (const row of leaders) {
    if (!row.leaderTeacherId) continue;
    if (!uniqueLeaders.has(row.leaderTeacherId)) {
      uniqueLeaders.set(row.leaderTeacherId, {
        leaderTeacherId: row.leaderTeacherId,
        leaderName: row.leader?.name || null,
        studentId: row.leader?.studentId || null,
        groupLabels: [],
      });
    }
    uniqueLeaders.get(row.leaderTeacherId).groupLabels.push(row.groupLabel);
  }

  const window = getEventWindow(event);
  const now = new Date();
  const pastEnd = window ? now > window.endAt : false;

  const rows = Array.from(uniqueLeaders.values()).map((item) => {
    const attendance = attendanceByLeader.get(item.leaderTeacherId) || null;
    let derivedStatus = attendance?.status || null;
    if (!attendance && pastEnd) derivedStatus = 'absent';
    return {
      ...item,
      groupLabels: [...new Set(item.groupLabels)].sort((a, b) => a.localeCompare(b, 'zh-Hant')),
      attendance,
      derivedStatus,
    };
  });

  return {
    event: {
      id: event.id,
      name: event.name,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
    },
    earlyMinutes: EARLY_MINUTES,
    onTimeGraceMinutes: ON_TIME_GRACE_MINUTES,
    leaders: rows,
  };
}

async function manualUpsertAttendance(eventId, leaderTeacherId, {
  status = STATUS.MANUAL,
  note = null,
  userId = null,
  checkInAt = null,
} = {}) {
  const event = await assertEnglishTableEvent(eventId);
  const leaderId = Number(leaderTeacherId);
  if (!Number.isFinite(leaderId) || leaderId <= 0) {
    throw Object.assign(new Error('無效的 Leader ID'), { status: 400 });
  }

  const assigned = await EtEventGroupLeader.findOne({
    where: { eventId, leaderTeacherId: leaderId },
  });
  if (!assigned) {
    throw Object.assign(new Error('該帳號未被指派為本場 Leader'), { status: 400 });
  }

  const teacher = await Teacher.findByPk(leaderId);
  if (!teacher || teacher.isActive === false) {
    throw Object.assign(new Error('Leader 帳號不存在或已停用'), { status: 400 });
  }

  const allowed = new Set([STATUS.ON_TIME, STATUS.LATE, STATUS.MANUAL]);
  const nextStatus = allowed.has(status) ? status : STATUS.MANUAL;
  const at = checkInAt ? new Date(checkInAt) : new Date();
  if (Number.isNaN(at.getTime())) {
    throw Object.assign(new Error('簽到時間格式錯誤'), { status: 400 });
  }

  const [row, created] = await EtLeaderAttendance.findOrCreate({
    where: { eventId, leaderTeacherId: leaderId },
    defaults: {
      eventId,
      leaderTeacherId: leaderId,
      checkInAt: at,
      status: nextStatus,
      method: METHOD.MANUAL,
      markedBy: userId || null,
      note: note ? String(note).slice(0, 255) : null,
    },
  });

  if (!created) {
    await row.update({
      checkInAt: at,
      status: nextStatus,
      method: METHOD.MANUAL,
      markedBy: userId || null,
      note: note ? String(note).slice(0, 255) : null,
    });
  }

  const reloaded = await EtLeaderAttendance.findByPk(row.id, {
    include: [{ model: Teacher, as: 'leader', attributes: ['id', 'name'], required: false }],
  });
  return {
    eventId: event.id,
    attendance: serializeAttendance(reloaded),
  };
}

async function getAttendanceMapForEvents(eventIds = [], leaderTeacherId = null) {
  if (!eventIds.length) return new Map();
  const where = { eventId: eventIds };
  if (leaderTeacherId != null) where.leaderTeacherId = leaderTeacherId;
  const rows = await EtLeaderAttendance.findAll({ where });
  const map = new Map();
  for (const row of rows) {
    map.set(`${row.eventId}:${row.leaderTeacherId}`, serializeAttendance(row));
  }
  return map;
}

module.exports = {
  STATUS,
  METHOD,
  EARLY_MINUTES,
  ON_TIME_GRACE_MINUTES,
  hashToken,
  getEventWindow,
  resolveCheckInStatus,
  serializeAttendance,
  rotateCheckinQr,
  getCheckinQrMeta,
  checkInWithQr,
  listEventAttendance,
  manualUpsertAttendance,
  getAttendanceMapForEvents,
};
