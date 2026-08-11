const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { MediaAsset, CourseGuideTopic, WeeklyReport, Announcement, WeeklyMedia } = require('../models');

const MEDIA_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'media');
const LEGACY_COURSE_GUIDE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'course-guide');
const LEGACY_WEEKLY_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'weekly');

const CATALOG_SEED = [
  {
    key: 'diagram-112-115',
    url: '/images/course-guide/diagram-112-115.jpg',
    label: '112–115 學年度流程圖',
    mime: 'image/jpeg',
    scope: 'course-guide',
  },
  {
    key: 'diagram-110',
    url: '/images/course-guide/diagram-110.png',
    label: '110 學年度流程圖',
    mime: 'image/png',
    scope: 'course-guide',
  },
];

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function mimeFromExt(ext) {
  const e = String(ext || '').toLowerCase();
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.png') return 'image/png';
  if (e === '.webp') return 'image/webp';
  if (e === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

function serializeMediaAsset(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: `media:${plain.id}`,
    dbId: plain.id,
    key: plain.key || null,
    url: plain.url,
    label: plain.label || plain.originalName || plain.url,
    originalName: plain.originalName || null,
    storedName: plain.storedName || null,
    mime: plain.mime || null,
    source: plain.source,
    scope: plain.scope,
    byteSize: plain.byteSize,
    isActive: !!plain.isActive,
    uploadedBy: plain.uploadedBy,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

async function ensureMediaLibraryDefaults() {
  ensureDir(MEDIA_UPLOAD_DIR);

  for (const item of CATALOG_SEED) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await MediaAsset.findOne({
      where: {
        [Op.or]: [{ key: item.key }, { url: item.url }],
      },
    });
    if (existing) {
      // eslint-disable-next-line no-await-in-loop
      await existing.update({
        key: item.key,
        url: item.url,
        label: item.label,
        mime: item.mime,
        source: 'catalog',
        scope: item.scope,
        isActive: true,
      });
    } else {
      // eslint-disable-next-line no-await-in-loop
      await MediaAsset.create({
        key: item.key,
        url: item.url,
        label: item.label,
        mime: item.mime,
        source: 'catalog',
        scope: item.scope,
        isActive: true,
      });
    }
  }

  await importLegacyCourseGuideUploads();
  await importLegacyWeeklyImages();
}

async function importLegacyWeeklyImages() {
  // Prefer DB WeeklyMedia rows (have metadata); also scan disk leftovers.
  try {
    const rows = await WeeklyMedia.findAll({
      where: { mimeType: { [Op.like]: 'image/%' } },
      order: [['id', 'ASC']],
    });
    for (const row of rows) {
      const plain = row.get({ plain: true });
      const url = plain.urlPath;
      if (!url) continue;
      // eslint-disable-next-line no-await-in-loop
      const exists = await MediaAsset.findOne({ where: { url } });
      if (exists) continue;
      // eslint-disable-next-line no-await-in-loop
      await MediaAsset.create({
        url,
        label: plain.alt || plain.originalName || plain.storedName || url,
        originalName: plain.originalName || null,
        storedName: plain.storedName || null,
        mime: plain.mimeType || null,
        source: 'upload',
        scope: 'weekly',
        byteSize: plain.sizeBytes || null,
        isActive: true,
        uploadedBy: plain.uploadedBy || null,
      });
    }
  } catch {
    // WeeklyMedia table may be unavailable in some envs
  }

  if (!fs.existsSync(LEGACY_WEEKLY_UPLOAD_DIR)) return;
  const files = fs.readdirSync(LEGACY_WEEKLY_UPLOAD_DIR);
  for (const name of files) {
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const url = `/uploads/weekly/${name}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await MediaAsset.findOne({ where: { url } });
    if (exists) continue;
    const label = name.replace(/^\d{13}-[a-f0-9]{8}-/i, '') || name;
    let byteSize = null;
    try {
      byteSize = fs.statSync(path.join(LEGACY_WEEKLY_UPLOAD_DIR, name)).size;
    } catch {
      byteSize = null;
    }
    // eslint-disable-next-line no-await-in-loop
    await MediaAsset.create({
      url,
      label,
      originalName: label,
      storedName: name,
      mime: mimeFromExt(ext),
      source: 'upload',
      scope: 'weekly',
      byteSize,
      isActive: true,
    });
  }
}

async function importLegacyCourseGuideUploads() {
  if (!fs.existsSync(LEGACY_COURSE_GUIDE_UPLOAD_DIR)) return;
  const files = fs.readdirSync(LEGACY_COURSE_GUIDE_UPLOAD_DIR);
  for (const name of files) {
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const url = `/uploads/course-guide/${name}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await MediaAsset.findOne({ where: { url } });
    if (exists) continue;
    const label = name.replace(/^\d{13}-[a-f0-9]{8}-/i, '') || name;
    const full = path.join(LEGACY_COURSE_GUIDE_UPLOAD_DIR, name);
    let byteSize = null;
    try {
      byteSize = fs.statSync(full).size;
    } catch {
      byteSize = null;
    }
    // eslint-disable-next-line no-await-in-loop
    await MediaAsset.create({
      url,
      label,
      originalName: label,
      storedName: name,
      mime: mimeFromExt(ext),
      source: 'upload',
      scope: 'course-guide',
      byteSize,
      isActive: true,
    });
  }
}

async function listMediaAssets({ scope = null, q = null, includeInactive = false, mimePrefix = null } = {}) {
  await ensureMediaLibraryDefaults();
  const where = {};
  if (!includeInactive) where.isActive = true;
  if (Array.isArray(scope) && scope.length) {
    where.scope = { [Op.in]: scope };
  } else if (scope) {
    where.scope = { [Op.in]: [scope, 'general'] };
  }
  if (mimePrefix) {
    where.mime = { [Op.like]: `${mimePrefix}%` };
  }
  if (q) {
    const like = `%${String(q).trim()}%`;
    where[Op.or] = [
      { label: { [Op.like]: like } },
      { originalName: { [Op.like]: like } },
      { url: { [Op.like]: like } },
      { key: { [Op.like]: like } },
    ];
  }
  const rows = await MediaAsset.findAll({
    where,
    order: [
      ['source', 'ASC'],
      ['id', 'DESC'],
    ],
  });
  return rows.map(serializeMediaAsset);
}

function parseBlocks(contentJson) {
  if (!contentJson) return [];
  try {
    const parsed = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 找出仍引用此媒體的內容（修課說明 / 週報 / 公告）
 */
async function findMediaReferences(asset) {
  const plain = asset.get ? asset.get({ plain: true }) : asset;
  const mediaId = `media:${plain.id}`;
  const legacyIds = [];
  if (plain.key) legacyIds.push(`catalog:${plain.key}`);
  if (plain.storedName) legacyIds.push(`upload:${plain.storedName}`);
  const url = plain.url;

  const refs = [];

  const topics = await CourseGuideTopic.findAll({
    attributes: ['id', 'topicKey', 'titleZh', 'sectionId', 'contentJson'],
  });
  for (const topic of topics) {
    const blocks = parseBlocks(topic.contentJson);
    const hit = blocks.some((b) => figureBlockUsesMedia(b, { mediaId, legacyIds, url }));
    if (hit) {
      refs.push({
        type: 'course-guide-topic',
        id: topic.id,
        sectionId: topic.sectionId,
        topicKey: topic.topicKey,
        titleZh: topic.titleZh,
        label: `修課說明 · ${topic.titleZh || topic.topicKey || `#${topic.id}`}`,
      });
    }
  }

  const reports = await WeeklyReport.findAll({
    attributes: ['id', 'issueKey', 'title', 'blocks'],
  });
  for (const report of reports) {
    const blocks = Array.isArray(report.blocks) ? report.blocks : parseBlocks(report.blocks);
    if (weeklyBlocksUseMedia(blocks, url)) {
      refs.push({
        type: 'weekly-report',
        id: report.id,
        issueKey: report.issueKey,
        label: `週報 · ${report.title || report.issueKey || `#${report.id}`}`,
      });
    }
  }

  const announcements = await Announcement.findAll({
    attributes: ['id', 'title', 'coverImage', 'ogImageUrl'],
    where: {
      [Op.or]: [{ coverImage: url }, { ogImageUrl: url }],
    },
  });
  for (const ann of announcements) {
    refs.push({
      type: 'announcement',
      id: ann.id,
      label: `公告 · ${ann.title || `#${ann.id}`}`,
    });
  }

  return refs;
}

function figureBlockUsesMedia(block, { mediaId, legacyIds, url }) {
  if (!block || block.type !== 'figure') return false;
  if (block.mediaId && (block.mediaId === mediaId || legacyIds.includes(block.mediaId))) return true;
  if (block.src && block.src === url) return true;
  return false;
}

function collectStrings(value, out) {
  if (value == null) return;
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => collectStrings(v, out));
    return;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach((v) => collectStrings(v, out));
  }
}

function weeklyBlocksUseMedia(blocks, url) {
  if (!url || !Array.isArray(blocks)) return false;
  const strings = [];
  collectStrings(blocks, strings);
  return strings.includes(url);
}

async function createMediaFromUpload(file, { scope = 'general', label = null, actorId = null } = {}) {
  if (!file) {
    const err = new Error('請選擇檔案');
    err.status = 400;
    throw err;
  }
  const row = await MediaAsset.create({
    url: `/uploads/media/${file.filename}`,
    label: label || file.originalname || file.filename,
    originalName: file.originalname || null,
    storedName: file.filename,
    mime: file.mimetype || null,
    source: 'upload',
    scope: scope || 'general',
    byteSize: Number.isFinite(file.size) ? file.size : null,
    isActive: true,
    uploadedBy: actorId || null,
  });
  return serializeMediaAsset(row);
}

async function updateMediaAsset(id, payload, _actorId) {
  const row = await MediaAsset.findByPk(id);
  if (!row) {
    const err = new Error('找不到媒體');
    err.status = 404;
    throw err;
  }
  if (row.source === 'catalog' && payload.url != null && payload.url !== row.url) {
    const err = new Error('系統內建圖不可更改路徑');
    err.status = 400;
    throw err;
  }
  const patch = {};
  if (payload.label != null) patch.label = String(payload.label).trim() || row.label;
  if (payload.scope != null) patch.scope = String(payload.scope).trim() || row.scope;
  if (payload.isActive != null) patch.isActive = !!payload.isActive;
  if (Object.keys(patch).length) {
    await row.update(patch);
  }
  return serializeMediaAsset(await row.reload());
}

async function deleteMediaAsset(id, { force = false } = {}) {
  const row = await MediaAsset.findByPk(id);
  if (!row) {
    const err = new Error('找不到媒體');
    err.status = 404;
    throw err;
  }
  if (row.source === 'catalog') {
    const err = new Error('系統內建圖不可刪除，可改為停用');
    err.status = 400;
    throw err;
  }

  const references = await findMediaReferences(row);
  if (references.length && !force) {
    const err = new Error('此圖片仍被內容引用，無法刪除');
    err.status = 409;
    err.code = 'MEDIA_IN_USE';
    err.details = { references };
    throw err;
  }

  if (row.storedName) {
    const candidates = [
      path.join(MEDIA_UPLOAD_DIR, row.storedName),
      path.join(LEGACY_COURSE_GUIDE_UPLOAD_DIR, row.storedName),
      path.join(LEGACY_WEEKLY_UPLOAD_DIR, row.storedName),
    ];
    for (const full of candidates) {
      if (fs.existsSync(full)) {
        try {
          fs.unlinkSync(full);
        } catch {
          // ignore file delete failure; DB row still removed
        }
        break;
      }
    }
  }

  await row.destroy();
  return { ok: true, removedReferences: references.length };
}

async function getMediaAssetById(id) {
  const row = await MediaAsset.findByPk(id);
  if (!row) {
    const err = new Error('找不到媒體');
    err.status = 404;
    throw err;
  }
  return serializeMediaAsset(row);
}

module.exports = {
  MEDIA_UPLOAD_DIR,
  ensureMediaLibraryDefaults,
  listMediaAssets,
  createMediaFromUpload,
  updateMediaAsset,
  deleteMediaAsset,
  findMediaReferences,
  getMediaAssetById,
  serializeMediaAsset,
};
