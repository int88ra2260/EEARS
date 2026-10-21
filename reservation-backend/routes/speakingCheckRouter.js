const express = require('express');
const {
  readHostToken,
  loginHost,
  listSets,
  createSet,
  updateSet,
  getSet,
  publishSet,
  closeSet,
  joinSet,
  getSession,
  submitResponse,
  getResults,
} = require('../services/speakingCheckSetService');

const router = express.Router();

function sendServiceError(res, next, error) {
  if (error?.status && error.status < 500) {
    return res.status(error.status).json({
      success: false,
      code: error.code || 'SPEAKING_CHECK_ERROR',
      message: error.message,
    });
  }
  return next(error);
}

function hostIdFromRequest(req) {
  const decoded = readHostToken(req.headers.authorization);
  return decoded.hostId;
}

router.post('/speaking-host/login', async (req, res, next) => {
  try {
    const data = await loginHost(req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.get('/speaking-host/sets', async (req, res, next) => {
  try {
    const data = await listSets(hostIdFromRequest(req));
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.post('/speaking-host/sets', async (req, res, next) => {
  try {
    const data = await createSet(hostIdFromRequest(req), req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.get('/speaking-host/sets/:setId', async (req, res, next) => {
  try {
    const data = await getSet(hostIdFromRequest(req), req.params.setId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.put('/speaking-host/sets/:setId', async (req, res, next) => {
  try {
    const data = await updateSet(hostIdFromRequest(req), req.params.setId, req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.post('/speaking-host/sets/:setId/publish', async (req, res, next) => {
  try {
    const data = await publishSet(hostIdFromRequest(req), req.params.setId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.post('/speaking-host/sets/:setId/close', async (req, res, next) => {
  try {
    const data = await closeSet(hostIdFromRequest(req), req.params.setId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.get('/speaking-host/sets/:setId/results', async (req, res, next) => {
  try {
    const data = await getResults(hostIdFromRequest(req), req.params.setId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.post('/speaking-check/join', async (req, res, next) => {
  try {
    const data = await joinSet(req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.get('/speaking-check/sessions/:participantUid', async (req, res, next) => {
  try {
    const data = await getSession(req.params.participantUid);
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

router.post('/speaking-check/sessions/:participantUid/responses', async (req, res, next) => {
  try {
    const data = await submitResponse(req.params.participantUid, req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    return sendServiceError(res, next, error);
  }
});

module.exports = router;
