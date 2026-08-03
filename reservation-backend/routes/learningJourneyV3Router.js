'use strict';

const express = require('express');
const path = require('path');
const multer = require('multer');
const {
  authMiddleware,
  requirePermission,
  requireAnyPermission,
  P,
} = require('../middlewares/auth');
const controller = require('../controllers/learningJourneyV3Controller');
const analyticsController = require('../controllers/learningJourneyAnalyticsController');

const router = express.Router();

const excelUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) return cb(null, true);
    return cb(new Error('只允許上傳 Excel 檔案 (.xlsx, .xls)'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

/** 讀取學習歷程 V3（儀表板、學生、趨勢、匯入紀錄列表） */
const ljRead = requireAnyPermission(
  [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  '需要檢視英語學習歷程權限'
);
/** 匯入、刪除匯入紀錄等寫入 */
const ljManage = requirePermission(
  P.CAN_MANAGE_ENGLISH_TEST_TRACKING,
  '需要管理英語學習歷程（匯入／刪除）權限'
);

router.use(authMiddleware);

router.get('/students/:studentId/timeline', ljRead, analyticsController.requireStudentScope, analyticsController.getTimeline);
router.get('/analytics/students', ljRead, analyticsController.getAnalyticsStudents);
router.get('/analytics/exams', ljRead, analyticsController.getAnalyticsExams);
router.get('/analytics/summary', ljRead, analyticsController.getAnalyticsSummary);
router.get('/analytics/lva', ljRead, analyticsController.getLvaAnalytics);
router.get('/analytics/lva/model-runs', ljRead, analyticsController.listLvaModelRuns);
router.get('/analytics/lva/model-runs/:id', ljRead, analyticsController.getLvaModelRun);
router.post('/analytics/lva/model-runs', ljManage, analyticsController.postLvaModelRun);
router.get('/exports/research', ljRead, analyticsController.getResearchExport);
router.get('/quality/assertions', ljRead, analyticsController.getQualityAssertions);
router.post('/analytics/rebuild', ljManage, analyticsController.postAnalyticsRebuild);

router.get('/semesters/:id/b2-report', ljRead, controller.getB2Report);
router.get('/semesters/:id/breakdown', ljRead, controller.getBreakdown);
router.get('/semesters/:id/health', ljRead, controller.getSemesterHealth);
router.post('/semesters/:id/rebuild', ljManage, controller.postSemesterRebuild);
router.get('/semesters/:id/students', ljRead, controller.getStudents);
router.get('/students/:studentId/profile', ljRead, controller.getStudent);
router.get('/students/:studentId/trends', ljRead, controller.getStudentTrendsHandler);
router.get('/students/:studentId', ljRead, controller.getStudent);
router.get('/operation-runs', ljRead, controller.getOperationRuns);
router.get('/operation-runs/export.csv', ljRead, controller.exportOperationRunsCsv);
router.post('/operation-runs/cleanup-dry-run', ljManage, controller.postOperationRunsCleanupDryRun);
router.post('/operation-runs/cleanup-archive', ljManage, controller.postOperationRunsCleanupArchive);
router.get('/operation-runs/:id', ljRead, controller.getOperationRunDetail);
router.get('/import/histories', ljRead, controller.getImportHistories);
router.delete('/import/histories/:id', ljManage, controller.deleteImportHistory);

router.post('/import/enrollment', ljManage, excelUpload.single('file'), controller.postEnrollmentImport);
router.post('/import/exam', ljManage, excelUpload.single('file'), controller.postExamImport);
router.post('/import/baseline', ljManage, excelUpload.single('file'), controller.postBaselineImport);
router.post('/sync/ewl', ljManage, controller.postEwlSync);

module.exports = router;
