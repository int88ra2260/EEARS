const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission, adminOrExecutiveMiddleware, P } = require('../middlewares/auth');
const repairService = require('../services/surveyRepairExecutionService');

function ensureExecutionEnabled(req, res, next) {
  const enabled = String(process.env.SURVEY_REPAIR_EXECUTION_ENABLED || 'true').toLowerCase() === 'true';
  if (!enabled) return res.status(403).json({ code: 'REPAIR_EXECUTION_DISABLED', message: 'SURVEY_REPAIR_EXECUTION_ENABLED=false' });
  return next();
}

router.post('/preview/semester', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_VIEW_SURVEY_HEALTH), async (req, res, next) => {
  try {
    const run = await repairService.previewRepair('semester_backfill', req.body || {}, req.user);
    res.json(run);
  } catch (e) {
    next(e);
  }
});

router.post('/preview/version', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_VIEW_SURVEY_HEALTH), async (req, res, next) => {
  try {
    const run = await repairService.previewRepair('version_resolution', req.body || {}, req.user);
    res.json(run);
  } catch (e) {
    next(e);
  }
});

router.post('/preview/answers', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_VIEW_SURVEY_HEALTH), async (req, res, next) => {
  try {
    const run = await repairService.previewRepair('answer_recheck', req.body || {}, req.user);
    res.json(run);
  } catch (e) {
    next(e);
  }
});

router.post('/preview/recommended', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_VIEW_SURVEY_HEALTH), async (req, res, next) => {
  try {
    const run = await repairService.previewRepair('recommended_fix', req.body || {}, req.user);
    res.json(run);
  } catch (e) {
    next(e);
  }
});

router.post('/preview/legacy-sync', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_VIEW_SURVEY_HEALTH), async (req, res, next) => {
  try {
    const run = await repairService.previewRepair('legacy_response_sync', req.body || {}, req.user);
    res.json(run);
  } catch (e) {
    next(e);
  }
});

router.post('/execute/semester', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_EXECUTE_SURVEY_REPAIRS), ensureExecutionEnabled, async (req, res, next) => {
  try {
    const run = await repairService.executeRepair('semester_backfill', { ...(req.body || {}), mode: 'execute' }, req.user);
    res.json(run);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ message: e.message });
    next(e);
  }
});

router.post('/execute/version', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_EXECUTE_SURVEY_REPAIRS), ensureExecutionEnabled, async (req, res, next) => {
  try {
    const run = await repairService.executeRepair('version_resolution', { ...(req.body || {}), mode: 'execute' }, req.user);
    res.json(run);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ message: e.message });
    next(e);
  }
});

router.post('/execute/answers', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_EXECUTE_SURVEY_REPAIRS), ensureExecutionEnabled, async (req, res, next) => {
  try {
    const run = await repairService.executeRepair('answer_recheck', { ...(req.body || {}), mode: 'execute' }, req.user);
    res.json(run);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ message: e.message });
    next(e);
  }
});

router.post('/execute/recommended', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_EXECUTE_SURVEY_REPAIRS), ensureExecutionEnabled, async (req, res, next) => {
  try {
    const run = await repairService.executeRepair('recommended_fix', { ...(req.body || {}), mode: 'execute' }, req.user);
    res.json(run);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ message: e.message });
    next(e);
  }
});

router.post('/execute/legacy-sync', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_EXECUTE_SURVEY_REPAIRS), ensureExecutionEnabled, async (req, res, next) => {
  try {
    const run = await repairService.executeRepair('legacy_response_sync', { ...(req.body || {}), mode: 'execute' }, req.user);
    res.json(run);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ message: e.message });
    next(e);
  }
});

router.get('/runs', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_VIEW_SURVEY_REPAIR_AUDIT), async (req, res, next) => {
  try {
    res.json(await repairService.listRepairRuns(req.query));
  } catch (e) {
    next(e);
  }
});

router.get('/runs/:id(\\d+)', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_VIEW_SURVEY_REPAIR_AUDIT), async (req, res, next) => {
  try {
    const data = await repairService.getRepairRunDetail(Number(req.params.id));
    if (!data) return res.status(404).json({ message: 'run not found' });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
