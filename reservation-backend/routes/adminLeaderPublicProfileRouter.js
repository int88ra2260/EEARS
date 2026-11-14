const express = require('express');
const { authMiddleware, requireAnyPermission } = require('../middlewares/auth');
const { P } = require('../auth/permissions');
const leaderPublicProfileService = require('../services/leaderPublicProfileService');
const siteContentService = require('../services/siteContentService');
const mediaLibraryService = require('../services/mediaLibraryService');
const auditLogService = require('../services/auditLogService');
const { mediaLibraryUpload } = require('../middlewares/mediaLibraryUpload');

const router = express.Router();

const canEdit = requireAnyPermission(
  [P.CAN_MANAGE_ET_GROUPING, P.CAN_MANAGE_SITE_CONTENT],
  '需要 ET 分組或學生端內容管理權限',
);

function actorId(req) {
  return req.user?.id ?? null;
}

function sendServiceError(res, err, next) {
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  return next(err);
}

router.use(authMiddleware, canEdit);

router.get('/media', async (req, res, next) => {
  try {
    const assets = await mediaLibraryService.listMediaAssets({ mimePrefix: 'image/' });
    return res.json({ assets });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.post('/media/upload', mediaLibraryUpload.single('file'), async (req, res, next) => {
  try {
    const asset = await mediaLibraryService.createMediaFromUpload(req.file, {
      scope: 'general',
      label: req.body?.label || null,
      actorId: actorId(req),
    });
    return res.status(201).json(asset);
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

// ============ 學期管理 ============

router.get('/semesters', async (req, res, next) => {
  try {
    const semesters = await leaderPublicProfileService.listAvailableSemesters();
    return res.json({ semesters });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.get('/semester/:semesterId', async (req, res, next) => {
  try {
    const leaders = await leaderPublicProfileService.listAdminBySemester(req.params.semesterId);
    return res.json({ leaders, semesterId: req.params.semesterId });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.put('/semester/:semesterId/reorder', async (req, res, next) => {
  try {
    const leaders = await leaderPublicProfileService.reorderInSemester(
      req.params.semesterId,
      req.body?.ids
    );
    return res.json({ leaders });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.post('/semester/:semesterId/copy', async (req, res, next) => {
  try {
    const result = await leaderPublicProfileService.copyFromSemester(
      req.body?.sourceSemesterId,
      req.params.semesterId
    );
    auditLogService.logAuditAsync({
      module: 'leader_public_profile',
      action: 'copy_semester',
      entityType: 'LeaderSemesterAssignment',
      entityId: null,
      targetSummary: `從 ${req.body?.sourceSemesterId} 複製到 ${req.params.semesterId}`,
      afterData: result,
      req,
    });
    return res.json(result);
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.post('/semester/:semesterId/assign/:leaderId', async (req, res, next) => {
  try {
    const leader = await leaderPublicProfileService.assignToSemester(
      req.params.leaderId,
      req.params.semesterId,
      req.body
    );
    auditLogService.logAuditAsync({
      module: 'leader_public_profile',
      action: 'assign_semester',
      entityType: 'LeaderSemesterAssignment',
      entityId: leader.semesterAssignment?.id,
      targetSummary: `${leader.displayName} → ${req.params.semesterId}`,
      afterData: leader,
      req,
    });
    return res.status(201).json(leader);
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.delete('/semester/:semesterId/leader/:leaderId', async (req, res, next) => {
  try {
    await leaderPublicProfileService.removeFromSemester(
      req.params.leaderId,
      req.params.semesterId
    );
    auditLogService.logAuditAsync({
      module: 'leader_public_profile',
      action: 'remove_from_semester',
      entityType: 'LeaderSemesterAssignment',
      entityId: null,
      targetSummary: `Leader ${req.params.leaderId} 從 ${req.params.semesterId} 移除`,
      req,
    });
    return res.json({ success: true });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.put('/assignment/:assignmentId', async (req, res, next) => {
  try {
    const leader = await leaderPublicProfileService.updateSemesterAssignment(
      req.params.assignmentId,
      req.body
    );
    return res.json(leader);
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

// ============ 封存管理 ============

router.get('/archived', async (req, res, next) => {
  try {
    const leaders = await leaderPublicProfileService.listArchivedLeaders();
    return res.json({ leaders });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.post('/:id/archive', async (req, res, next) => {
  try {
    const leader = await leaderPublicProfileService.archiveProfile(req.params.id, actorId(req));
    auditLogService.logAuditAsync({
      module: 'leader_public_profile',
      action: 'archive',
      entityType: 'LeaderPublicProfile',
      entityId: leader.id,
      targetSummary: leader.displayName,
      afterData: leader,
      req,
    });
    return res.json(leader);
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.post('/:id/unarchive', async (req, res, next) => {
  try {
    const leader = await leaderPublicProfileService.unarchiveProfile(req.params.id, actorId(req));
    auditLogService.logAuditAsync({
      module: 'leader_public_profile',
      action: 'unarchive',
      entityType: 'LeaderPublicProfile',
      entityId: leader.id,
      targetSummary: leader.displayName,
      afterData: leader,
      req,
    });
    return res.json(leader);
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

// ============ Leader CRUD ============

router.get('/', async (req, res, next) => {
  try {
    const leaders = await leaderPublicProfileService.listAdmin();
    return res.json({ leaders });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const semesterId = req.body?.semesterId;
    const leader = await leaderPublicProfileService.createProfile(req.body, actorId(req), semesterId);
    auditLogService.logAuditAsync({
      module: 'leader_public_profile',
      action: 'create',
      entityType: 'LeaderPublicProfile',
      entityId: leader.id,
      targetSummary: leader.displayName,
      afterData: leader,
      req,
    });
    return res.status(201).json(leader);
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.put('/reorder', async (req, res, next) => {
  try {
    const leaders = await leaderPublicProfileService.reorderProfiles(req.body?.ids);
    return res.json({ leaders });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const leader = await leaderPublicProfileService.updateProfile(req.params.id, req.body, actorId(req));
    auditLogService.logAuditAsync({
      module: 'leader_public_profile',
      action: 'update',
      entityType: 'LeaderPublicProfile',
      entityId: leader.id,
      targetSummary: leader.displayName,
      afterData: leader,
      req,
    });
    return res.json(leader);
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const removed = await leaderPublicProfileService.deleteProfile(req.params.id);
    auditLogService.logAuditAsync({
      module: 'leader_public_profile',
      action: 'delete',
      entityType: 'LeaderPublicProfile',
      entityId: removed.id,
      targetSummary: removed.displayName,
      beforeData: removed,
      req,
    });
    return res.json({ success: true });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

// ============ 輪播圖片管理 ============

router.get('/carousel', async (req, res, next) => {
  try {
    const data = await siteContentService.listAdmin({ section: 'leaders_carousel' });
    return res.json(data);
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.post('/carousel', async (req, res, next) => {
  try {
    const slide = await siteContentService.createLeadersCarouselEntry(req.body, actorId(req));
    auditLogService.logAuditAsync({
      module: 'leaders_carousel',
      action: 'create',
      entityType: 'SiteContentEntry',
      entityId: slide.id,
      targetSummary: slide.label,
      afterData: slide,
      req,
    });
    return res.status(201).json(slide);
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.put('/carousel/reorder', async (req, res, next) => {
  try {
    const data = await siteContentService.reorderLeadersCarousel(req.body?.ids, actorId(req));
    return res.json(data);
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.put('/carousel/:id', async (req, res, next) => {
  try {
    const slide = await siteContentService.updateLeadersCarouselEntry(req.params.id, req.body, actorId(req));
    auditLogService.logAuditAsync({
      module: 'leaders_carousel',
      action: 'update',
      entityType: 'SiteContentEntry',
      entityId: slide.id,
      targetSummary: slide.label,
      afterData: slide,
      req,
    });
    return res.json(slide);
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

router.delete('/carousel/:id', async (req, res, next) => {
  try {
    const removed = await siteContentService.deleteEntry(req.params.id, {
      entryType: siteContentService.ENTRY_LEADERS_CAROUSEL,
    });
    auditLogService.logAuditAsync({
      module: 'leaders_carousel',
      action: 'delete',
      entityType: 'SiteContentEntry',
      entityId: removed.id,
      targetSummary: removed.contentKey || `slide-${removed.id}`,
      beforeData: removed,
      req,
    });
    return res.json({ success: true });
  } catch (err) {
    return sendServiceError(res, err, next);
  }
});

module.exports = router;
