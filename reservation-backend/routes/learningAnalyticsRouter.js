'use strict';

const express = require('express');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const controller = require('../controllers/learningAnalyticsController');

const router = express.Router();

const ljView = [
  authMiddleware,
  requirePermission(P.CAN_VIEW_LEARNING_ANALYTICS),
];

const ljExport = [
  authMiddleware,
  requirePermission(P.CAN_EXPORT_LEARNING_ANALYTICS),
];

const ljManage = [
  authMiddleware,
  requirePermission(P.CAN_MANAGE_ENGLISH_TEST_TRACKING, '需要管理英語學習歷程權限'),
];

const ljModelRun = [
  authMiddleware,
  requirePermission(P.CAN_RUN_LEARNING_ANALYTICS_MODEL, '需要執行學習成效分析模型權限'),
];

const ljSettings = [
  authMiddleware,
  requirePermission(P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS),
];

router.get('/meta', ...ljView, controller.getMeta);
router.get('/settings', ...ljSettings, controller.getSettings);
router.put('/settings/resource-skill-profiles', ...ljSettings, controller.putResourceSkillProfiles);
router.post('/settings/resource-skill-profiles/:resourceKey/reset', ...ljSettings, controller.postResetResourceSkillProfile);
router.put('/settings/filter-references/:refType', ...ljSettings, controller.putFilterReferences);
router.put('/settings/lva-config', ...ljSettings, controller.putLvaConfig);
router.post('/settings/lva-config/reset', ...ljSettings, controller.postResetLvaConfig);
router.get('/overview', ...ljView, controller.getOverview);
router.get('/cohorts', ...ljView, controller.getCohorts);
router.get('/offerings', ...ljView, controller.getOfferings);
router.get('/offerings/detail', ...ljView, controller.getOfferingDetail);
router.get('/offerings/export', ...ljExport, controller.getOfferingExport);
router.get('/resources', ...ljView, controller.getResources);
router.get('/skills', ...ljView, controller.getSkills);
router.get('/insights', ...ljView, controller.getInsights);
router.get('/students/:studentId/recommendations', ...ljView, controller.requireStudentScope, controller.getStudentRecommendations);
router.get('/model-runs', ...ljView, controller.listModelRuns);
router.get('/model-runs/:id', ...ljView, controller.getModelRun);
router.post('/model-runs', ...ljModelRun, controller.postModelRun);
router.get('/students/:studentId/journey', ...ljView, controller.requireStudentScope, controller.getStudentJourney);
router.get('/raw-data', ...ljView, controller.getRawData);
router.get('/export', ...ljExport, controller.getExport);
router.post('/snapshots/prune', ...ljManage, controller.postPruneSnapshots);

module.exports = router;
