const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission, adminOrExecutiveMiddleware, P } = require('../middlewares/auth');
const surveyHealthService = require('../services/surveyHealthService');
const readinessService = require('../services/surveyReleaseReadinessService');
const repairService = require('../services/surveyRepairExecutionService');

router.get('/overview', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_VIEW_SURVEY_HEALTH), async (req, res, next) => {
  try {
    res.json(await surveyHealthService.getHealthOverview());
  } catch (e) {
    next(e);
  }
});

router.get('/problems', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_VIEW_SURVEY_HEALTH), async (req, res, next) => {
  try {
    res.json(await surveyHealthService.getHealthProblems());
  } catch (e) {
    next(e);
  }
});

router.get('/rules', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_VIEW_SURVEY_HEALTH), async (req, res, next) => {
  try {
    res.json(await surveyHealthService.getRuleHealth());
  } catch (e) {
    next(e);
  }
});

router.get('/readiness', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_VIEW_SURVEY_HEALTH), async (req, res, next) => {
  try {
    res.json(await readinessService.getReleaseReadiness());
  } catch (e) {
    next(e);
  }
});

router.get('/recent-runs', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_VIEW_SURVEY_REPAIR_AUDIT), async (req, res, next) => {
  try {
    const rows = await repairService.listRepairRuns({ ...req.query });
    res.json(rows.slice(0, 20));
  } catch (e) {
    next(e);
  }
});

router.post('/recheck/semester', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_EXECUTE_SURVEY_REPAIRS), async (req, res, next) => {
  try {
    const dryRun = req.body?.dryRun !== false;
    res.json(await surveyHealthService.recheckSemester({ dryRun }));
  } catch (e) {
    next(e);
  }
});

router.post('/recheck/version', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_EXECUTE_SURVEY_REPAIRS), async (req, res, next) => {
  try {
    const dryRun = req.body?.dryRun !== false;
    res.json(await surveyHealthService.recheckVersion({ dryRun }));
  } catch (e) {
    next(e);
  }
});

router.post('/recheck/answers', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_EXECUTE_SURVEY_REPAIRS), async (req, res, next) => {
  try {
    const dryRun = req.body?.dryRun !== false;
    res.json(await surveyHealthService.recheckAnswers({ dryRun }));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
