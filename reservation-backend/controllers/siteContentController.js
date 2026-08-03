const siteContentService = require('../services/siteContentService');

async function getPublic(req, res, next) {
  try {
    const data = await siteContentService.getPublicBundle();
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getPublic,
};
