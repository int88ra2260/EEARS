const express = require('express');
const pageContentService = require('../services/pageContentService');

const router = express.Router();

// Public: read-only
router.get('/page-content/learning-resources', async (req, res, next) => {
  try {
    const data = await pageContentService.listLearningResources({ admin: false });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

router.get('/page-content/regulations-forms', async (req, res, next) => {
  try {
    const data = await pageContentService.listRegulationsForms({ admin: false });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

router.get('/page-content/scroll-world-test', async (req, res, next) => {
  try {
    const segments = await pageContentService.listScrollWorldSegments({ admin: false });
    return res.json({ segments });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

