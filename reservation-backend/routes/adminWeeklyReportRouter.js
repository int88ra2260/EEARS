const express = require('express');
const adminWeeklyReportController = require('../controllers/adminWeeklyReportController');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');

const router = express.Router();

router.use(authMiddleware, requirePermission(P.CAN_MANAGE_ANNOUNCEMENTS));

router.get('/', adminWeeklyReportController.list);
router.get('/:id/analytics', adminWeeklyReportController.analytics);
router.post('/:id/duplicate', adminWeeklyReportController.duplicate);
router.post('/:id/preview-token', adminWeeklyReportController.previewToken);
router.get('/:id', adminWeeklyReportController.getById);
router.post('/', adminWeeklyReportController.create);
router.put('/:id', adminWeeklyReportController.update);
router.delete('/:id', adminWeeklyReportController.remove);

module.exports = router;
