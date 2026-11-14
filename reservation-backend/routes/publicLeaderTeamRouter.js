const express = require('express');
const leaderPublicProfileService = require('../services/leaderPublicProfileService');
const siteContentService = require('../services/siteContentService');

const router = express.Router();

// 頁面文案的 content keys（對齊 siteContentManifest）
const PAGE_CONTENT_KEYS = [
  'leadersTeam.pageTitle',
  'leadersTeam.pageLead',
  'leadersTeam.introTitle',
  'leadersTeam.intro',
  'leadersTeam.listTitle',
];

router.get('/', async (req, res, next) => {
  try {
    // 取得 leaders 是必要的，其他內容可選（優雅降級）
    const leaders = await leaderPublicProfileService.listPublic();

    // 輪播和文案是選配，失敗時回空
    let carousel = [];
    let textOverrides = {};

    try {
      const [carouselData, bundle] = await Promise.all([
        siteContentService.listLeadersCarouselPublic(),
        siteContentService.getPublicBundle(),
      ]);
      carousel = carouselData || [];
      // 從整包文案中篩選 leaders_team 相關鍵
      PAGE_CONTENT_KEYS.forEach((key) => {
        if (bundle?.textOverrides?.[key]) {
          textOverrides[key] = bundle.textOverrides[key];
        }
      });
    } catch {
      // 輪播和文案取得失敗時，使用空值繼續
    }

    return res.json({
      leaders,
      carousel,
      textOverrides,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
