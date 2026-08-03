const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission, adminOrExecutiveMiddleware, P } = require('../middlewares/auth');
const mappingService = require('../services/surveyAnswerMappingService');

function ensureMappingEnabled(req, res, next) {
  const enabled = String(process.env.SURVEY_ANSWER_MAPPING_ENABLED || 'true').toLowerCase() === 'true';
  if (!enabled) return res.status(403).json({ code: 'ANSWER_MAPPING_DISABLED', message: 'SURVEY_ANSWER_MAPPING_ENABLED=false' });
  return next();
}

router.get('/', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_MANAGE_SURVEY_ANSWER_MAPPING), async (req, res, next) => {
  try {
    res.json(await mappingService.listMappings(req.query));
  } catch (e) {
    next(e);
  }
});

router.post('/proposals', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_MANAGE_SURVEY_ANSWER_MAPPING), ensureMappingEnabled, async (req, res, next) => {
  try {
    const proposals = await mappingService.generateProposals(req.body || {});
    res.json({ proposals });
  } catch (e) {
    next(e);
  }
});

router.post('/', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_MANAGE_SURVEY_ANSWER_MAPPING), ensureMappingEnabled, async (req, res, next) => {
  try {
    res.status(201).json(await mappingService.createMapping(req.body || {}, req.user?.id));
  } catch (e) {
    next(e);
  }
});

router.put('/:id(\\d+)', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_MANAGE_SURVEY_ANSWER_MAPPING), ensureMappingEnabled, async (req, res, next) => {
  try {
    const row = await mappingService.updateMapping(Number(req.params.id), req.body || {});
    if (!row) return res.status(404).json({ message: 'mapping not found' });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.post('/:id(\\d+)/approve', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_MANAGE_SURVEY_ANSWER_MAPPING), ensureMappingEnabled, async (req, res, next) => {
  try {
    const row = await mappingService.approveMapping(Number(req.params.id), req.user?.id);
    if (!row) return res.status(404).json({ message: 'mapping not found' });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

router.post('/:id(\\d+)/reject', authMiddleware, adminOrExecutiveMiddleware, requirePermission(P.CAN_MANAGE_SURVEY_ANSWER_MAPPING), ensureMappingEnabled, async (req, res, next) => {
  try {
    const row = await mappingService.rejectMapping(Number(req.params.id), req.user?.id, req.body?.notes || null);
    if (!row) return res.status(404).json({ message: 'mapping not found' });
    res.json(row);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
