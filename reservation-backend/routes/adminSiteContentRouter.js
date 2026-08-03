const express = require('express');
const { authMiddleware, requirePermission } = require('../middlewares/auth');
const { P } = require('../auth/permissions');
const adminSiteContentController = require('../controllers/adminSiteContentController');

const router = express.Router();

router.use(
  authMiddleware,
  requirePermission(P.CAN_MANAGE_SITE_CONTENT, '需要網站文案管理權限')
);

router.get('/sections', adminSiteContentController.listSections);
router.post('/faq', adminSiteContentController.createFaq);
router.post('/faq/reorder', adminSiteContentController.reorderFaq);
router.post('/faq/seed', adminSiteContentController.seedFaq);
router.put('/faq/:id', adminSiteContentController.updateFaq);
router.post('/staff/:section/reorder', adminSiteContentController.reorderStaff);
router.post('/staff/:section/seed', adminSiteContentController.seedStaff);
router.post('/staff/:section', adminSiteContentController.createStaff);
router.put('/staff/:id', adminSiteContentController.updateStaff);
router.post('/:section/text/seed', adminSiteContentController.seedText);
router.get('/:section', adminSiteContentController.listBySection);
router.put('/:section/text', adminSiteContentController.upsertText);
router.delete('/:id', adminSiteContentController.remove);

module.exports = router;
