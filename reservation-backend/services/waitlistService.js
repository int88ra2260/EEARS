const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { sequelize, Event, Reservation, User, EventWaitlistEntry } = require('../models');
const { calculateReservationTime } = require('../utils/reservationTime');
const { validateStudentId, validateName } = require('../utils/validators');
const auditLogService = require('./auditLogService');
const emailQueue = require('../utils/emailQueue');
const logger = require('../utils/logger');

const STATUS = {
  WAITING: 'waiting',
  PROMOTED: 'promoted',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

function generateCancellationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function computeWaitingPosition(entry, transaction) {
  return EventWaitlistEntry.count({
    where: {
      eventId: entry.eventId,
      status: STATUS.WAITING,
      [Op.or]: [
        { createdAt: { [Op.lt]: entry.createdAt } },
        {
          [Op.and]: [{ createdAt: entry.createdAt }, { id: { [Op.lte]: entry.id } }],
        },
      ],
    },
    transaction,
  });
}

/**
 * 學生加入候補（額滿、同一預約時間窗與問卷規則與正式預約一致）
 */
async function joinWaitlist({ eventId, studentId, studentName, studentEmail, requestId, req }) {
  if (!eventId) {
    return { ok: false, code: 'MISSING_EVENT_ID', message: '缺少必要欄位：eventId' };
  }
  const trimmedStudentId = String(studentId || '').trim();
  const trimmedStudentName = String(studentName || '').trim();
  const trimmedStudentEmail = String(studentEmail || '').trim();

  if (!trimmedStudentId) {
    return { ok: false, code: 'MISSING_STUDENT_ID', message: '缺少必要欄位：studentId' };
  }
  if (!trimmedStudentName) {
    return { ok: false, code: 'MISSING_STUDENT_NAME', message: '缺少必要欄位：studentName' };
  }
  if (!trimmedStudentEmail) {
    return { ok: false, code: 'MISSING_STUDENT_EMAIL', message: '缺少必要欄位：studentEmail' };
  }
  if (!validateStudentId(trimmedStudentId)) {
    return { ok: false, code: 'INVALID_STUDENT_ID', message: '學號格式錯誤，應為(B/M/D/N/I/J)+9位數字' };
  }
  if (!validateName(trimmedStudentName)) {
    return { ok: false, code: 'INVALID_NAME', message: '姓名只能包含中文或英文' };
  }

  const inner = await sequelize.transaction(async (transaction) => {
    const event = await Event.findByPk(eventId, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!event) {
      return { ok: false, code: 'EVENT_NOT_FOUND', message: '活動不存在' };
    }

    const eventStart = dayjs(`${event.date}T${event.startTime}`);
    const now = dayjs();
    if (now.isAfter(eventStart)) {
      return { ok: false, code: 'EVENT_ENDED', message: '活動已結束' };
    }

    const { openStart, openEnd } = calculateReservationTime(event);
    if (now.isBefore(openStart) || now.isAfter(openEnd)) {
      return {
        ok: false,
        code: 'NOT_IN_BOOKING_WINDOW',
        message: `不在開放候補時間內( ${openStart.format('YYYY/MM/DD HH:mm')} ~ ${openEnd.format('YYYY/MM/DD HH:mm')} )`,
      };
    }

    const currentReservations = await Reservation.count({ where: { eventId: event.id }, transaction });
    const availableSpots = event.maxCapacity - currentReservations;
    if (availableSpots > 0) {
      return {
        ok: false,
        code: 'SPOTS_AVAILABLE',
        message: '活動仍有名額，請直接預約，無需加入候補',
      };
    }

    let user = await User.findOne({ where: { studentId: trimmedStudentId }, transaction });
    if (!user) {
      user = await User.create(
        {
          studentId: trimmedStudentId,
          name: trimmedStudentName,
          email: trimmedStudentEmail,
        },
        { transaction }
      );
    } else {
      await user.update({ name: trimmedStudentName, email: trimmedStudentEmail }, { transaction });
    }

    if (user.isBlacklisted && user.blacklistUntil && dayjs(user.blacklistUntil).isAfter(dayjs())) {
      return { ok: false, code: 'BLACKLIST', message: '您目前在黑名單封禁期間，無法候補' };
    }

    const existingReservation = await Reservation.findOne({
      where: {
        eventId: event.id,
        [Op.or]: [{ studentId: trimmedStudentId }, { studentEmail: trimmedStudentEmail }],
      },
      transaction,
    });
    if (existingReservation) {
      return { ok: false, code: 'ALREADY_RESERVED', message: '您已報名此活動' };
    }

    const existingWaiting = await EventWaitlistEntry.findOne({
      where: { eventId: event.id, studentId: trimmedStudentId, status: STATUS.WAITING },
      transaction,
    });
    if (existingWaiting) {
      const position = await computeWaitingPosition(existingWaiting, transaction);
      return {
        ok: false,
        code: 'ALREADY_WAITLISTED',
        message: '您已在候補名單中',
        position,
      };
    }

    const entry = await EventWaitlistEntry.create(
      {
        eventId: event.id,
        studentId: trimmedStudentId,
        studentName: trimmedStudentName,
        studentEmail: trimmedStudentEmail,
        status: STATUS.WAITING,
      },
      { transaction }
    );

    const position = await computeWaitingPosition(entry, transaction);

    return {
      ok: true,
      status: STATUS.WAITING,
      position,
      message: '已加入候補名單',
      entryId: entry.id,
      event: {
        id: event.id,
        name: event.name,
        eventType: event.eventType,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
      },
      studentSnapshot: {
        studentId: trimmedStudentId,
        studentName: trimmedStudentName,
        studentEmail: trimmedStudentEmail,
      },
    };
  });

  if (inner.ok) {
    auditLogService.logAuditAsync({
      module: 'waitlist',
      action: 'WAITLIST_JOINED',
      entityType: 'EventWaitlistEntry',
      entityId: String(inner.entryId),
      targetSummary: `eventId=${inner.event.id}`,
      afterData: {
        id: inner.entryId,
        eventId: inner.event.id,
        studentId: inner.studentSnapshot.studentId,
        position: inner.position,
      },
      req,
    });

    emailQueue
      .enqueue(
        'waitlistJoined',
        {
          studentId: inner.studentSnapshot.studentId,
          studentName: inner.studentSnapshot.studentName,
          studentEmail: inner.studentSnapshot.studentEmail,
          eventName: inner.event.name,
          eventType: inner.event.eventType,
          date: inner.event.date,
          startTime: inner.event.startTime,
          endTime: inner.event.endTime,
          position: inner.position,
        },
        {
          requestId,
          relatedEntityType: 'event_waitlist_entry',
          relatedEntityId: inner.entryId,
        }
      )
      .catch((err) => {
        logger.error('候補加入通知信加入佇列失敗', err);
      });
  }

  return inner;
}

/**
 * 釋出名額後，將第一位候補轉為正式預約（transaction + 名額檢查；信與稽核於 commit 後）
 */
async function promoteNextWaitlistedStudent({ eventId, triggeredBy = 'cancellation', requestId = null, req = null }) {
  let postCommit = null;

  const txnOutcome = await sequelize.transaction(async (transaction) => {
    const event = await Event.findByPk(eventId, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!event) {
      return { promoted: false, reason: 'no_event' };
    }

    let reserved = await Reservation.count({ where: { eventId }, transaction });
    if (reserved >= event.maxCapacity) {
      return { promoted: false, reason: 'full' };
    }

    const nextEntry = await EventWaitlistEntry.findOne({
      where: { eventId, status: STATUS.WAITING },
      order: [
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!nextEntry) {
      return { promoted: false, reason: 'no_waitlist' };
    }

    reserved = await Reservation.count({ where: { eventId }, transaction });
    if (reserved >= event.maxCapacity) {
      return { promoted: false, reason: 'full_after_lock' };
    }

    const dup = await Reservation.findOne({
      where: {
        eventId,
        [Op.or]: [{ studentId: nextEntry.studentId }, { studentEmail: nextEntry.studentEmail }],
      },
      transaction,
    });
    if (dup) {
      logger.warn('候補轉正略過：學生已有正式預約', { eventId, studentId: nextEntry.studentId });
      await nextEntry.update(
        {
          status: STATUS.CANCELLED,
          cancelledAt: new Date(),
          notes: 'promote_skipped_existing_reservation',
        },
        { transaction }
      );
      return { promoted: false, reason: 'waitlist_conflict_reservation' };
    }

    let user = await User.findOne({ where: { studentId: nextEntry.studentId }, transaction });
    if (!user) {
      user = await User.create(
        {
          studentId: nextEntry.studentId,
          name: nextEntry.studentName,
          email: nextEntry.studentEmail,
        },
        { transaction }
      );
    } else {
      await user.update(
        { name: nextEntry.studentName, email: nextEntry.studentEmail },
        { transaction }
      );
    }

    const cancellationCode = generateCancellationCode();
    const reservation = await Reservation.create(
      {
        eventId: event.id,
        studentId: nextEntry.studentId,
        studentName: nextEntry.studentName,
        studentEmail: nextEntry.studentEmail,
        userId: user.id,
        timestamp: new Date(),
        cancellationCode,
      },
      { transaction }
    );

    await nextEntry.update(
      {
        status: STATUS.PROMOTED,
        promotedReservationId: reservation.id,
        promotedAt: new Date(),
      },
      { transaction }
    );

    postCommit = {
      reservation,
      waitlistEntryId: nextEntry.id,
      event,
      cancellationCode,
    };
    return { promoted: true };
  });

  if (!postCommit) {
    return txnOutcome;
  }

  const { reservation, waitlistEntryId, event, cancellationCode } = postCommit;

  auditLogService.logAuditAsync({
    module: 'waitlist',
    action: 'WAITLIST_PROMOTED',
    entityType: 'EventWaitlistEntry',
    entityId: String(waitlistEntryId),
    targetSummary: `eventId=${event.id},reservationId=${reservation.id}`,
    afterData: {
      waitlistEntryId,
      reservationId: reservation.id,
      studentId: reservation.studentId,
      triggeredBy,
    },
    req,
  });

  emailQueue
    .enqueue(
      'waitlistPromoted',
      {
        studentId: reservation.studentId,
        studentName: reservation.studentName,
        studentEmail: reservation.studentEmail,
        eventName: event.name,
        eventType: event.eventType,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        cancellationCode,
      },
      {
        requestId,
        relatedEntityType: 'reservation',
        relatedEntityId: reservation.id,
      }
    )
    .catch((err) => {
      logger.error('候補轉正通知信加入佇列失敗', err);
    });

  return {
    promoted: true,
    reservationId: reservation.id,
    waitlistEntryId,
  };
}

async function listEventWaitlist({ eventId }) {
  const rows = await EventWaitlistEntry.findAll({
    where: { eventId },
    order: [
      ['createdAt', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  const waitingRows = rows.filter((r) => r.status === STATUS.WAITING);
  const items = rows.map((r) => {
    let position = null;
    if (r.status === STATUS.WAITING) {
      position = waitingRows.findIndex((w) => w.id === r.id) + 1;
    }
    return {
      id: r.id,
      position,
      studentId: r.studentId,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      status: r.status,
      createdAt: r.createdAt,
    };
  });
  return { items };
}

async function cancelWaitlistEntry({ id, reason, actor, req }) {
  const entry = await EventWaitlistEntry.findByPk(id);
  if (!entry) {
    return { ok: false, code: 'NOT_FOUND' };
  }
  if (entry.status !== STATUS.WAITING) {
    return { ok: false, code: 'NOT_WAITING' };
  }
  await entry.update({
    status: STATUS.CANCELLED,
    cancelledAt: new Date(),
    notes: reason || null,
  });
  auditLogService.logAuditAsync({
    module: 'waitlist',
    action: 'WAITLIST_CANCELLED',
    entityType: 'EventWaitlistEntry',
    entityId: String(entry.id),
    targetSummary: `eventId=${entry.eventId}`,
    afterData: { reason: reason || null, actor: actor || null },
    req,
  });
  return { ok: true };
}

module.exports = {
  joinWaitlist,
  promoteNextWaitlistedStudent,
  listEventWaitlist,
  cancelWaitlistEntry,
  STATUS,
};
