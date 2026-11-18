// 後台公告管理 API（auth + admin／執行長 + can_manage_announcements）
const announcementService = require('../services/announcementService');
const auditLogService = require('../services/auditLogService');
const notificationService = require('../services/notificationService');
const {
  createAnnouncementPreviewToken,
  verifyAnnouncementPreviewToken,
} = require('../services/announcementPreviewService');

function actorId(req) {
  return req.user && req.user.id ? req.user.id : null;
}

function annSnapshot(plain) {
  if (!plain) return null;
  return {
    id: plain.id,
    title: plain.title,
    slug: plain.slug,
    status: plain.status,
    isPublished: plain.isPublished,
    isPinned: plain.isPinned,
    publishedAt: plain.publishedAt,
    scheduledPublishAt: plain.scheduledPublishAt,
    category: plain.category,
  };
}

async function list(req, res, next) {
  try {
    const data = await announcementService.listAdmin({
      page: req.query.page,
      limit: req.query.limit,
      keyword: req.query.keyword,
      q: req.query.q,
      status: req.query.status,
      category: req.query.category,
      authorId: req.query.authorId,
      pinned: req.query.pinned,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      includeDeleted: req.query.includeDeleted,
    });
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const row = await announcementService.getByIdAdmin(req.params.id);
    if (!row) {
      return res.status(404).json({ error: '找不到公告' });
    }
    return res.json(announcementService.serializeAnnouncementForAdmin(row));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await announcementService.createAnnouncement(req.body, actorId(req));
    auditLogService.logAuditAsync({
      module: 'announcements',
      action: 'create',
      entityType: 'Announcement',
      entityId: data.id,
      targetSummary: data.title,
      afterData: annSnapshot(data),
      req,
      requestId: req.requestId || null,
    });
    return res.status(201).json(data);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await announcementService.getByIdAdmin(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: '找不到公告' });
    }
    const before = annSnapshot(announcementService.serializeAnnouncementForAdmin(existing));
    const row = await announcementService.updateAnnouncement(req.params.id, req.body, actorId(req));
    const after = announcementService.serializeAnnouncementForAdmin(row);
    auditLogService.logAuditAsync({
      module: 'announcements',
      action: 'update',
      entityType: 'Announcement',
      entityId: after.id,
      targetSummary: after.title,
      beforeData: before,
      afterData: annSnapshot(after),
      changedFields: auditLogService.diffShallow(before, annSnapshot(after)),
      req,
      requestId: req.requestId || null,
    });
    return res.json(after);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await announcementService.getByIdAdmin(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: '找不到公告' });
    }
    const before = annSnapshot(announcementService.serializeAnnouncementForAdmin(existing));
    await announcementService.deleteAnnouncement(req.params.id);
    auditLogService.logAuditAsync({
      module: 'announcements',
      action: 'delete',
      entityType: 'Announcement',
      entityId: String(before.id),
      targetSummary: before.title,
      beforeData: before,
      req,
      requestId: req.requestId || null,
    });
    return res.json({ success: true });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
}

async function postPublish(req, res, next) {
  try {
    const existing = await announcementService.getByIdAdmin(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: '找不到公告' });
    }
    const before = annSnapshot(announcementService.serializeAnnouncementForAdmin(existing));
    const row = await announcementService.publishAnnouncement(req.params.id, actorId(req), {
      publishedAt: req.body && req.body.publishedAt,
    });
    const after = announcementService.serializeAnnouncementForAdmin(row);
    auditLogService.logAuditAsync({
      module: 'announcements',
      action: 'published',
      entityType: 'Announcement',
      entityId: after.id,
      targetSummary: after.title,
      beforeData: before,
      afterData: annSnapshot(after),
      changedFields: auditLogService.diffShallow(before, annSnapshot(after)),
      req,
      requestId: req.requestId || null,
    });
    if (after.isPublished && !before?.isPublished) {
      const publisherId = actorId(req);
      if (publisherId) {
        notificationService
          .createNotification({
            userId: publisherId,
            type: 'announcement_publish',
            title: '公告已發布',
            content: `公告：${after.title}`,
            data: {
              announcementId: after.id,
              title: after.title,
              publishedAt: after.publishedAt,
            },
            requestId: req.requestId || null,
            relatedEntityType: 'Announcement',
            relatedEntityId: String(after.id),
          })
          .catch((err) => {
            console.error('寫入公告通知失敗:', err);
          });
      }
    }
    return res.json(after);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function postUnpublish(req, res, next) {
  try {
    const existing = await announcementService.getByIdAdmin(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: '找不到公告' });
    }
    const before = annSnapshot(announcementService.serializeAnnouncementForAdmin(existing));
    const row = await announcementService.unpublishAnnouncement(req.params.id, actorId(req));
    const after = announcementService.serializeAnnouncementForAdmin(row);
    auditLogService.logAuditAsync({
      module: 'announcements',
      action: 'unpublished',
      entityType: 'Announcement',
      entityId: after.id,
      targetSummary: after.title,
      beforeData: before,
      afterData: annSnapshot(after),
      changedFields: auditLogService.diffShallow(before, annSnapshot(after)),
      req,
      requestId: req.requestId || null,
    });
    return res.json(after);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function postArchive(req, res, next) {
  try {
    const existing = await announcementService.getByIdAdmin(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: '找不到公告' });
    }
    const before = annSnapshot(announcementService.serializeAnnouncementForAdmin(existing));
    const row = await announcementService.archiveAnnouncement(req.params.id, actorId(req));
    const after = announcementService.serializeAnnouncementForAdmin(row);
    auditLogService.logAuditAsync({
      module: 'announcements',
      action: 'archived',
      entityType: 'Announcement',
      entityId: after.id,
      targetSummary: after.title,
      beforeData: before,
      afterData: annSnapshot(after),
      changedFields: auditLogService.diffShallow(before, annSnapshot(after)),
      req,
      requestId: req.requestId || null,
    });
    return res.json(after);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function postDuplicate(req, res, next) {
  try {
    const copy = await announcementService.duplicateAnnouncement(req.params.id, actorId(req));
    auditLogService.logAuditAsync({
      module: 'announcements',
      action: 'duplicate',
      entityType: 'Announcement',
      entityId: copy.id,
      targetSummary: copy.title,
      afterData: annSnapshot(copy),
      req,
      requestId: req.requestId || null,
    });
    return res.status(201).json(copy);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function bulkAction(req, res, next) {
  try {
    const { action, ids } = req.body || {};
    const beforeMeta = { action, count: Array.isArray(ids) ? ids.length : 0 };
    const results = await announcementService.bulkAnnouncementsAction({ action, ids }, actorId(req));
    auditLogService.logAuditAsync({
      module: 'announcements',
      action: 'bulk_action',
      entityType: 'Announcement',
      entityId: 'bulk',
      targetSummary: `${action} ok=${results.ok} failed=${results.failed}`,
      afterData: { ...beforeMeta, ...results },
      req,
      requestId: req.requestId || null,
    });
    return res.json(results);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function getRevisions(req, res, next) {
  try {
    const rows = await announcementService.listRevisions(req.params.id);
    return res.json({ items: rows.map((r) => r.get({ plain: true })) });
  } catch (err) {
    next(err);
  }
}

async function postRestoreRevision(req, res, next) {
  try {
    const row = await announcementService.restoreRevision(req.params.id, req.params.revisionId, actorId(req));
    const after = announcementService.serializeAnnouncementForAdmin(row);
    auditLogService.logAuditAsync({
      module: 'announcements',
      action: 'restore_revision',
      entityType: 'Announcement',
      entityId: after.id,
      targetSummary: after.title,
      afterData: { revisionId: req.params.revisionId, snapshot: annSnapshot(after) },
      req,
      requestId: req.requestId || null,
    });
    return res.json(after);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

/** 相容舊客戶端：PATCH body { isPublished } */
async function patchPublish(req, res, next) {
  try {
    if (typeof req.body.isPublished !== 'boolean') {
      return res.status(400).json({ error: 'isPublished 必須為 boolean' });
    }
    const existing = await announcementService.getByIdAdmin(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: '找不到公告' });
    }
    const before = annSnapshot(announcementService.serializeAnnouncementForAdmin(existing));
    const row = await announcementService.setPublish(req.params.id, req.body, actorId(req));
    const after = announcementService.serializeAnnouncementForAdmin(row);
    auditLogService.logAuditAsync({
      module: 'announcements',
      action: 'publish_toggle',
      entityType: 'Announcement',
      entityId: after.id,
      targetSummary: after.title,
      beforeData: before,
      afterData: annSnapshot(after),
      changedFields: auditLogService.diffShallow(before, annSnapshot(after)),
      req,
      requestId: req.requestId || null,
    });
    if (after.isPublished && !before?.isPublished) {
      const publisherId = actorId(req);
      if (publisherId) {
        notificationService
          .createNotification({
            userId: publisherId,
            type: 'announcement_publish',
            title: '公告已發布',
            content: `公告：${after.title}`,
            data: {
              announcementId: after.id,
              title: after.title,
              publishedAt: after.publishedAt,
            },
            requestId: req.requestId || null,
            relatedEntityType: 'Announcement',
            relatedEntityId: String(after.id),
          })
          .catch((err) => {
            console.error('寫入公告通知失敗:', err);
          });
      }
    }
    return res.json(after);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function patchPin(req, res, next) {
  try {
    if (typeof req.body.isPinned !== 'boolean') {
      return res.status(400).json({ error: 'isPinned 必須為 boolean' });
    }
    const existing = await announcementService.getByIdAdmin(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: '找不到公告' });
    }
    const before = annSnapshot(announcementService.serializeAnnouncementForAdmin(existing));
    const row = await announcementService.setPin(req.params.id, req.body, actorId(req));
    const after = announcementService.serializeAnnouncementForAdmin(row);
    auditLogService.logAuditAsync({
      module: 'announcements',
      action: 'pin_toggle',
      entityType: 'Announcement',
      entityId: after.id,
      targetSummary: after.title,
      beforeData: before,
      afterData: annSnapshot(after),
      changedFields: auditLogService.diffShallow(before, annSnapshot(after)),
      req,
      requestId: req.requestId || null,
    });
    return res.json(after);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function postPreviewToken(req, res, next) {
  try {
    const existing = await announcementService.getByIdAdmin(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: '找不到公告' });
    }
    const token = createAnnouncementPreviewToken(existing.id, req.body && req.body.ttlSec);
    const verified = verifyAnnouncementPreviewToken(token);
    auditLogService.logAuditAsync({
      module: 'announcements',
      action: 'preview_token',
      entityType: 'Announcement',
      entityId: existing.id,
      targetSummary: existing.title,
      req,
      requestId: req.requestId || null,
    });
    return res.json({
      expiresAt: verified ? new Date(verified.exp * 1000).toISOString() : null,
      path: `/announcements/preview/${token}`,
      token,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: '無法產生預覽連結' });
    }
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  postPublish,
  postUnpublish,
  postArchive,
  postDuplicate,
  bulkAction,
  getRevisions,
  postRestoreRevision,
  patchPublish,
  patchPin,
  postPreviewToken,
};
