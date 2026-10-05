const dayjs = require('dayjs');
const { violationDeletedStatusCopy } = require('../utils/studentNoticeCopy');
const { Op } = require('sequelize');
const { Reservation, Event, BlackListRecord, EventViolation } = require('../models');
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

function isNoticeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

/**
 * 刪除違規後通知學生。沒有信箱或佇列失敗時不影響刪除結果。
 */
async function enqueueViolationDeletedEmail(user, record, { requestId } = {}) {
  const email = String(user?.email || '').trim();
  if (!isNoticeEmail(email)) return { queued: false, reason: 'no_email' };

  const deletedSemester = resolveSemesterId(record?.recordedAt);
  const currentSemester = getCurrentSemester();
  const status = violationDeletedStatusCopy({
    affectsCurrentSemester: Boolean(deletedSemester && deletedSemester === currentSemester),
    isBlacklisted: !!user.isBlacklisted,
    blacklistUntil: user.blacklistUntil ? dayjs(user.blacklistUntil).format('YYYY-MM-DD') : '',
  });

  const emailQueue = require('../utils/emailQueue');
  try {
    await emailQueue.enqueue('violationRecordDeleted', {
      name: user.name,
      studentName: user.name,
      studentId: user.studentId,
      email,
      recordedAt: record?.recordedAt ? dayjs(record.recordedAt).format('YYYY-MM-DD') : '',
      reason: String(record?.reason || '').trim() || '未填寫',
      violationCount: user.violationCount ?? 0,
      statusZh: status.statusZh,
      statusEn: status.statusEn,
    }, {
      requestId: requestId || `violation-deleted:${user.id}`,
      relatedEntityType: 'blacklist',
      relatedEntityId: user.id,
    });
    return { queued: true };
  } catch (err) {
    console.error('違規刪除通知加入佇列失敗:', err);
    return { queued: false, reason: 'queue_failed' };
  }
}

function reasonMatchesViolation(reason, violation) {
  const text = String(reason || '').trim();
  const type = String(violation?.violationType || '').trim();
  const description = String(violation?.description || '');
  if (!text) return false;
  if (text === '預約未到') return type === '預約未到';
  if (text === '活動期間違規') return Boolean(type) && type !== '預約未到';
  if (text === type) return true;
  return description.includes(text);
}

/**
 * 刪除黑名單違規時，挑出學生進度仍顯示「未到／違規」的那一筆活動。
 * 只有一筆時直接對上；多筆時依原因與記錄時間，避免把另一筆還在的違規清掉。
 */
function pickViolationToClear(record, violations) {
  const open = (violations || []).filter((item) => item?.reservation?.checkinStatus === '已登記違規');
  if (open.length === 0) return null;
  if (open.length === 1) return open[0];

  const reason = String(record?.reason || '').trim();
  const matched = open.filter((item) => reasonMatchesViolation(reason, item));
  const pool = matched.length > 0
    ? matched
    : (reason === '預約未到' || reason === '活動期間違規' ? open : []);
  if (pool.length === 0) return null;

  const targetMs = new Date(record?.recordedAt).getTime();
  return pool.reduce((best, item) => {
    if (!best) return item;
    const bestDelta = Math.abs(new Date(best.recordedAt).getTime() - targetMs);
    const itemDelta = Math.abs(new Date(item.recordedAt).getTime() - targetMs);
    return itemDelta < bestDelta ? item : best;
  }, null);
}

function restoredCheckinStatus(reservation) {
  return reservation?.checkinTime ? '已簽到' : '未簽到';
}

/**
 * 違規紀錄刪除後，把對應預約從「已登記違規」改回，並移除活動違規列。
 * 學生進度頁的「未到／違規」讀的是預約狀態，不是黑名單表。
 */
async function clearStudentVisibleViolation(userId, record, { transaction } = {}) {
  const userIdNum = Number(userId);
  if (!Number.isInteger(userIdNum) || userIdNum <= 0) return { cleared: false };

  const queryOpts = transaction ? { transaction } : {};
  const [eventViolations, reservations] = await Promise.all([
    EventViolation.findAll({ where: { userId: userIdNum }, ...queryOpts }),
    Reservation.findAll({
      where: { userId: userIdNum, checkinStatus: '已登記違規' },
      ...queryOpts,
    }),
  ]);

  const reservationByEventId = new Map(reservations.map((row) => [Number(row.eventId), row]));
  const seenReservationIds = new Set();
  const candidates = [];

  for (const violation of eventViolations) {
    const reservation = reservationByEventId.get(Number(violation.eventId)) || null;
    if (reservation) seenReservationIds.add(reservation.id);
    candidates.push({
      id: violation.id,
      eventId: violation.eventId,
      violationType: violation.violationType,
      description: violation.description,
      recordedAt: violation.recordedAt,
      reservation,
    });
  }

  for (const reservation of reservations) {
    if (seenReservationIds.has(reservation.id)) continue;
    candidates.push({
      id: null,
      eventId: reservation.eventId,
      violationType: '',
      description: '',
      recordedAt: record?.recordedAt,
      reservation,
    });
  }

  const picked = pickViolationToClear(record, candidates);
  if (!picked?.reservation) return { cleared: false };

  const nextStatus = restoredCheckinStatus(picked.reservation);
  await picked.reservation.update({ checkinStatus: nextStatus }, queryOpts);
  if (picked.id) {
    const row = eventViolations.find((item) => item.id === picked.id);
    if (row) await row.destroy(queryOpts);
  }

  return {
    cleared: true,
    eventId: picked.eventId,
    reservationId: picked.reservation.id,
    checkinStatus: nextStatus,
  };
}

module.exports = {
  computeBlacklistUnlockDate,
  cancelReservationsWithinBlacklistWindow,
  enqueueBlacklistNotificationEmails,
  countViolationsInSemester,
  syncSemesterViolationCountAndMaybeBlacklist,
  afterViolationRecordDeleted,
  enqueueViolationDeletedEmail,
  resolveSemesterId,
  pickViolationToClear,
  restoredCheckinStatus,
  clearStudentVisibleViolation,
};
