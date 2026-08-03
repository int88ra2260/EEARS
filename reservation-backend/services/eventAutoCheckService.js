const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { Event, Reservation, User, EventViolation, BlackListRecord, sequelize } = require('../models');
const auditLogService = require('./auditLogService');
const {
  computeBlacklistUnlockDate,
  cancelReservationsWithinBlacklistWindow,
  enqueueBlacklistNotificationEmails,
} = require('./blacklistEnforcementService');

dayjs.extend(utc);
dayjs.extend(timezone);

async function runEventAutoCheck({
  eventId,
  req = null,
  triggeredBy = 'manual',
  recordedBy = 'system',
} = {}) {
  const transaction = await sequelize.transaction();
  try {
    const event = await Event.findByPk(eventId, {
      include: [
        {
          model: Reservation,
          include: [User],
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!event) {
      await transaction.rollback();
      return { ok: false, notFound: true, error: '活動不存在' };
    }

    if (event.autoCheckCompleted) {
      await transaction.rollback();
      return { ok: false, alreadyCompleted: true, error: '此活動已經執行過活動結束檢查，無法重複執行' };
    }

  const results = {
    processedCount: 0,
    violationRecords: 0,
    noShowRecords: 0,
    noShowViolationsCreated: 0,
    errors: [],
  };
  const pendingBlacklistEmails = [];

    const eventViolations = await EventViolation.findAll({
      where: { eventId: event.id },
      attributes: ['userId', 'violationType'],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const violationUserIds = new Set(eventViolations.map((v) => Number(v.userId)));
    const noShowViolationUserIds = new Set(
      eventViolations
        .filter((v) => v.violationType === '預約未到')
        .map((v) => Number(v.userId))
    );

  // 先把未簽到學生補建為「預約未到」違規，讓「批次未到」完整包含在活動結束檢查流程內。
  for (const reservation of event.Reservations) {
    const user = reservation.User;
    if (!user) continue;
    const userId = Number(user.id);
    if (reservation.checkinStatus !== '未簽到') continue;
    if (violationUserIds.has(userId)) continue;

    await EventViolation.create({
      eventId: event.id,
      userId: user.id,
      violationType: '預約未到',
      description: '活動當天未簽到（活動結束檢查自動登記）',
      recordedBy,
      recordedAt: new Date(),
    }, { transaction });

    reservation.checkinStatus = '已登記違規';
    await reservation.save({ transaction });

    violationUserIds.add(userId);
    noShowViolationUserIds.add(userId);
    results.noShowViolationsCreated += 1;
  }

  // 同一活動同一學生僅計算一次，避免重複累加 violationCount。
  const processedUserIds = new Set();
  for (const reservation of event.Reservations) {
    const user = reservation.User;
    if (!user) continue;
    const userId = Number(user.id);
    if (processedUserIds.has(userId)) continue;
    processedUserIds.add(userId);
    results.processedCount += 1;

    if (!violationUserIds.has(userId)) continue;

    const reason = noShowViolationUserIds.has(userId) ? '預約未到' : '活動期間違規';
    await BlackListRecord.create({
      userId: user.id,
      recordedAt: new Date(),
      reason,
    }, { transaction });

    user.violationCount += 1;
    if (user.violationCount >= 2) {
      const now = dayjs();
      const unlockDate = computeBlacklistUnlockDate(now);
      user.isBlacklisted = true;
      user.blacklistUntil = unlockDate.toDate();
      await user.save({ transaction });

      const emailPayloads = await cancelReservationsWithinBlacklistWindow({
        user,
        unlockDate,
        now,
        transaction,
      });
      emailPayloads.forEach((payload) => {
        pendingBlacklistEmails.push({ payload, userId: user.id });
      });
    } else {
      await user.save({ transaction });
    }

    if (reason === '預約未到') results.noShowRecords += 1;
    else results.violationRecords += 1;
  }

    event.autoCheckCompleted = true;
    await event.save({ transaction });
    await transaction.commit();

    pendingBlacklistEmails.forEach(({ payload, userId }) => {
      enqueueBlacklistNotificationEmails([payload], {
        requestId: req?.requestId,
        userId,
      });
    });

  auditLogService.logAuditAsync({
    module: 'events',
    action: 'auto_check',
    entityType: 'Event',
    entityId: event.id,
    targetSummary: `eventId=${event.id}`,
    afterData: {
      triggeredBy,
      processedCount: results.processedCount,
      violationRecords: results.violationRecords,
      noShowRecords: results.noShowRecords,
      noShowViolationsCreated: results.noShowViolationsCreated,
      errorCount: results.errors.length,
      autoCheckCompleted: true,
    },
    req,
    operatorName: req?.user?.name || req?.user?.user || recordedBy || null,
  });

    return {
      ok: true,
      eventId: event.id,
      results,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = {
  runEventAutoCheck,
};
