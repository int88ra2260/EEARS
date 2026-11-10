const express = require('express');
const { authMiddleware, requireAnyPermission } = require('../middlewares/auth');
const { P } = require('../auth/permissions');
const leaderPublicProfileService = require('../services/leaderPublicProfileService');
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
    const leader = await leaderPublicProfileService.createProfile(req.body, actorId(req));
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

module.exports = router;
