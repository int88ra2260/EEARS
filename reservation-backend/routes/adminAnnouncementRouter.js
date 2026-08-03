// /api/admin/announcements — 後台公告（auth + 管理權限 + can_manage_announcements + 限流；稽核寫入 audit_logs）
const express = require('express');
const { authMiddleware, requirePermission } = require('../middlewares/auth');
const { P } = require('../auth/permissions');
const { adminAnnouncementLimiter } = require('../middlewares/announcementGuards');
const adminAnnouncementController = require('../controllers/adminAnnouncementController');

const router = express.Router();

router.use(
  authMiddleware,
  requirePermission(P.CAN_MANAGE_ANNOUNCEMENTS, '需要公告管理權限'),
  adminAnnouncementLimiter
);

router.post('/bulk-action', adminAnnouncementController.bulkAction);

router.get('/:id/revisions', adminAnnouncementController.getRevisions);
router.post('/:id/restore-revision/:revisionId', adminAnnouncementController.postRestoreRevision);

router.post('/:id/publish', adminAnnouncementController.postPublish);
router.post('/:id/unpublish', adminAnnouncementController.postUnpublish);
router.post('/:id/archive', adminAnnouncementController.postArchive);
router.post('/:id/duplicate', adminAnnouncementController.postDuplicate);

router.get('/', adminAnnouncementController.list);
router.get('/:id', adminAnnouncementController.getById);
router.post('/', adminAnnouncementController.create);
router.put('/:id', adminAnnouncementController.update);
router.patch('/:id/publish', adminAnnouncementController.patchPublish);
router.patch('/:id/pin', adminAnnouncementController.patchPin);
router.delete('/:id', adminAnnouncementController.remove);

module.exports = router;
