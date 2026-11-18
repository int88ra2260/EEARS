const { Op } = require('sequelize');
const {
  Announcement,
  Notification,
  StudentAccount,
  Teacher,
  User,
} = require('../models');
const emailQueue = require('../utils/emailQueue');

const TEACHER_AUDIENCE_ROLES = ['teacher', 'office_staff', 'worker', 'leader'];

function publicAnnouncementUrl(plain) {
  const base = String(process.env.FRONTEND_URL || 'http://emieears-siwan.nsysu.edu.tw').replace(/\/$/, '');
  const segment = plain.slug || plain.id;
  return `${base}/announcements/${encodeURIComponent(segment)}`;
}

function summaryText(plain) {
  const raw = plain.summary || '';
  return String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

function wantsStudents(audienceType) {
  return audienceType === 'all' || audienceType === 'students';
}

function teacherRoleMatches(audienceType, role) {
  if (audienceType === 'all') return true;
  if (audienceType === 'admins') return role === 'admin';
  if (audienceType === 'teachers') return TEACHER_AUDIENCE_ROLES.includes(role);
  return false;
}

async function loadEmailRecipients(audienceType) {
  const byEmail = new Map();

  if (wantsStudents(audienceType)) {
    const accounts = await StudentAccount.findAll({
      where: {
        status: 'active',
        emailVerifiedAt: { [Op.ne]: null },
        email: { [Op.ne]: '' },
      },
      attributes: ['email', 'name'],
      raw: true,
    });
    for (const account of accounts) {
      const email = String(account.email || '').trim();
      if (!email) continue;
      byEmail.set(email.toLowerCase(), { email, recipientName: account.name || '' });
    }
  }

  const teachers = await Teacher.findAll({
    where: { isActive: true, isDemo: false },
    attributes: ['email', 'name', 'role'],
    raw: true,
  });
  for (const teacher of teachers) {
    if (!teacherRoleMatches(audienceType, teacher.role)) continue;
    const email = String(teacher.email || '').trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (!byEmail.has(key)) {
      byEmail.set(key, { email, recipientName: teacher.name || '' });
    }
  }

  return Array.from(byEmail.values());
}

async function loadNotificationUserIds(audienceType) {
  if (!wantsStudents(audienceType)) return [];
  const accounts = await StudentAccount.findAll({
    where: {
      status: 'active',
      emailVerifiedAt: { [Op.ne]: null },
    },
    attributes: ['studentId'],
    raw: true,
  });
  const studentIds = accounts.map((row) => row.studentId).filter(Boolean);
  const userIds = [];
  for (let i = 0; i < studentIds.length; i += 400) {
    const chunk = studentIds.slice(i, i + 400);
    const users = await User.findAll({
      where: { studentId: { [Op.in]: chunk } },
      attributes: ['id'],
      raw: true,
    });
    for (const user of users) userIds.push(user.id);
  }
  return userIds;
}

async function claimOutreach(plain) {
  const wantNote = !!plain.shouldSendNotification && !plain.notificationStatus;
  const wantMail = !!plain.shouldSendEmail && !plain.emailStatus;
  if (!wantNote && !wantMail) {
    return { claimed: false, wantNote: false, wantMail: false };
  }
  const patch = {};
  const where = { id: plain.id };
  if (wantNote) {
    patch.notificationStatus = 'sending';
    where.notificationStatus = null;
  }
  if (wantMail) {
    patch.emailStatus = 'sending';
    where.emailStatus = null;
  }
  const [updated] = await Announcement.update(patch, { where });
  return { claimed: updated > 0, wantNote, wantMail };
}

/**
 * 發布後依已儲存的 shouldSendNotification／shouldSendEmail 送出。
 * 站內通知只寫入既有預約 Users（學生收件匣）。教師與管理者走 Email。
 * 失敗不丟出，避免發布主流程回滾。
 */
async function dispatchAnnouncementOutreach(row, { requestId } = {}) {
  const plain = row && typeof row.get === 'function' ? row.get({ plain: true }) : row;
  if (!plain || !plain.id) return { notified: 0, emailed: 0 };

  if (!plain.shouldSendNotification && !plain.shouldSendEmail) {
    await Announcement.update({
      notificationStatus: plain.notificationStatus || 'skipped',
      emailStatus: plain.emailStatus || 'skipped',
    }, {
      where: {
        id: plain.id,
        notificationStatus: null,
        emailStatus: null,
      },
    });
    return { notified: 0, emailed: 0, skipped: true };
  }

  const claim = await claimOutreach(plain);
  if (!claim.claimed) return { notified: 0, emailed: 0, already: true };

  let notified = 0;
  let emailed = 0;
  const finalPatch = {};

  if (claim.wantNote) {
    try {
      const userIds = await loadNotificationUserIds(plain.audienceType || 'all');
      const content = summaryText(plain) || plain.title;
      const now = new Date();
      for (let i = 0; i < userIds.length; i += 200) {
        const slice = userIds.slice(i, i + 200);
        await Notification.bulkCreate(slice.map((userId) => ({
          userId,
          type: 'announcement_publish',
          title: String(plain.title || '').slice(0, 200),
          content,
          data: {
            announcementId: plain.id,
            slug: plain.slug || null,
          },
          readAt: null,
          requestId: requestId || null,
          relatedEntityType: 'Announcement',
          relatedEntityId: String(plain.id),
          createdAt: now,
        })));
        notified += slice.length;
      }
      finalPatch.notificationStatus = notified > 0 ? 'sent' : 'no_inbox';
    } catch (error) {
      finalPatch.notificationStatus = 'failed';
      console.error('[announcementOutreach] 站內通知未完成');
    }
  }

  if (claim.wantMail) {
    try {
      const recipients = await loadEmailRecipients(plain.audienceType || 'all');
      const url = publicAnnouncementUrl(plain);
      const summary = summaryText(plain);
      for (const recipient of recipients) {
        await emailQueue.enqueue('announcementPublished', {
          email: recipient.email,
          recipientName: recipient.recipientName,
          title: plain.title,
          summary,
          url,
        }, {
          requestId: requestId || `announcement:${plain.id}`,
          relatedEntityType: 'Announcement',
          relatedEntityId: String(plain.id),
        });
        emailed += 1;
      }
      finalPatch.emailStatus = emailed > 0 ? 'queued' : 'no_recipient';
    } catch (error) {
      finalPatch.emailStatus = 'failed';
      console.error('[announcementOutreach] 公告信未完成');
    }
  }

  if (Object.keys(finalPatch).length) {
    await Announcement.update(finalPatch, { where: { id: plain.id } });
  }

  return {
    notified,
    emailed,
    notificationStatus: finalPatch.notificationStatus || null,
    emailStatus: finalPatch.emailStatus || null,
  };
}

module.exports = {
  dispatchAnnouncementOutreach,
  publicAnnouncementUrl,
  teacherRoleMatches,
};
