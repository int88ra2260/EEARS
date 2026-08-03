// controllers/bestepRankingController.js
const { calculateTeamRanking, getTeamRanking } = require('../services/bestepRankingService');

/**
 * 計算團體名次
 * POST /api/admin/bestep/teams/calculate-ranking
 */
async function calculateRanking(req, res, next) {
  try {
    const { semester } = req.body;

    if (!semester) {
      return res.status(400).json({ error: '請指定學期' });
    }

    const result = await calculateTeamRanking(semester);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('計算團體名次錯誤:', error);
    res.status(500).json({ error: error.message || '計算失敗' });
  }
}

/**
 * 取得團體名次列表
 * GET /api/admin/bestep/teams/ranking
 */
async function getRanking(req, res, next) {
  try {
    const { semester } = req.query;

    if (!semester) {
      return res.status(400).json({ error: '請指定學期' });
    }

    const result = await getTeamRanking(semester);

    res.json(result);
  } catch (error) {
    console.error('取得團體名次錯誤:', error);
    res.status(500).json({ error: error.message || '載入資料失敗' });
  }
}

module.exports = {
  calculateRanking,
  getRanking
};
