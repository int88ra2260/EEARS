const express = require('express');
const router = express.Router();
const surveyCenterService = require('../services/surveyCenterService');

router.get('/effective-for-reservation', async (req, res, next) => {
  try {
    const data = await surveyCenterService.gatingEffectiveForReservation(req.query);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/submit/:surveyKey', async (req, res, next) => {
  try {
    const data = await surveyCenterService.submitSurvey(req.params.surveyKey, req.body, req);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/my-status', async (req, res, next) => {
  try {
    const data = await surveyCenterService.myStatus({
      surveyId: req.query.surveyId,
      studentId: req.query.studentId,
      semesterId: req.query.semesterId,
    });
    return res.json(data);
  } catch (e) {
    if (e.status === 400) {
      return res.status(400).json({
        success: false,
        code: e.code || 'MISSING_MY_STATUS_PARAMS',
        message: e.message,
      });
    }
    return next(e);
  }
});

module.exports = router;
