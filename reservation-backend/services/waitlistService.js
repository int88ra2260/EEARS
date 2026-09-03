const { EventWaitlistEntry } = require('../models');
const auditLogService = require('./auditLogService');

const STATUS = {
  WAITING: 'waiting',
  PROMOTED: 'promoted',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

/**
 * 候補已停用：不再接受新登記
 */
async function joinWaitlist() {
  return {
    ok: false,
    code: 'WAITLIST_DISABLED',
    message: '本系統已不開放候補，請改選其他仍有名額的場次',
  };
}

/**
 * 既有 waiting 列標記 expired，不轉正、不寄信
 */
async function expireWaitingEntries({ reason = 'waitlist_disabled' } = {}) {
  const [affected] = await EventWaitlistEntry.update(
    {
      status: STATUS.EXPIRED,
      notes: reason,
    },
    { where: { status: STATUS.WAITING } }
  );
  return { expired: affected };
}

/**
 * 候補已停用：取消後不再自動轉正
 */
async function promoteNextWaitlistedStudent() {
  return { promoted: false, reason: 'waitlist_disabled' };
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
  expireWaitingEntries,
  promoteNextWaitlistedStudent,
  listEventWaitlist,
  cancelWaitlistEntry,
  STATUS,
};
