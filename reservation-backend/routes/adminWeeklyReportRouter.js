const express = require('express');
const adminWeeklyReportController = require('../controllers/adminWeeklyReportController');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const { weeklyReportApiTokenAuth } = require('../middlewares/apiTokenAuth');

const router = express.Router();

/**
 * 驗證中間件：支援兩種方式
 * 1. API Token (透過 WEEKLY_REPORT_API_TOKEN 環境變數)
 * 2. 標準登入驗證 (authMiddleware + 權限檢查)
 */
const authWithApiToken = weeklyReportApiTokenAuth((req, res, next) => {
  // 備用：使用標準登入驗證
  authMiddleware(req, res, (err) => {
    if (err) return next(err);
    requirePermission(P.CAN_MANAGE_ANNOUNCEMENTS)(req, res, next);
  });
});

// 所有路由都使用 API Token 或標準驗證
router.use(authWithApiToken);

router.get('/', adminWeeklyReportController.list);
router.get('/:id/analytics', adminWeeklyReportController.analytics);
router.post('/:id/duplicate', adminWeeklyReportController.duplicate);
router.post('/:id/preview-token', adminWeeklyReportController.previewToken);
router.get('/:id', adminWeeklyReportController.getById);
router.post('/', adminWeeklyReportController.create);
router.put('/:id', adminWeeklyReportController.update);
router.delete('/:id', adminWeeklyReportController.remove);

module.exports = router;
