const express = require('express');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const {
  listPendingReviews,
  approveReview,
  rejectReview,
} = require('../services/studentAccountReviewService');

const router = express.Router();
const reviewAuth = [authMiddleware, requirePermission(P.CAN_MANAGE_ACCOUNTS)];

function sendError(res, error) {
  const status = error.status || 500;
  if (status >= 500) {
    return res.status(500).json({ success: false, code: 'STUDENT_ACCOUNT_REVIEW_ERROR', message: '暫時無法處理學生帳號申請' });
  }
  return res.status(status).json({
    success: false,
    code: error.code || 'STUDENT_ACCOUNT_REVIEW_ERROR',
    message: error.message || '請求失敗',
  });
}

router.get('/', ...reviewAuth, async (req, res) => {
  try {
    const reviews = await listPendingReviews();
    return res.json({ success: true, reviews });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/approve', ...reviewAuth, async (req, res) => {
  try {
    await approveReview({ reviewId: req.params.id, reviewerId: req.user && req.user.id });
    return res.json({ success: true, message: '已建立學生帳號' });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/:id/reject', ...reviewAuth, async (req, res) => {
  try {
    await rejectReview({ reviewId: req.params.id, reviewerId: req.user && req.user.id });
    return res.json({ success: true, message: '已拒絕這筆申請' });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
