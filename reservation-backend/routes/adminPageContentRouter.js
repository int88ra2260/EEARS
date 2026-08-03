const express = require('express');
const { authMiddleware, requirePermission } = require('../middlewares/auth');
const { P } = require('../auth/permissions');
const pageContentService = require('../services/pageContentService');
const { regulationsFormsUpload } = require('../middlewares/regulationsFormsUpload');

const router = express.Router();

router.use(
  authMiddleware,
  requirePermission(P.CAN_MANAGE_SITE_CONTENT, '需要網站文案管理權限'),
);

// Learning resources
router.get('/page-content/learning-resources', async (req, res, next) => {
  try {
    const data = await pageContentService.listLearningResources({ admin: true });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

router.post('/page-content/learning-resources/:kind', async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const created = await pageContentService.createLearningResource(req.params.kind, req.body || {}, actorId);
    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

router.put('/page-content/learning-resources/:kind/:id', async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const updated = await pageContentService.updateLearningResource(
      req.params.kind,
      req.params.id,
      req.body || {},
      actorId,
    );
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

router.delete('/page-content/learning-resources/:kind/:id', async (req, res, next) => {
  try {
    const ok = await pageContentService.deleteLearningResource(req.params.kind, req.params.id);
    if (!ok) return res.status(404).json({ error: '找不到內容' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

router.post('/page-content/learning-resources/:kind/reorder', async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const { ids } = req.body || {};
    const result = await pageContentService.reorderLearningResources(req.params.kind, ids, actorId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// Regulations forms
router.get('/page-content/regulations-forms', async (req, res, next) => {
  try {
    const data = await pageContentService.listRegulationsForms({ admin: true });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

router.post('/page-content/regulations-forms/groups', async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const created = await pageContentService.createRegulationsGroup(req.body || {}, actorId);
    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

router.put('/page-content/regulations-forms/groups/:id', async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const updated = await pageContentService.updateRegulationsGroup(req.params.id, req.body || {}, actorId);
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

router.delete('/page-content/regulations-forms/groups/:id', async (req, res, next) => {
  try {
    const ok = await pageContentService.deleteRegulationsGroup(req.params.id);
    if (!ok) return res.status(404).json({ error: '找不到群組' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

router.post('/page-content/regulations-forms/groups/reorder', async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const { ids } = req.body || {};
    const result = await pageContentService.reorderRegulationsGroups(ids, actorId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/page-content/regulations-forms/items', async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const created = await pageContentService.createRegulationsItem(req.body || {}, actorId);
    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

router.put('/page-content/regulations-forms/items/:id', async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const updated = await pageContentService.updateRegulationsItem(req.params.id, req.body || {}, actorId);
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

router.delete('/page-content/regulations-forms/items/:id', async (req, res, next) => {
  try {
    const ok = await pageContentService.deleteRegulationsItem(req.params.id);
    if (!ok) return res.status(404).json({ error: '找不到項目' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

router.post('/page-content/regulations-forms/items/reorder', async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const { ids } = req.body || {};
    const result = await pageContentService.reorderRegulationsItems(ids, actorId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// Upload PDF (for item.fileUrl)
router.post(
  '/page-content/regulations-forms/upload/pdf',
  regulationsFormsUpload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: '請選擇檔案' });
      const fileUrl = `/uploads/regulations-forms/${req.file.filename}`;
      return res.status(201).json({
        fileUrl,
        originalName: req.file.originalname,
        storedName: req.file.filename,
      });
    } catch (err) {
      return next(err);
    }
  },
);

// Scroll world test segments
router.get('/page-content/scroll-world-test', async (req, res, next) => {
  try {
    const segments = await pageContentService.listScrollWorldSegments({ admin: true });
    return res.json({ segments });
  } catch (err) {
    return next(err);
  }
});

router.put('/page-content/scroll-world-test/:sectionId', async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const updated = await pageContentService.updateScrollWorldSegment(req.params.sectionId, req.body || {}, actorId);
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

router.post('/page-content/scroll-world-test/reorder', async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const { sectionIds } = req.body || {};
    const result = await pageContentService.reorderScrollWorldSegments(sectionIds, actorId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

