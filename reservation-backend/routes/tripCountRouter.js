'use strict';

const express = require('express');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const tripCountService = require('../services/tripCountService');

const router = express.Router();

router.use(authMiddleware, requirePermission(P.CAN_USE_TRIP_COUNT, '沒有使用旅遊分帳的權限'));

function handleError(res, err) {
  const status = Number(err.status) || 500;
  return res.status(status).json({
    success: false,
    code: err.code || 'TRIP_COUNT_FAILED',
    error: status === 500 ? '旅遊分帳暫時無法完成' : (err.message || '旅遊分帳暫時無法完成'),
  });
}

router.get('/', async (req, res) => {
  try {
    const data = await tripCountService.listTrips(req.user.id);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const data = await tripCountService.createTrip(req.user.id, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/:tripId', async (req, res) => {
  try {
    const trip = await tripCountService.getOwnedTrip(req.params.tripId, req.user.id);
    const data = await tripCountService.buildDetail(trip);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
});

router.patch('/:tripId', async (req, res) => {
  try {
    const data = await tripCountService.updateTrip(req.user.id, req.params.tripId, req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:tripId', async (req, res) => {
  try {
    await tripCountService.deleteTrip(req.user.id, req.params.tripId);
    return res.json({ success: true });
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/:tripId/members', async (req, res) => {
  try {
    const data = await tripCountService.addMember(req.user.id, req.params.tripId, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
});

router.patch('/:tripId/members/:memberId', async (req, res) => {
  try {
    const data = await tripCountService.renameMember(
      req.user.id,
      req.params.tripId,
      req.params.memberId,
      req.body || {},
    );
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:tripId/members/:memberId', async (req, res) => {
  try {
    const data = await tripCountService.removeMember(req.user.id, req.params.tripId, req.params.memberId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/:tripId/expenses', async (req, res) => {
  try {
    const data = await tripCountService.addExpense(req.user.id, req.params.tripId, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:tripId/expenses/:expenseId', async (req, res) => {
  try {
    const data = await tripCountService.removeExpense(req.user.id, req.params.tripId, req.params.expenseId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;
