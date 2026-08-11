const express = require('express');
const { authMiddleware, requireAnyPermission } = require('../middlewares/auth');
const { P } = require('../auth/permissions');
const mediaLibraryService = require('../services/mediaLibraryService');
const { mediaLibraryUpload } = require('../middlewares/mediaLibraryUpload');

const router = express.Router();

router.use(
  authMiddleware,
  requireAnyPermission(
    [P.CAN_MANAGE_SITE_CONTENT, P.CAN_MANAGE_ANNOUNCEMENTS],
    '需要學生端內容或公告／週報管理權限',
  ),
);

router.get('/media', async (req, res, next) => {
  try {
    const { scope, q, mimePrefix } = req.query || {};
    const includeInactive = String(req.query?.includeInactive || '') === '1';
    let scopeFilter = scope || null;
    if (typeof scope === 'string' && scope.includes(',')) {
      scopeFilter = scope.split(',').map((s) => s.trim()).filter(Boolean);
    }
    const assets = await mediaLibraryService.listMediaAssets({
      scope: scopeFilter,
      q: q || null,
      includeInactive,
      mimePrefix: mimePrefix || null,
    });
    return res.json({ assets });
  } catch (err) {
    return next(err);
  }
});

router.get('/media/:id', async (req, res, next) => {
  try {
    const asset = await mediaLibraryService.getMediaAssetById(req.params.id);
    return res.json(asset);
  } catch (err) {
    return next(err);
  }
});

router.get('/media/:id/references', async (req, res, next) => {
  try {
    const { MediaAsset } = require('../models');
    const row = await MediaAsset.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: '找不到媒體' });
    const references = await mediaLibraryService.findMediaReferences(row);
    return res.json({ references });
  } catch (err) {
    return next(err);
  }
});

router.post('/media/upload', mediaLibraryUpload.single('file'), async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const scope = req.body?.scope || 'general';
    const label = req.body?.label || null;
    const asset = await mediaLibraryService.createMediaFromUpload(req.file, {
      scope,
      label,
      actorId,
    });
    return res.status(201).json(asset);
  } catch (err) {
    return next(err);
  }
});

router.put('/media/:id', async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const updated = await mediaLibraryService.updateMediaAsset(req.params.id, req.body || {}, actorId);
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

router.delete('/media/:id', async (req, res, next) => {
  try {
    const force = String(req.query?.force || '') === '1' || req.body?.force === true;
    const result = await mediaLibraryService.deleteMediaAsset(req.params.id, { force });
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({
        error: err.message,
        code: err.code || 'MEDIA_IN_USE',
        references: err.details?.references || [],
      });
    }
    return next(err);
  }
});

module.exports = router;
