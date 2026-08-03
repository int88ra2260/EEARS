const weeklyMediaService = require('../services/weeklyMediaService');

async function list(req, res, next) {
  try {
    const data = await weeklyMediaService.listMedia({
      page: req.query.page,
      limit: req.query.limit,
      kind: req.query.kind,
    });
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

async function upload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '請選擇檔案' });
    }
    const data = await weeklyMediaService.createFromUpload(
      req.file,
      req.user?.id,
      req.body?.alt
    );
    return res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const ok = await weeklyMediaService.deleteMedia(req.params.id);
    if (!ok) return res.status(404).json({ error: '找不到媒體' });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, upload, remove };
