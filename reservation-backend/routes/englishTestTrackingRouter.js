const express = require('express');
const router = express.Router();
const { authMiddleware, englishTestDomainMiddleware } = require('../middlewares/auth');
const { legacyDeprecationHeaders } = require('../middlewares/legacyDeprecation');
const config = require('../config/englishTestTracking');
const {
  listSemesters,
  importEnrollmentHandler,
  importAttemptsHandler,
  recomputeHandler,
  reportGradeSkillSummary,
  reportDrilldown,
  getStudentAttempts,
  getStudentBestSkills,
  rollbackBatchHandler,
  upload
} = require('../controllers/englishTestTrackingController');

const markDeprecatedEnglishTracking = legacyDeprecationHeaders({
  sunset: '2026-06-30',
  replacementApi: '/api/v3/learning-journey',
  scope: 'legacy_english_test_tracking',
  blockCanonicalSemesterWrites: true
});

/**
 * @deprecated
 * Will be removed after Learning Journey fully replaces legacy English-test data flows.
 */
if (config.enabled) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Legacy Learning Journey English-test routes are deprecated. Use Learning Journey APIs.');
  }
  router.use(authMiddleware);
  // Domain 管理權限：admin 或 executive（學習歷程模組非 system-admin only）
  router.use(englishTestDomainMiddleware);
  router.use(markDeprecatedEnglishTracking);

  router.get('/semesters', listSemesters);
  router.post('/enrollment/import', upload.single('file'), importEnrollmentHandler);
  router.post('/attempts/import', upload.single('file'), importAttemptsHandler);
  router.post('/recompute', recomputeHandler);
  router.get('/report/semester/:semesterId/grade-skill-summary', reportGradeSkillSummary);
  router.get('/report/semester/:semesterId/drilldown/:grade/:skill', reportDrilldown);
  router.get('/student/:studentId/attempts', getStudentAttempts);
  router.get('/student/:studentId/best-skills', getStudentBestSkills);
  router.post('/rollback-batch', rollbackBatchHandler);
}

module.exports = router;
