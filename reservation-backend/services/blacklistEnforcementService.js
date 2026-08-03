const dayjs = require('dayjs');
const { Reservation, Event } = require('../models');

function computeBlacklistUnlockDate(baseTime = dayjs()) {
  const dayOfWeek = baseTime.day();
  const daysToAdd = dayOfWeek === 0 ? 7 : 14 - dayOfWeek;
  return baseTime
    .add(daysToAdd, 'day')
    .hour(23)
    .minute(59)
    .second(59)
    .millisecond(0);
}

function buildBlacklistEmailPayload(user, reservation, unlockDate) {
  return {
    name: user.name,
    studentId: user.studentId,
    email: user.email,
    eventName: reservation.Event.name,
    eventType: reservation.Event.eventType,
    date: reservation.Event.date,
    startTime: reservation.Event.startTime,
    endTime: reservation.Event.endTime,
    unlockDate: unlockDate.format('YYYY/MM/DD HH:mm'),
  };
}

/**
 * 取消黑名單期間內的未來預約，並回傳待寄送的黑名單通知 payload。
 */
async function cancelReservationsWithinBlacklistWindow({
  user,
  unlockDate,
  now = dayjs(),
  transaction = null,
}) {
  const queryOpts = {
    where: { userId: user.id },
    include: [Event],
  };
  if (transaction) queryOpts.transaction = transaction;

  const reservations = await Reservation.findAll(queryOpts);
  const emailPayloads = [];

  for (const reservation of reservations) {
    if (!reservation.Event || !user.email) continue;
    const eventStart = dayjs(`${reservation.Event.date}T${reservation.Event.startTime}`);
    if (eventStart.isAfter(now) && eventStart.isBefore(unlockDate)) {
      const destroyOpts = transaction ? { transaction } : {};
      await reservation.destroy(destroyOpts);
      emailPayloads.push(buildBlacklistEmailPayload(user, reservation, unlockDate));
    }
  }

  return emailPayloads;
}

function enqueueBlacklistNotificationEmails(payloads, { requestId, userId } = {}) {
  if (!payloads || payloads.length === 0) return;

  const emailQueue = require('../utils/emailQueue');
  const rid = requestId || `blacklist:${Date.now()}`;

  payloads.forEach((payload) => {
    emailQueue.enqueue('blacklistNotification', payload, {
      requestId: rid,
      relatedEntityType: 'blacklist',
      relatedEntityId: userId,
    }).catch((err) => {
      console.error('郵件加入佇列失敗:', err);
    });
  });
}

module.exports = {
  computeBlacklistUnlockDate,
  cancelReservationsWithinBlacklistWindow,
  enqueueBlacklistNotificationEmails,
};
