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
const { buildAccessProfile } = require('../auth/accessProfile');
const {
  assertCanAccessStudent,
  sendStudentScopeDenied,
} = require('../services/accessControl/studentScopeGuard');
const controller = require('../controllers/learningJourneyController');

const router = express.Router();

const ljRead = requireAnyPermission(
  [P.CAN_VIEW_ENGLISH_TEST_TRACKING, P.CAN_MANAGE_ENGLISH_TEST_TRACKING],
  '需要檢視英語學習歷程權限'
);
const ljManage = requirePermission(
  P.CAN_MANAGE_ENGLISH_TEST_TRACKING,
  '需要管理英語學習歷程權限'
);

function learningJourneyDeprecatedHeaders(req, res, next) {
  res.setHeader('X-EEARS-Deprecated', 'true');
  res.setHeader('X-EEARS-Replacement', '/api/admin/learning-journey-v3');
  next();
}
const excelUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) return cb(null, true);
    return cb(new Error('只允許上傳 Excel 檔案 (.xlsx, .xls)'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

function isSuperAdminUser(user) {
  if (!user) return false;
  return String(user.role || '').toLowerCase() === 'admin';
}

function isAdminPlusUser(user) {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  const role = String(user.role || '').toLowerCase();
  const level = String(user.teacherLevel || '').toLowerCase();
  if (role !== 'teacher') return false;
  return level === 'executive' || level === 'et_manager';
}

function requireAdminPlus(req, res, next) {
  if (!isAdminPlusUser(req.user)) {
    return res.status(403).json({ error: '權限不足（需 admin+）', requestId: req.requestId });
  }
  return next();
}

function requireSuperAdmin(req, res, next) {
  if (!isSuperAdminUser(req.user)) {
    return res.status(403).json({ error: '權限不足（需 super_admin）', requestId: req.requestId });
  }
  return next();
}

function hasFullCenterStudentScope(user) {
  const profile = buildAccessProfile(user);
  return profile.isAdmin || profile.isExecutive;
}

function requireFullCenterStudentScope(req, res, next) {
  if (!hasFullCenterStudentScope(req.user)) {
    return res.status(403).json({
      success: false,
      errorCode: 'DATA_SCOPE_DENIED',
      error: '此 legacy API 尚未支援學生範圍過濾，請改用 Learning Journey V3。',
      requestId: req.requestId,
    });
  }
  return next();
}

async function requireStudentScope(req, res, next) {
  try {
    const semesterId = req.params.semesterId || req.params.id || req.query.semesterId || req.query.semester;
    await assertCanAccessStudent(req.user, req.params.studentId, { semesterId });
    return next();
  } catch (err) {
    return sendStudentScopeDenied(res, err);
  }
}

router.use(authMiddleware);
router.use(learningJourneyDeprecatedHeaders);
router.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const latencyMs = Math.max(0, Date.now() - startedAt);
    console.info(
      `[learning-journey-latency] method=${req.method} path=${req.originalUrl} status=${res.statusCode} latencyMs=${latencyMs}`
    );
  });
  next();
});

router.get('/admin/reconciliation', requireAdminPlus, ljRead, controller.getReconciliation);
router.get('/admin/readiness', requireAdminPlus, ljRead, controller.getReadinessHandler);
router.get('/admin/read-model-status', requireAdminPlus, ljRead, controller.getReadModelStatusHandler);
router.get('/admin/data-freshness', requireAdminPlus, ljRead, controller.getDataFreshnessHandler);
router.get('/admin/governance-overview', requireAdminPlus, ljRead, controller.getGovernanceOverviewHandler);
router.get('/admin/jobs/recent', requireAdminPlus, ljRead, controller.getRecentJobsHandler);
router.get('/admin/legacy-usage-audit', requireAdminPlus, ljRead, controller.getLegacyUsageAuditReportHandler);
router.post('/admin/jobs/run-daily-governance', requireSuperAdmin, ljManage, controller.postRunDailyGovernanceJob);
router.post('/admin/jobs/reconcile-semester', requireSuperAdmin, ljManage, controller.postRunReconcileSemesterJob);
router.post('/admin/sync', requireSuperAdmin, ljManage, controller.postSync);
router.post(
  '/admin/course-import/dry-run',
  requireAdminPlus,
  ljManage,
  excelUpload.single('file'),
  controller.postCourseImportDryRun
);
router.post(
  '/admin/course-import/apply',
  requireSuperAdmin,
  ljManage,
  excelUpload.single('file'),
  controller.postCourseImportApply
);
router.post(
  '/admin/academic-course-roster/dry-run',
  requireAdminPlus,
  ljManage,
  excelUpload.single('file'),
  controller.postAcademicCourseRosterDryRun
);
router.post(
  '/admin/academic-course-roster/apply',
  requireSuperAdmin,
  ljManage,
  excelUpload.single('file'),
  controller.postAcademicCourseRosterApply
);
router.post(
  '/admin/enrollment-import/dry-run',
  requireAdminPlus,
  ljManage,
  excelUpload.single('file'),
  controller.postFinalEnrollmentImportDryRun
);
router.post(
  '/admin/enrollment-import/apply',
  requireSuperAdmin,
  ljManage,
  excelUpload.single('file'),
  controller.postFinalEnrollmentImportApply
);
router.post(
  '/admin/external-exam-import/dry-run',
  requireAdminPlus,
  ljManage,
  excelUpload.single('file'),
  controller.postFinalExternalExamImportDryRun
);
router.post(
  '/admin/external-exam-import/apply',
  requireSuperAdmin,
  ljManage,
  excelUpload.single('file'),
  controller.postFinalExternalExamImportApply
);
router.post('/admin/rebuild-final', requireSuperAdmin, ljManage, controller.postFinalRebuildHandler);

router.get('/semesters', ljRead, controller.getFinalSemestersHandler);
router.get('/semesters/:id/overview', ljRead, requireFullCenterStudentScope, controller.getFinalSemesterOverviewHandler);
router.get('/semesters/:id/import-histories', requireAdminPlus, ljRead, controller.getFinalImportHistoriesHandler);
router.get('/semesters/:id/students', ljRead, requireFullCenterStudentScope, controller.getFinalSemesterStudentsHandler);
router.get('/students/:studentId', ljRead, requireStudentScope, controller.getFinalStudentDetailHandler);

router.get('/semesters/:semesterId/english-test-summary', ljRead, requireFullCenterStudentScope, controller.getEnglishTestSummaryV3Handler);

router.get(
  '/semesters/:semesterId/english-test-students/:studentId',
  ljRead,
  requireStudentScope,
  controller.getEnglishTestStudentDetailV3Handler
);
router.get('/semesters/:semesterId/english-test-students', ljRead, requireFullCenterStudentScope, controller.getEnglishTestStudentsV3ListHandler);
router.get('/semesters/:semesterId/risk-students', ljRead, requireFullCenterStudentScope, controller.getRiskStudentsHandler);

router.get('/students/:studentId/profile', ljRead, requireStudentScope, controller.getStudentProfile);
router.get('/students/:studentId/timeline', ljRead, requireStudentScope, controller.getStudentTimeline);
router.get('/students/:studentId/courses', ljRead, requireStudentScope, controller.getStudentCoursesHandler);
router.get('/students/:studentId/consistency', ljRead, requireStudentScope, controller.getStudentConsistencyHandler);
router.get('/students/:studentId/report', ljRead, requireStudentScope, controller.getStudentReportHandler);
router.get('/semesters/:semesterId/dashboard', ljRead, requireFullCenterStudentScope, controller.getSemesterDashboard);
router.get('/semesters/:semesterId/metrics', ljRead, requireFullCenterStudentScope, controller.getSemesterMetrics);
router.post('/admin/rebuild-cache', requireSuperAdmin, ljManage, controller.rebuildCache);

module.exports = router;
