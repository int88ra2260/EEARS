const { Op } = require('sequelize');

const { WeeklyReport } = require('../models');

const weeklyBlockService = require('./weeklyBlockService');



const WEEKLY_STATUS = {

  DRAFT: 'draft',

  PUBLISHED: 'published',

};



const {

  normalizeThemeIds,

  normalizeBlocks,

  validateBlocks,

  extractFromBlocks,

  extractModalTeaser,

  defaultBlocksTemplate,

  stripBlocksForPublic,

} = weeklyBlockService;



function serializePublic(row) {

  const plain = row.get ? row.get({ plain: true }) : row;

  const blocks = stripBlocksForPublic(normalizeBlocks(plain.blocks, plain));

  const derived = extractFromBlocks(blocks);

  const teaser = extractModalTeaser(blocks);



  return {

    id: plain.id,

    issueKey: plain.issueKey,

    slug: plain.slug,

    title: plain.title || derived.title,

    headline: plain.headline || derived.headline || teaser.headline,

    editorial: plain.editorial || derived.editorial,

    learningTip: plain.learningTip || derived.learningTip || teaser.learningTip,

    wordBridgeLevel: plain.wordBridgeLevel || derived.wordBridgeLevel,

    wordBridgeThemeIds: normalizeThemeIds(plain.wordBridgeThemeIds?.length

      ? plain.wordBridgeThemeIds

      : derived.wordBridgeThemeIds),

    blocks,

    blocksVersion: plain.blocksVersion || 1,

    publishedAt: plain.publishedAt,

    weekStart: plain.weekStart,

    weekEnd: plain.weekEnd,

  };

}



function serializeAdmin(row) {

  const plain = row.get ? row.get({ plain: true }) : row;

  return {

    ...serializePublic(row),

    status: plain.status,

    createdAt: plain.createdAt,

    updatedAt: plain.updatedAt,

    createdBy: plain.createdBy,

    updatedBy: plain.updatedBy,

  };

}



function validatePayload(body, { partial = false } = {}) {

  const errors = [];

  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);



  if (!partial || has('issueKey')) {

    if (!String(body.issueKey || '').trim()) errors.push('請填寫期數代碼（issueKey）');

  }

  if (!partial || has('slug')) {

    if (!String(body.slug || '').trim()) errors.push('請填寫 slug');

  }

  if (!partial || has('title')) {

    if (!String(body.title || '').trim()) errors.push('請填寫標題');

  }

  if (!partial || has('weekStart')) {

    if (!body.weekStart) errors.push('請填寫 weekStart');

  }

  if (!partial || has('weekEnd')) {

    if (!body.weekEnd) errors.push('請填寫 weekEnd');

  }



  if (has('blocks')) {

    errors.push(...validateBlocks(body.blocks));

  } else if (!partial) {

    const themeIds = normalizeThemeIds(body.wordBridgeThemeIds);

    if (themeIds.length !== 4) errors.push('wordBridgeThemeIds 須恰好 4 個主題 ID');

    const level = String(body.wordBridgeLevel || '').trim();

    if (!weeklyBlockService.VALID_LEVELS.has(level)) errors.push('wordBridgeLevel 須為 A1–C1');

  }



  if (errors.length) {

    const err = new Error(errors.join('；'));

    err.status = 400;

    throw err;

  }

}



function buildWritePayload(body, actorId, existingRow = null) {

  const status = body.status === WEEKLY_STATUS.PUBLISHED ? WEEKLY_STATUS.PUBLISHED : WEEKLY_STATUS.DRAFT;

  const publishedAt =
    status === WEEKLY_STATUS.PUBLISHED
      ? body.publishedAt
        ? new Date(body.publishedAt)
        : existingRow?.publishedAt && existingRow.status === WEEKLY_STATUS.PUBLISHED
          ? new Date(existingRow.publishedAt)
          : new Date()
      : null;



  let blocks = body.blocks;

  if (blocks) {

    blocks = normalizeBlocks(blocks);

  } else if (existingRow) {

    blocks = normalizeBlocks(existingRow.blocks, existingRow);

  } else {

    blocks = defaultBlocksTemplate({

      title: body.title,

      headline: body.headline,

    });

  }



  const derived = extractFromBlocks(blocks);

  const heroTitle = blocks.find((b) => b.type === 'hero')?.props?.title;



  return {

    issueKey: String(body.issueKey).trim(),

    slug: String(body.slug).trim().toLowerCase(),

    title: String(body.title || heroTitle || derived.title || '').trim(),

    headline: body.headline != null ? String(body.headline).trim() : derived.headline,

    editorial: body.editorial != null ? String(body.editorial) : derived.editorial,

    learningTip: body.learningTip != null ? String(body.learningTip) : derived.learningTip,

    wordBridgeLevel: derived.wordBridgeLevel || 'A2',

    wordBridgeThemeIds: derived.wordBridgeThemeIds.length

      ? derived.wordBridgeThemeIds

      : ['a2-campus', 'a2-homework', 'a2-weekend', 'a2-shopping'],

    blocks,

    blocksVersion: 1,

    status,

    publishedAt,

    weekStart: body.weekStart,

    weekEnd: body.weekEnd,

    updatedBy: actorId || null,

  };

}



async function getCurrentPublished() {

  const now = new Date();

  const row = await WeeklyReport.findOne({

    where: {

      status: WEEKLY_STATUS.PUBLISHED,

      publishedAt: { [Op.lte]: now },

    },

    order: [['publishedAt', 'DESC'], ['id', 'DESC']],

  });

  return row ? serializePublic(row) : null;

}



async function getPublishedByKey(idOrSlug) {

  const key = String(idOrSlug || '').trim();

  if (!key) return null;

  const row = await WeeklyReport.findOne({

    where: {

      status: WEEKLY_STATUS.PUBLISHED,

      [Op.or]: [{ issueKey: key }, { slug: key.toLowerCase() }],

    },

  });

  return row ? serializePublic(row) : null;

}



async function listPublished({ page = 1, limit = 12 } = {}) {

  const safePage = Math.max(1, Number(page) || 1);

  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 12));

  const offset = (safePage - 1) * safeLimit;

  const { rows, count } = await WeeklyReport.findAndCountAll({

    where: { status: WEEKLY_STATUS.PUBLISHED },

    order: [['publishedAt', 'DESC'], ['id', 'DESC']],

    limit: safeLimit,

    offset,

  });

  return {

    items: rows.map(serializePublic),

    pagination: {

      page: safePage,

      limit: safeLimit,

      total: count,

      totalPages: Math.ceil(count / safeLimit) || 1,

    },

  };

}



async function listAdmin({ page = 1, limit = 20, status } = {}) {

  const safePage = Math.max(1, Number(page) || 1);

  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const offset = (safePage - 1) * safeLimit;

  const where = {};

  if (status) where.status = String(status).trim();



  const { rows, count } = await WeeklyReport.findAndCountAll({

    where,

    order: [['weekStart', 'DESC'], ['id', 'DESC']],

    limit: safeLimit,

    offset,

  });



  return {

    items: rows.map(serializeAdmin),

    pagination: {

      page: safePage,

      limit: safeLimit,

      total: count,

      totalPages: Math.ceil(count / safeLimit) || 1,

    },

  };

}



async function getByIdAdmin(id) {

  const row = await WeeklyReport.findByPk(id);

  return row ? serializeAdmin(row) : null;

}



async function createWeeklyReport(body, actorId) {

  validatePayload(body);

  const payload = buildWritePayload(body, actorId);

  payload.createdBy = actorId || null;

  const row = await WeeklyReport.create(payload);

  return serializeAdmin(row);

}



async function updateWeeklyReport(id, body, actorId) {

  const row = await WeeklyReport.findByPk(id);

  if (!row) return null;

  const existing = serializeAdmin(row);

  validatePayload({ ...existing, ...body }, { partial: true });

  const payload = buildWritePayload({ ...existing, ...body }, actorId, existing);

  await row.update(payload);

  return serializeAdmin(row);

}



async function deleteWeeklyReport(id) {
  const row = await WeeklyReport.findByPk(id);
  if (!row) return false;
  await row.destroy();
  return true;
}

function serializePreview(row) {
  const data = serializePublic(row);
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    ...data,
    preview: true,
    status: plain.status,
  };
}

async function getDraftPreviewById(id) {
  const row = await WeeklyReport.findByPk(id);
  if (!row) return null;
  return serializePreview(row);
}

async function getPreviewByToken(token) {
  const weeklyPreviewService = require('./weeklyPreviewService');
  const parsed = weeklyPreviewService.verifyPreviewToken(token);
  if (!parsed) return null;
  return getDraftPreviewById(parsed.id);
}

async function createPreviewToken(id, ttlSec) {
  const row = await WeeklyReport.findByPk(id);
  if (!row) return null;
  const weeklyPreviewService = require('./weeklyPreviewService');
  const token = weeklyPreviewService.createPreviewToken(id, ttlSec);
  const expiresIn = weeklyPreviewService.DEFAULT_TTL_SEC;
  return { token, expiresIn: Number(ttlSec) || expiresIn };
}

async function duplicateWeeklyReport(id, body, actorId) {
  const source = await WeeklyReport.findByPk(id);
  if (!source) return null;
  const plain = source.get({ plain: true });
  const issueKey = String(body.issueKey || `${plain.issueKey}-copy`).trim();
  const slug = String(body.slug || `${plain.slug}-copy`).trim().toLowerCase();
  if (!issueKey || !slug) {
    const err = new Error('請填寫新期數代碼與 slug');
    err.status = 400;
    throw err;
  }
  const blocks = normalizeBlocks(plain.blocks, plain);
  const payload = buildWritePayload({
    issueKey,
    slug,
    title: body.title || `${plain.title}（複製）`,
    headline: plain.headline,
    editorial: plain.editorial,
    learningTip: plain.learningTip,
    wordBridgeLevel: plain.wordBridgeLevel,
    wordBridgeThemeIds: plain.wordBridgeThemeIds,
    blocks,
    status: WEEKLY_STATUS.DRAFT,
    weekStart: body.weekStart || plain.weekStart,
    weekEnd: body.weekEnd || plain.weekEnd,
  }, actorId);
  payload.createdBy = actorId || null;
  payload.publishedAt = null;
  const row = await WeeklyReport.create(payload);
  return serializeAdmin(row);
}



module.exports = {

  WEEKLY_STATUS,

  normalizeThemeIds,

  serializePublic,

  serializeAdmin,

  getCurrentPublished,

  getPublishedByKey,

  listPublished,

  listAdmin,

  getByIdAdmin,

  createWeeklyReport,
  updateWeeklyReport,
  deleteWeeklyReport,
  getDraftPreviewById,
  getPreviewByToken,
  createPreviewToken,
  duplicateWeeklyReport,
};

