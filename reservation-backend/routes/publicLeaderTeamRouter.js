const express = require('express');
const leaderPublicProfileService = require('../services/leaderPublicProfileService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const leaders = await leaderPublicProfileService.listPublic();
    return res.json({ leaders });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
