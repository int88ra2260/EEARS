/**
 * 網站統計 API（瀏覽人次、造訪目的）
 */
const express = require('express');
const router = express.Router();
const { recordViewAndGet } = require('../services/siteStatsService');
const { recordVisitInsights, summarizeVisitInsights } = require('../services/siteVisitInsightService');
const { authMiddleware } = require('../middlewares/auth');
const { buildAccessProfile } = require('../auth/accessProfile');
const { createSimpleRateLimit } = require('../middlewares/publicAccessGuard');

const visitInsightLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  message: '造訪紀錄過於頻繁，請稍後再試',
});

function requireCenterAnalytics(req, res, next) {
  const profile = req.accessProfile || buildAccessProfile(req.user);
  if (profile.isAdmin || profile.hasAdminRights) return next();
  return res.status(403).json({ success: false, message: '您沒有存取此分析資料的權限。' });
}

/**
 * GET /api/stats/views
 * 記錄一次瀏覽並回傳總瀏覽人次與當日瀏覽人次
 */
router.get('/views', async (req, res, next) => {
  try {
    const { total, today } = await recordViewAndGet();
    res.json({ total, today });
  } catch (err) {
    next(err);
  }
});

router.post('/visit-insights', visitInsightLimit, async (req, res, next) => {
  try {
    await recordVisitInsights(req.body || {});
    return res.status(204).end();
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ success: false, message: err.message });
    return next(err);
  }
});

router.get('/visit-insights', authMiddleware, requireCenterAnalytics, async (req, res, next) => {
  try {
    const summary = await summarizeVisitInsights({ days: req.query.days });
    return res.json(summary);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
