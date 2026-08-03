const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { WeeklyMedia } = require('../models');

function serializeMedia(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    originalName: plain.originalName,
    storedName: plain.storedName,
    mimeType: plain.mimeType,
    sizeBytes: plain.sizeBytes,
    urlPath: plain.urlPath,
    url: plain.urlPath,
    alt: plain.alt,
    uploadedBy: plain.uploadedBy,
    createdAt: plain.createdAt,
  };
}

async function listMedia({ page = 1, limit = 40, kind } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 40));
  const offset = (safePage - 1) * safeLimit;
  const where = {};
  if (kind === 'image') {
    where.mimeType = { [Op.like]: 'image/%' };
  } else if (kind === 'audio') {
    where.mimeType = { [Op.like]: 'audio/%' };
  } else if (kind === 'video') {
    where.mimeType = { [Op.like]: 'video/%' };
  }

  const { rows, count } = await WeeklyMedia.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: safeLimit,
    offset,
  });

  return {
    items: rows.map(serializeMedia),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count,
      totalPages: Math.ceil(count / safeLimit) || 1,
    },
  };
}

async function createFromUpload(file, actorId, alt = '') {
  const urlPath = `/uploads/weekly/${file.filename}`;
  const row = await WeeklyMedia.create({
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    urlPath,
    alt: alt ? String(alt).slice(0, 255) : null,
    uploadedBy: actorId || null,
  });
  return serializeMedia(row);
}

async function deleteMedia(id) {
  const row = await WeeklyMedia.findByPk(id);
  if (!row) return false;
  const filePath = path.join(__dirname, '..', 'uploads', 'weekly', row.storedName);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best effort
  }
  await row.destroy();
  return true;
}

module.exports = {
  serializeMedia,
  listMedia,
  createFromUpload,
  deleteMedia,
};
