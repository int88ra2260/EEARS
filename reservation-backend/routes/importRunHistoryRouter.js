const express = require('express');
const { authMiddleware, requireAnyPermission, P } = require('../middlewares/auth');
const {
  getImportRuns,
  getImportRunDetail,
  deleteImportRun,
} = require('../controllers/importRunHistoryController');

const router = express.Router();

router.use(
  authMiddleware,
  requireAnyPermission([
    P.CAN_IMPORT_BESTEP,
    P.CAN_MANAGE_ENGLISH_TEST_TRACKING,
    P.CAN_VIEW_ENGLISH_TEST_TRACKING,
    P.CAN_MANAGE_CLASSES,
    P.CAN_VIEW_CLASSES,
    P.CAN_VIEW_EVENTS_ADMIN,
    P.CAN_MANAGE_EVENTS,
    P.CAN_VIEW_SURVEYS,
    P.CAN_EXPORT_SURVEYS,
  ])
);
router.get('/', getImportRuns);
router.delete(
  '/:source/:sourceId',
  requireAnyPermission(
    [
      P.CAN_IMPORT_BESTEP,
      P.CAN_MANAGE_ENGLISH_TEST_TRACKING,
      P.CAN_MANAGE_CLASSES,
      P.CAN_MANAGE_EVENTS,
      P.CAN_CHECKIN_STUDENTS,
    ],
    '需要匯入或維運管理權限才能刪除匯入紀錄',
  ),
  deleteImportRun,
);
router.get('/:source/:sourceId', getImportRunDetail);

module.exports = router;
