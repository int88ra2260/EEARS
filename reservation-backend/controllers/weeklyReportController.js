const weeklyReportService = require('../services/weeklyReportService');

async function getCurrent(req, res, next) {
  try {
    const data = await weeklyReportService.getCurrentPublished();
    if (!data) {
      return res.status(404).json({ error: '目前尚無已發布的週報' });
    }
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const data = await weeklyReportService.listPublished({
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getByKey(req, res, next) {
  try {
    const data = await weeklyReportService.getPublishedByKey(req.params.idOrSlug);
    if (!data) {
      return res.status(404).json({ error: '找不到週報或尚未發布' });
    }
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getPreview(req, res, next) {
  try {
    const data = await weeklyReportService.getPreviewByToken(req.params.token);
    if (!data) {
      return res.status(404).json({ error: '預覽連結無效或已過期' });
    }
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCurrent,
  list,
  getByKey,
  getPreview,
};
