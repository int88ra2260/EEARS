// routes/bestepRouter.js
const express = require('express');
const router = express.Router();
const { authMiddleware, englishTestDomainMiddleware } = require('../middlewares/auth');
const { getBestepOverview } = require('../controllers/bestepClassController');
const { importAttendance, importScores, upload } = require('../controllers/bestepImportController');
const { calculateRanking, getRanking } = require('../controllers/bestepRankingController');
const path = require('path');
const fs = require('fs');

// 所有路由都需要認證
router.use(authMiddleware);

/**
 * 匯入出席資料
 * POST /api/admin/bestep/attendance/import
 */
router.post('/attendance/import', englishTestDomainMiddleware, upload.single('file'), importAttendance);

/**
 * 匯入成績資料
 * POST /api/admin/bestep/scores/import
 */
router.post('/scores/import', englishTestDomainMiddleware, upload.single('file'), importScores);

/**
 * 計算團體名次
 * POST /api/admin/bestep/teams/calculate-ranking
 */
router.post('/teams/calculate-ranking', englishTestDomainMiddleware, calculateRanking);

/**
 * 取得團體名次列表
 * GET /api/admin/bestep/teams/ranking
 */
router.get('/teams/ranking', englishTestDomainMiddleware, getRanking);

/**
 * 下載錯誤報表
 * GET /api/admin/bestep/attendance/import/errors/:filename
 */
router.get('/attendance/import/errors/:filename', englishTestDomainMiddleware, (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../uploads/bestep/errors', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '檔案不存在' });
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('下載錯誤報表失敗:', err);
      res.status(500).json({ error: '下載失敗' });
    }
  });
});

/**
 * 下載錯誤報表（成績匯入）
 * GET /api/admin/bestep/scores/import/errors/:filename
 */
router.get('/scores/import/errors/:filename', englishTestDomainMiddleware, (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../uploads/bestep/errors', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '檔案不存在' });
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('下載錯誤報表失敗:', err);
      res.status(500).json({ error: '下載失敗' });
    }
  });
});

module.exports = router;
