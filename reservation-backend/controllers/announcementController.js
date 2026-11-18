// 前台公告 API（公開讀取；有帶有效登入時才放寬受眾）
const jwt = require('jsonwebtoken');
const { secretKey } = require('../config/jwtSecret');
const { StudentAccount, Teacher } = require('../models');
const { isStudentAccessToken } = require('../middlewares/studentAuth');
const announcementService = require('../services/announcementService');
const { verifyAnnouncementPreviewToken } = require('../services/announcementPreviewService');

async function resolveAnnouncementViewer(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return 'public';
  let decoded;
  try {
    decoded = jwt.verify(token, secretKey);
  } catch (error) {
    return 'public';
  }
  if (isStudentAccessToken(decoded) && decoded.id && decoded.studentId) {
    const account = await StudentAccount.findByPk(decoded.id, {
      attributes: ['id', 'status', 'studentId', 'passwordChangedAt'],
    });
    if (!account || account.status !== 'active' || account.studentId !== decoded.studentId) return 'public';
    if (account.passwordChangedAt && decoded.iat != null) {
      const changedAtSec = Math.floor(new Date(account.passwordChangedAt).getTime() / 1000);
      if (Number.isFinite(changedAtSec) && Number(decoded.iat) < changedAtSec) return 'public';
    }
    return 'student';
  }
  if (!decoded.id || !decoded.role) return 'public';
  const teacher = await Teacher.findByPk(decoded.id, { attributes: ['id', 'role', 'isActive'] });
  if (!teacher || teacher.isActive === false) return 'public';
  if (teacher.role === 'admin') return 'admin';
  return 'teacher';
}

async function list(req, res, next) {
  try {
    const viewer = await resolveAnnouncementViewer(req);
    const { limit, page, keyword, q, category, tag, pinnedFirst } = req.query;
    const data = await announcementService.listPublicAnnouncements({
      limit,
      page,
      keyword,
      q,
      category,
      tag,
      pinnedFirst: pinnedFirst === undefined ? true : pinnedFirst,
      viewer,
    });
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const viewer = await resolveAnnouncementViewer(req);
    const row = await announcementService.getPublishedByParam(req.params.idOrSlug, { viewer });
    if (!row) {
      return res.status(404).json({ error: '公告不存在或尚未發布' });
    }
    return res.json(row);
  } catch (err) {
    next(err);
  }
}

async function preview(req, res, next) {
  try {
    const verified = verifyAnnouncementPreviewToken(req.params.token);
    if (!verified) {
      return res.status(404).json({ error: '預覽連結無效或已過期' });
    }
    const row = await announcementService.getAnnouncementPreview(verified.id);
    if (!row) {
      return res.status(404).json({ error: '公告不存在或尚未發布' });
    }
    return res.json(row);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, preview, resolveAnnouncementViewer };
