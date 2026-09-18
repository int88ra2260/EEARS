const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { Reservation, Event, BlackListRecord } = require('../models');
const {
  SEMESTER_RANGES,
  semesterIdFromDate,
  getCurrentSemester,
} = require('../utils/semesterConstants');

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

function resolveSemesterId(atDate = new Date()) {
  return semesterIdFromDate(atDate) || getCurrentSemester(atDate) || '';
}

function getSemesterRecordedAtWhere(semesterId) {
  const range = SEMESTER_RANGES[String(semesterId || '').trim()];
  if (!range) return null;
  return {
    [Op.gte]: new Date(`${range.start}T00:00:00+08:00`),
    [Op.lte]: new Date(`${range.end}T23:59:59.999+08:00`),
  };
}

/**
 * 計算學生在指定時間所屬學期內的違規次數（跨學期不累計）。
 */
async function countViolationsInSemester(userId, { atDate = new Date(), transaction = null } = {}) {
  const semesterId = resolveSemesterId(atDate);
  if (!userId || !semesterId) return 0;

  const recordedAtWhere = getSemesterRecordedAtWhere(semesterId);
  if (recordedAtWhere) {
    const queryOpts = {
      where: {
        userId,
        recordedAt: recordedAtWhere,
      },
    };
    if (transaction) queryOpts.transaction = transaction;
    return BlackListRecord.count(queryOpts);
  }

  // 無靜態區間時：以學期推算逐筆比對（後備）
  const queryOpts = {
    where: { userId },
    attributes: ['recordedAt'],
  };
  if (transaction) queryOpts.transaction = transaction;
  const rows = await BlackListRecord.findAll(queryOpts);
  return rows.filter((row) => resolveSemesterId(row.recordedAt) === semesterId).length;
}

/**
 * 依當學期 BlackListRecord 重算 violationCount，達門檻則進入黑名單。
 * 不會因「當學期次數 < 2」而解除既有黑名單期間（跨學期解封窗仍以 blacklistUntil 為準）。
 */
async function syncSemesterViolationCountAndMaybeBlacklist(user, {
  transaction = null,
  now = dayjs(),
  cancelReservations = true,
} = {}) {
  const atDate = dayjs.isDayjs(now) ? now.toDate() : now;
  const violationCount = await countViolationsInSemester(user.id, { atDate, transaction });
  user.violationCount = violationCount;

  let unlockDate = null;
  let emailPayloads = [];
  let blacklistedNow = false;

  if (violationCount >= 2) {
    unlockDate = computeBlacklistUnlockDate(dayjs(atDate));
    user.isBlacklisted = true;
    user.blacklistUntil = unlockDate.toDate();
    blacklistedNow = true;
    if (cancelReservations) {
      emailPayloads = await cancelReservationsWithinBlacklistWindow({
        user,
        unlockDate,
        now: dayjs(atDate),
        transaction,
      });
    }
  }

  const saveOpts = transaction ? { transaction } : {};
  await user.save(saveOpts);

  return {
    violationCount,
    blacklistedNow,
    unlockDate,
    emailPayloads,
  };
}

/**
 * 刪除違規紀錄後：重算當學期次數；僅當「刪除的是當學期紀錄」且次數 < 2 時解除黑名單。
 */
async function afterViolationRecordDeleted(user, deletedRecordedAt, { transaction = null } = {}) {
  const deletedSemester = resolveSemesterId(deletedRecordedAt);
  const currentSemester = getCurrentSemester();
  const violationCount = await countViolationsInSemester(user.id, {
    atDate: new Date(),
    transaction,
  });
  user.violationCount = violationCount;

  if (deletedSemester && deletedSemester === currentSemester && violationCount < 2) {
    user.isBlacklisted = false;
    user.blacklistUntil = null;
  }

  const saveOpts = transaction ? { transaction } : {};
  await user.save(saveOpts);
  return { violationCount };
}

module.exports = {
  computeBlacklistUnlockDate,
  cancelReservationsWithinBlacklistWindow,
  enqueueBlacklistNotificationEmails,
  countViolationsInSemester,
  syncSemesterViolationCountAndMaybeBlacklist,
  afterViolationRecordDeleted,
  resolveSemesterId,
};
