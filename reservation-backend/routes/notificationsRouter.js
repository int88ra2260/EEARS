const express = require('express');
const jwt = require('jsonwebtoken');
const { secretKey } = require('../config/jwtSecret');
const { authMiddleware } = require('../middlewares/auth');
const { isStudentAccessToken, studentAuthMiddleware } = require('../middlewares/studentAuth');
const { User } = require('../models');
const notificationService = require('../services/notificationService');

const router = express.Router();

function notificationAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return authMiddleware(req, res, next);
  try {
    const decoded = jwt.verify(token, secretKey);
    if (isStudentAccessToken(decoded)) return studentAuthMiddleware(req, res, next);
  } catch (error) {
    return authMiddleware(req, res, next);
  }
  return authMiddleware(req, res, next);
}

async function notificationUserId(req) {
  if (req.studentAccount && req.studentAccount.studentId) {
    const user = await User.findOne({
      where: { studentId: req.studentAccount.studentId },
      attributes: ['id'],
    });
    return user ? user.id : null;
  }
  return req.user && (req.user.id || req.user.userId) ? (req.user.id || req.user.userId) : null;
}

router.get('/notifications', notificationAuth, async (req, res, next) => {
  try {
    const uid = await notificationUserId(req);
    if (!uid) {
      return res.json({ unreadCount: 0, items: [] });
    }

    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const items = await notificationService.listForUser(uid, { limit });
    const unreadCount = await notificationService.countUnread(uid);

    return res.json({
      unreadCount,
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        data: n.data,
        readAt: n.readAt,
        createdAt: n.createdAt,
        requestId: n.requestId,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', notificationAuth, async (req, res, next) => {
  try {
    const uid = await notificationUserId(req);
    if (!uid) return res.status(404).json({ error: '找不到通知' });

    const notificationId = req.params.id;
    const n = await notificationService.markAsRead(uid, notificationId);
    if (!n) return res.status(404).json({ error: '找不到通知' });

    return res.json({
      success: true,
      id: n.id,
      readAt: n.readAt,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

