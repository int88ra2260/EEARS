/**
 * 公告業務邏輯（產品化）
 *
 * 前台列表排序：isPinned DESC → publishedAt DESC → id DESC
 * 公開可見條件：status=published、isPublished、publishedAt、未軟刪、未過期；排程到期於 list/get 前 promote
 *
 * XSS：富文字 HTML 於 create/update 經 sanitizeAnnouncementHtml 消毒
 */
const { Op, fn, col, where } = require('sequelize');
const { Announcement, AnnouncementRevision, Teacher } = require('../models');
const auditLogService = require('./auditLogService');
const {
  ANNOUNCEMENT_STATUS,
  ANNOUNCEMENT_STATUS_LIST,
  ANNOUNCEMENT_CATEGORIES,
  AUDIENCE_TYPE_LIST,
  SEO_TITLE_MAX,
  SEO_DESC_MAX,
  COVER_ALT_MAX,
  TAG_MAX,
  TAG_ITEM_MAX,
} = require('../constants/announcementConstants');
const {
  sanitizeAnnouncementHtml,
  isAnnouncementHtmlContent,
} = require('../utils/sanitizeAnnouncementHtml');

const TITLE_MAX = 200;
const SUMMARY_MAX = 2000;
const CONTENT_MAX = 500000;
const COVER_MAX = 500;
const SLUG_MAX = 180;
const OG_MAX = 500;

function normalizeContentForStorage(raw) {
  const content = String(raw ?? '');
  if (isAnnouncementHtmlContent(content)) {
    return sanitizeAnnouncementHtml(content);
  }
  return content;
}

function stripTags(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerptFromContent(content, len = 150) {
  const t = stripTags(content);
  if (t.length <= len) return t;
  return `${t.slice(0, len)}…`;
}

function estimateReadingMinutes(text) {
  const n = stripTags(text).length;
  return Math.max(1, Math.ceil(n / 400));
}

function baseSlugFromTitle(title) {
  const raw = String(title || '')
    .trim()
    .slice(0, 80)
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const base = raw || 'announcement';
  return base.slice(0, SLUG_MAX - 20);
}

async function ensureUniqueSlug(base, excludeId) {
  let candidate = base.slice(0, SLUG_MAX);
  let n = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const found = await Announcement.unscoped().findOne({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      },
    });
    if (!found) return candidate;
    n += 1;
    const suffix = `-${n}`;
    candidate = `${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
  }
}

function parseTagsInput(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const out = raw
      .map((t) => String(t).trim().slice(0, TAG_ITEM_MAX))
      .filter(Boolean)
      .slice(0, TAG_MAX);
    return out.length ? out : null;
  }
  if (typeof raw === 'string') {
    const out = raw
      .split(/[,，\n]/)
      .map((t) => t.trim().slice(0, TAG_ITEM_MAX))
      .filter(Boolean)
      .slice(0, TAG_MAX);
    return out.length ? out : null;
  }
  return null;
}

function validateSlugFormat(slug) {
  const s = String(slug || '').trim();
  if (!s) return 'slug 不可為空';
  if (s.length > SLUG_MAX) return `slug 最長 ${SLUG_MAX} 字`;
  if (!/^[a-zA-Z0-9\u4e00-\u9fff\-_]+$/.test(s)) return 'slug 僅允許英數、中文、-、_';
  return null;
}

function validateAnnouncementPayload(body, { isCreate }) {
  const errors = [];

  if (isCreate) {
    const title = String(body.title || '').trim();
    const content = String(body.content || '');
    if (!title) errors.push('title 必填');
    else if (title.length > TITLE_MAX) errors.push(`title 最長 ${TITLE_MAX} 字`);
    if (!content.trim()) errors.push('content 必填');
    else if (content.length > CONTENT_MAX) errors.push('content 過長');
  } else {
    if (body.title !== undefined) {
      const title = String(body.title || '').trim();
      if (!title) errors.push('title 不可為空');
      else if (title.length > TITLE_MAX) errors.push(`title 最長 ${TITLE_MAX} 字`);
    }
    if (body.content !== undefined) {
      const content = String(body.content || '');
      if (!content.trim()) errors.push('content 不可為空');
      else if (content.length > CONTENT_MAX) errors.push('content 過長');
    }
  }

  if (body.summary !== undefined && String(body.summary).length > SUMMARY_MAX) {
    errors.push(`summary 最長 ${SUMMARY_MAX} 字`);
  }
  if (body.coverImage !== undefined && String(body.coverImage).length > COVER_MAX) {
    errors.push(`coverImage 最長 ${COVER_MAX} 字`);
  }
  if (body.ogImageUrl !== undefined && String(body.ogImageUrl).length > OG_MAX) {
    errors.push(`ogImageUrl 最長 ${OG_MAX} 字`);
  }
  if (body.seoTitle !== undefined && String(body.seoTitle).length > SEO_TITLE_MAX) {
    errors.push(`seoTitle 最長 ${SEO_TITLE_MAX} 字`);
  }
  if (body.seoDescription !== undefined && String(body.seoDescription).length > SEO_DESC_MAX) {
    errors.push(`seoDescription 最長 ${SEO_DESC_MAX} 字`);
  }
  if (body.coverImageAlt !== undefined && String(body.coverImageAlt).length > COVER_ALT_MAX) {
    errors.push(`coverImageAlt 最長 ${COVER_ALT_MAX} 字`);
  }

  if (body.slug !== undefined && body.slug !== null && String(body.slug).trim()) {
    const se = validateSlugFormat(body.slug);
    if (se) errors.push(se);
  }

  if (body.category !== undefined && body.category !== null && String(body.category).trim()) {
    const c = String(body.category).trim();
    if (!ANNOUNCEMENT_CATEGORIES.includes(c)) {
      errors.push(`category 必須為：${ANNOUNCEMENT_CATEGORIES.join(', ')}`);
    }
  }

  if (body.audienceType !== undefined && body.audienceType != null) {
    const a = String(body.audienceType).trim();
    if (!AUDIENCE_TYPE_LIST.includes(a)) {
      errors.push(`audienceType 必須為：${AUDIENCE_TYPE_LIST.join(', ')}`);
    }
  }

  if (body.scheduledPublishAt !== undefined && body.scheduledPublishAt !== null && body.scheduledPublishAt !== '') {
    const d = new Date(body.scheduledPublishAt);
    if (Number.isNaN(d.getTime())) errors.push('scheduledPublishAt 格式無效');
  }
  if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== '') {
    const d = new Date(body.expiresAt);
    if (Number.isNaN(d.getTime())) errors.push('expiresAt 格式無效');
  }
  if (body.publishedAt !== undefined && body.publishedAt !== null && body.publishedAt !== '') {
    const d = new Date(body.publishedAt);
    if (Number.isNaN(d.getTime())) errors.push('publishedAt 格式無效');
  }

  return errors;
}

function normalizeAnnouncementStatus(rowPlain, now = new Date()) {
  const r = rowPlain;
  if (!r) return ANNOUNCEMENT_STATUS.DRAFT;
  const st = r.status || ANNOUNCEMENT_STATUS.DRAFT;
  if (!ANNOUNCEMENT_STATUS_LIST.includes(st)) return ANNOUNCEMENT_STATUS.DRAFT;
  if (st === ANNOUNCEMENT_STATUS.PUBLISHED && r.expiresAt) {
    const ex = new Date(r.expiresAt);
    if (!Number.isNaN(ex.getTime()) && ex <= now) return ANNOUNCEMENT_STATUS.UNPUBLISHED;
  }
  return st;
}

function isPubliclyVisiblePlain(plain, now = new Date()) {
  if (!plain || plain.deletedAt) return false;
  const st = normalizeAnnouncementStatus(plain, now);
  if (st !== ANNOUNCEMENT_STATUS.PUBLISHED) return false;
  if (!plain.isPublished || !plain.publishedAt) return false;
  if (plain.expiresAt) {
    const ex = new Date(plain.expiresAt);
    if (!Number.isNaN(ex.getTime()) && ex <= now) return false;
  }
  return true;
}

async function promoteDueScheduledAnnouncements(now = new Date()) {
  const due = await Announcement.findAll({
    where: {
      deletedAt: null,
      status: ANNOUNCEMENT_STATUS.SCHEDULED,
      scheduledPublishAt: { [Op.ne]: null, [Op.lte]: now },
    },
  });
  for (const row of due) {
    const pubAt = row.publishedAt || row.scheduledPublishAt || now;
    await row.update({
      status: ANNOUNCEMENT_STATUS.PUBLISHED,
      isPublished: true,
      publishedAt: pubAt,
      scheduledPublishAt: null,
    });
  }
}

function publicListWhere(now, { category, tag, q, keyword }) {
  const search = (q != null && q !== '' ? q : keyword) || '';
  const andParts = [
    { deletedAt: null },
    { status: ANNOUNCEMENT_STATUS.PUBLISHED },
    { isPublished: true },
    { publishedAt: { [Op.ne]: null } },
    { [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }] },
  ];
  if (category && String(category).trim()) {
    andParts.push({ category: String(category).trim() });
  }
  if (search && String(search).trim()) {
    const k = `%${String(search).trim()}%`;
    andParts.push({
      [Op.or]: [
        { title: { [Op.like]: k } },
        { summary: { [Op.like]: k } },
        { slug: { [Op.like]: k } },
      ],
    });
  }
  if (tag && String(tag).trim()) {
    const t = String(tag).trim().slice(0, TAG_ITEM_MAX);
    andParts.push({ tags: { [Op.ne]: null } });
    andParts.push(where(fn('JSON_CONTAINS', col('tags'), fn('JSON_QUOTE', t)), 1));
  }
  return { [Op.and]: andParts };
}

function publicOrder() {
  return [
    ['isPinned', 'DESC'],
    ['publishedAt', 'DESC'],
    ['id', 'DESC'],
  ];
}

function coverUrlFromRow(plain) {
  return plain.coverImage || null;
}

function serializeAnnouncementForPublic(plain, { detail = false, requestedSegment = null } = {}) {
  const url = coverUrlFromRow(plain);
  const summary =
    plain.summary && String(plain.summary).trim()
      ? plain.summary
      : excerptFromContent(plain.content, detail ? 160 : 150);
  const base = {
    id: plain.id,
    title: plain.title,
    slug: plain.slug,
    summary,
    publishedAt: plain.publishedAt,
    date: plain.publishedAt,
    category: plain.category || 'general',
    tags: Array.isArray(plain.tags) ? plain.tags : [],
    isPinned: !!plain.isPinned,
    coverImage: url,
    coverImageUrl: url,
    coverImageAlt: plain.coverImageAlt || null,
    type: null,
  };
  if (detail) {
    base.content = plain.content;
    base.authorName = plain.authorNameSnapshot || null;
    base.seoTitle = plain.seoTitle || null;
    base.seoDescription = plain.seoDescription || null;
    base.ogImageUrl = plain.ogImageUrl || url || null;
    base.readingMinutes = estimateReadingMinutes(plain.content);
    base.viewCount = plain.viewCount != null ? plain.viewCount : 0;
    /** 以數字 id 進入詳情時，提供 canonical slug 供前台導向友善 URL */
    if (requestedSegment != null && /^\d+$/.test(String(requestedSegment)) && plain.slug) {
      base.canonicalSlug = plain.slug;
    }
  }
  return base;
}

function serializeAnnouncementForAdmin(row) {
  const plain = row && typeof row.get === 'function' ? row.get({ plain: true }) : row;
  return {
    ...plain,
    tags: Array.isArray(plain.tags) ? plain.tags : plain.tags || [],
    /** 前台是否會顯示（含過期排除）；DB status 仍以 status 欄位為準 */
    isEffectivelyPublic: isPubliclyVisiblePlain(plain),
  };
}

async function listPublicAnnouncements({
  limit = 10,
  page = 1,
  keyword,
  q,
  category,
  tag,
  pinnedFirst = true,
} = {}) {
  // TODO: 依 audienceType（students/teachers/admins）過濾公開列表，需與登入身分或公開路由策略對齊
  await promoteDueScheduledAnnouncements();
  const now = new Date();
  const lim = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const whereClause = publicListWhere(now, { category, tag, q, keyword });

  const pinFirst = pinnedFirst !== false && String(pinnedFirst).toLowerCase() !== 'false';
  const { rows, count } = await Announcement.findAndCountAll({
    where: whereClause,
    order: pinFirst ? publicOrder() : [['publishedAt', 'DESC'], ['id', 'DESC']],
    limit: lim,
    offset,
  });

  const items = rows.map((r) => serializeAnnouncementForPublic(r.get({ plain: true }), { detail: false }));
  const total = count;
  const totalPages = Math.max(Math.ceil(total / lim), 1);

  return {
    items,
    pagination: {
      page: pg,
      limit: lim,
      total,
      totalPages,
    },
    filters: {
      category: category || null,
      tag: tag || null,
      q: (q != null && q !== '' ? q : keyword) || null,
      pinnedFirst: pinFirst,
    },
  };
}

/** 相容舊名 */
async function listPublished(opts) {
  return listPublicAnnouncements(opts);
}

async function getPublicAnnouncementByParam(param, { incrementView = false } = {}) {
  await promoteDueScheduledAnnouncements();
  const now = new Date();
  const raw = String(param || '').trim();
  if (!raw) return null;

  let row = null;
  if (/^\d+$/.test(raw)) {
    row = await Announcement.findOne({
      where: { id: parseInt(raw, 10), deletedAt: null },
    });
  } else {
    row = await Announcement.findOne({
      where: { slug: raw, deletedAt: null },
    });
  }

  if (!row) {
    if (/^\d+$/.test(raw)) {
      row = await Announcement.findOne({
        where: { slug: raw, deletedAt: null },
      });
    }
  }

  if (!row) return null;
  const plain = row.get({ plain: true });
  if (!isPubliclyVisiblePlain(plain, now)) return null;

  if (incrementView) {
    await Announcement.increment('viewCount', { where: { id: row.id } });
    plain.viewCount = (plain.viewCount || 0) + 1;
  }

  return serializeAnnouncementForPublic(plain, { detail: true, requestedSegment: raw });
}

async function getPublishedById(id) {
  const r = await getPublicAnnouncementByParam(String(id), { incrementView: false });
  return r;
}

async function getPublishedBySlug(slug) {
  return getPublicAnnouncementByParam(String(slug), { incrementView: false });
}

async function getPublishedByParam(param) {
  return getPublicAnnouncementByParam(param, { incrementView: true });
}

const ADMIN_SORT_FIELDS = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  publishedAt: 'publishedAt',
};

async function listAdmin({
  page = 1,
  limit = 20,
  keyword,
  q,
  status = 'all',
  category,
  authorId,
  pinned,
  dateFrom,
  dateTo,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  includeDeleted = false,
}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const scope = includeDeleted === true || includeDeleted === 'true' ? Announcement.unscoped() : Announcement;

  const whereClause = {};
  if (includeDeleted !== true && includeDeleted !== 'true') {
    whereClause.deletedAt = null;
  }

  const search = (q != null && q !== '' ? q : keyword) || '';
  if (search && String(search).trim()) {
    const k = `%${String(search).trim()}%`;
    whereClause[Op.or] = [
      { title: { [Op.like]: k } },
      { summary: { [Op.like]: k } },
      { slug: { [Op.like]: k } },
    ];
  }

  if (status && status !== 'all') {
    whereClause.status = status;
  }

  if (category && String(category).trim()) {
    whereClause.category = String(category).trim();
  }

  if (authorId != null && authorId !== '' && !Number.isNaN(parseInt(authorId, 10))) {
    whereClause.authorId = parseInt(authorId, 10);
  }

  if (pinned === 'true' || pinned === true) {
    whereClause.isPinned = true;
  } else if (pinned === 'false' || pinned === false) {
    whereClause.isPinned = false;
  }

  if (dateFrom || dateTo) {
    whereClause.updatedAt = {};
    if (dateFrom) whereClause.updatedAt[Op.gte] = new Date(dateFrom);
    if (dateTo) whereClause.updatedAt[Op.lte] = new Date(dateTo);
  }

  const colName = ADMIN_SORT_FIELDS[sortBy] || 'createdAt';
  const dir = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const { rows, count } = await scope.findAndCountAll({
    where: whereClause,
    order: [[colName, dir], ['id', 'DESC']],
    limit: lim,
    offset,
  });

  const total = count;
  const totalPages = Math.max(Math.ceil(total / lim), 1);

  return {
    items: rows.map((r) => serializeAnnouncementForAdmin(r)),
    pagination: {
      page: pg,
      limit: lim,
      total,
      totalPages,
    },
  };
}

async function getByIdAdmin(id) {
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) return null;
  return Announcement.findOne({ where: { id: numId, deletedAt: null } });
}

async function getByIdAdminUnscoped(id) {
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) return null;
  return Announcement.unscoped().findByPk(numId);
}

async function resolveAuthorSnapshot(userId) {
  if (!userId) return { authorId: null, authorNameSnapshot: null };
  const t = await Teacher.findByPk(userId, { attributes: ['id', 'name'] });
  if (!t) return { authorId: userId, authorNameSnapshot: null };
  return { authorId: userId, authorNameSnapshot: t.name || null };
}

function deriveInitialStatus(body, now = new Date()) {
  if (body.status === ANNOUNCEMENT_STATUS.ARCHIVED) {
    return { status: ANNOUNCEMENT_STATUS.ARCHIVED, isPublished: false };
  }
  const sch = body.scheduledPublishAt ? new Date(body.scheduledPublishAt) : null;
  if (sch && !Number.isNaN(sch.getTime()) && sch > now) {
    return { status: ANNOUNCEMENT_STATUS.SCHEDULED, isPublished: false };
  }
  if (body.isPublished === true || body.status === ANNOUNCEMENT_STATUS.PUBLISHED) {
    return { status: ANNOUNCEMENT_STATUS.PUBLISHED, isPublished: true };
  }
  return { status: ANNOUNCEMENT_STATUS.DRAFT, isPublished: false };
}

async function createAnnouncement(body, userId) {
  const err = validateAnnouncementPayload(body, { isCreate: true });
  if (err.length) {
    const e = new Error(err.join('; '));
    e.status = 400;
    throw e;
  }

  const title = String(body.title).trim();
  const content = normalizeContentForStorage(body.content);
  const { authorId, authorNameSnapshot } = await resolveAuthorSnapshot(userId);
  const slugInput = body.slug != null && String(body.slug).trim() ? String(body.slug).trim() : null;
  const slug = slugInput ? await ensureUniqueSlug(slugInput.slice(0, SLUG_MAX)) : await ensureUniqueSlug(baseSlugFromTitle(title));

  const { status, isPublished } = deriveInitialStatus(body);
  let publishedAt = null;
  let scheduledPublishAt = null;
  if (status === ANNOUNCEMENT_STATUS.PUBLISHED) {
    const dt = body.publishedAt ? new Date(body.publishedAt) : new Date();
    publishedAt = Number.isNaN(dt.getTime()) ? new Date() : dt;
  } else if (status === ANNOUNCEMENT_STATUS.SCHEDULED) {
    scheduledPublishAt = new Date(body.scheduledPublishAt);
  }

  const row = await Announcement.create({
    title,
    slug,
    summary: body.summary != null ? String(body.summary).trim() || null : null,
    content,
    coverImage: body.coverImage != null ? String(body.coverImage).trim() || null : null,
    coverImageAlt: body.coverImageAlt != null ? String(body.coverImageAlt).trim().slice(0, COVER_ALT_MAX) || null : null,
    isPublished,
    status,
    publishedAt,
    scheduledPublishAt,
    unpublishedAt: null,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    isPinned: !!body.isPinned,
    sortOrder: body.sortOrder != null ? parseInt(body.sortOrder, 10) || 0 : 0,
    category: body.category != null && String(body.category).trim() ? String(body.category).trim() : 'general',
    tags: parseTagsInput(body.tags),
    authorId,
    authorNameSnapshot,
    seoTitle: body.seoTitle != null ? String(body.seoTitle).trim().slice(0, SEO_TITLE_MAX) || null : null,
    seoDescription:
      body.seoDescription != null ? String(body.seoDescription).trim().slice(0, SEO_DESC_MAX) || null : null,
    ogImageUrl: body.ogImageUrl != null ? String(body.ogImageUrl).trim().slice(0, OG_MAX) || null : null,
    viewCount: 0,
    createdBy: userId || null,
    updatedBy: userId || null,
    lastEditedBy: userId || null,
    audienceType: body.audienceType != null ? String(body.audienceType).trim() : 'all',
    shouldSendNotification: !!body.shouldSendNotification,
    shouldSendEmail: !!body.shouldSendEmail,
    notificationStatus: body.notificationStatus != null ? String(body.notificationStatus).slice(0, 32) : null,
    emailStatus: body.emailStatus != null ? String(body.emailStatus).slice(0, 32) : null,
  });

  return serializeAnnouncementForAdmin(row);
}

async function createRevisionSnapshot(row, userId) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const max = await AnnouncementRevision.max('versionNumber', {
    where: { announcementId: plain.id },
  });
  const next = (max || 0) + 1;
  await AnnouncementRevision.create({
    announcementId: plain.id,
    versionNumber: next,
    title: plain.title,
    summary: plain.summary,
    content: plain.content,
    coverImage: plain.coverImage,
    seoTitle: plain.seoTitle,
    seoDescription: plain.seoDescription,
    editedBy: userId || null,
  });
}

async function updateAnnouncement(id, body, userId) {
  const row = await getByIdAdmin(id);
  if (!row) {
    const e = new Error('找不到公告');
    e.status = 404;
    throw e;
  }

  const err = validateAnnouncementPayload(body, { isCreate: false });
  if (err.length) {
    const e = new Error(err.join('; '));
    e.status = 400;
    throw e;
  }

  const contentChanging =
    body.title !== undefined ||
    body.summary !== undefined ||
    body.content !== undefined ||
    body.coverImage !== undefined;

  if (contentChanging) {
    await createRevisionSnapshot(row, userId);
  }

  const patch = { updatedBy: userId || null, lastEditedBy: userId || null };

  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.summary !== undefined) patch.summary = body.summary != null ? String(body.summary).trim() || null : null;
  if (body.content !== undefined) patch.content = normalizeContentForStorage(body.content);
  if (body.coverImage !== undefined) patch.coverImage = body.coverImage != null ? String(body.coverImage).trim() || null : null;
  if (body.coverImageAlt !== undefined) {
    patch.coverImageAlt = body.coverImageAlt != null ? String(body.coverImageAlt).trim().slice(0, COVER_ALT_MAX) || null : null;
  }
  if (body.isPinned !== undefined) patch.isPinned = !!body.isPinned;
  if (body.sortOrder !== undefined) patch.sortOrder = parseInt(body.sortOrder, 10) || 0;
  if (body.category !== undefined) {
    patch.category = body.category != null && String(body.category).trim() ? String(body.category).trim() : 'general';
  }
  if (body.tags !== undefined) patch.tags = parseTagsInput(body.tags);
  if (body.seoTitle !== undefined) {
    patch.seoTitle = body.seoTitle != null ? String(body.seoTitle).trim().slice(0, SEO_TITLE_MAX) || null : null;
  }
  if (body.seoDescription !== undefined) {
    patch.seoDescription =
      body.seoDescription != null ? String(body.seoDescription).trim().slice(0, SEO_DESC_MAX) || null : null;
  }
  if (body.ogImageUrl !== undefined) {
    patch.ogImageUrl = body.ogImageUrl != null ? String(body.ogImageUrl).trim().slice(0, OG_MAX) || null : null;
  }
  if (body.slug !== undefined && body.slug != null && String(body.slug).trim()) {
    patch.slug = await ensureUniqueSlug(String(body.slug).trim().slice(0, SLUG_MAX), row.id);
  }
  if (body.audienceType !== undefined) {
    patch.audienceType = body.audienceType != null ? String(body.audienceType).trim() : 'all';
  }
  if (body.shouldSendNotification !== undefined) patch.shouldSendNotification = !!body.shouldSendNotification;
  if (body.shouldSendEmail !== undefined) patch.shouldSendEmail = !!body.shouldSendEmail;
  if (body.notificationStatus !== undefined) {
    patch.notificationStatus = body.notificationStatus != null ? String(body.notificationStatus).slice(0, 32) : null;
  }
  if (body.emailStatus !== undefined) {
    patch.emailStatus = body.emailStatus != null ? String(body.emailStatus).slice(0, 32) : null;
  }

  if (body.expiresAt !== undefined) {
    patch.expiresAt = body.expiresAt != null && body.expiresAt !== '' ? new Date(body.expiresAt) : null;
  }

  if (body.scheduledPublishAt !== undefined) {
    if (body.scheduledPublishAt === null || body.scheduledPublishAt === '') {
      patch.scheduledPublishAt = null;
      if (row.status === ANNOUNCEMENT_STATUS.SCHEDULED) {
        patch.status = ANNOUNCEMENT_STATUS.DRAFT;
        patch.isPublished = false;
      }
    } else {
      const dt = new Date(body.scheduledPublishAt);
      const now = new Date();
      if (dt > now && [ANNOUNCEMENT_STATUS.DRAFT, ANNOUNCEMENT_STATUS.SCHEDULED, ANNOUNCEMENT_STATUS.UNPUBLISHED].includes(row.status)) {
        patch.scheduledPublishAt = dt;
        patch.status = ANNOUNCEMENT_STATUS.SCHEDULED;
        patch.isPublished = false;
      }
    }
  }

  if (body.isPublished !== undefined || body.publishedAt !== undefined) {
    const wantPub = body.isPublished !== undefined ? !!body.isPublished : row.isPublished;
    if (wantPub) {
      patch.status = ANNOUNCEMENT_STATUS.PUBLISHED;
      patch.isPublished = true;
      let dt = body.publishedAt ? new Date(body.publishedAt) : row.publishedAt || new Date();
      if (Number.isNaN(dt.getTime())) dt = new Date();
      patch.publishedAt = dt;
      patch.scheduledPublishAt = null;
      patch.unpublishedAt = null;
    } else if (row.publishedAt && row.status === ANNOUNCEMENT_STATUS.PUBLISHED) {
      patch.status = ANNOUNCEMENT_STATUS.UNPUBLISHED;
      patch.isPublished = false;
      patch.unpublishedAt = new Date();
    } else {
      patch.isPublished = false;
    }
  }

  await row.update(patch);
  return row.reload();
}

async function deleteAnnouncement(id) {
  const row = await getByIdAdmin(id);
  if (!row) {
    const e = new Error('找不到公告');
    e.status = 404;
    throw e;
  }
  await row.destroy();
  return true;
}

async function publishAnnouncement(id, userId, { publishedAt: pubInput } = {}) {
  const row = await getByIdAdmin(id);
  if (!row) {
    const e = new Error('找不到公告');
    e.status = 404;
    throw e;
  }
  const dt = pubInput ? new Date(pubInput) : new Date();
  const publishedAt = Number.isNaN(dt.getTime()) ? new Date() : dt;
  await row.update({
    status: ANNOUNCEMENT_STATUS.PUBLISHED,
    isPublished: true,
    publishedAt,
    scheduledPublishAt: null,
    unpublishedAt: null,
    updatedBy: userId || null,
    lastEditedBy: userId || null,
  });
  return row.reload();
}

async function unpublishAnnouncement(id, userId) {
  const row = await getByIdAdmin(id);
  if (!row) {
    const e = new Error('找不到公告');
    e.status = 404;
    throw e;
  }
  await row.update({
    status: ANNOUNCEMENT_STATUS.UNPUBLISHED,
    isPublished: false,
    unpublishedAt: new Date(),
    updatedBy: userId || null,
    lastEditedBy: userId || null,
  });
  return row.reload();
}

async function archiveAnnouncement(id, userId) {
  const row = await getByIdAdmin(id);
  if (!row) {
    const e = new Error('找不到公告');
    e.status = 404;
    throw e;
  }
  await row.update({
    status: ANNOUNCEMENT_STATUS.ARCHIVED,
    isPublished: false,
    updatedBy: userId || null,
    lastEditedBy: userId || null,
  });
  return row.reload();
}

async function duplicateAnnouncement(id, userId) {
  const row = await getByIdAdmin(id);
  if (!row) {
    const e = new Error('找不到公告');
    e.status = 404;
    throw e;
  }
  const p = row.get({ plain: true });
  const title = `${p.title}（副本）`.slice(0, TITLE_MAX);
  const base = `${p.slug}-copy`;
  const slug = await ensureUniqueSlug(base.slice(0, SLUG_MAX - 10));
  const { authorId, authorNameSnapshot } = await resolveAuthorSnapshot(userId);

  const copy = await Announcement.create({
    title,
    slug,
    summary: p.summary,
    content: p.content,
    coverImage: p.coverImage,
    coverImageAlt: p.coverImageAlt,
    isPublished: false,
    status: ANNOUNCEMENT_STATUS.DRAFT,
    publishedAt: null,
    scheduledPublishAt: null,
    unpublishedAt: null,
    expiresAt: null,
    isPinned: false,
    sortOrder: 0,
    category: p.category || 'general',
    tags: p.tags,
    authorId,
    authorNameSnapshot,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    ogImageUrl: p.ogImageUrl,
    viewCount: 0,
    createdBy: userId || null,
    updatedBy: userId || null,
    lastEditedBy: userId || null,
    audienceType: p.audienceType || 'all',
    shouldSendNotification: false,
    shouldSendEmail: false,
    notificationStatus: null,
    emailStatus: null,
  });
  return serializeAnnouncementForAdmin(copy);
}

async function bulkAnnouncementsAction({ action, ids }, userId) {
  const list = Array.isArray(ids) ? ids.map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n)) : [];
  if (!list.length) {
    const e = new Error('ids 必填');
    e.status = 400;
    throw e;
  }
  const results = { ok: 0, failed: 0 };
  for (const id of list) {
    try {
      if (action === 'publish') {
        await publishAnnouncement(id, userId);
      } else if (action === 'unpublish') {
        await unpublishAnnouncement(id, userId);
      } else if (action === 'archive') {
        await archiveAnnouncement(id, userId);
      } else if (action === 'pin') {
        await setPin(id, { isPinned: true }, userId);
      } else if (action === 'unpin') {
        await setPin(id, { isPinned: false }, userId);
      } else if (action === 'delete') {
        await deleteAnnouncement(id);
      } else {
        const e = new Error('不支援的 action');
        e.status = 400;
        throw e;
      }
      results.ok += 1;
    } catch (_) {
      results.failed += 1;
    }
  }
  return results;
}

async function listRevisions(announcementId) {
  const aid = parseInt(announcementId, 10);
  if (Number.isNaN(aid)) return [];
  return AnnouncementRevision.findAll({
    where: { announcementId: aid },
    order: [['versionNumber', 'DESC']],
  });
}

async function restoreRevision(announcementId, revisionId, userId) {
  const row = await getByIdAdmin(announcementId);
  if (!row) {
    const e = new Error('找不到公告');
    e.status = 404;
    throw e;
  }
  const rev = await AnnouncementRevision.findOne({
    where: { id: parseInt(revisionId, 10), announcementId: row.id },
  });
  if (!rev) {
    const e = new Error('找不到版本紀錄');
    e.status = 404;
    throw e;
  }
  await createRevisionSnapshot(row, userId);
  await row.update({
    title: rev.title,
    summary: rev.summary,
    content: rev.content,
    coverImage: rev.coverImage,
    seoTitle: rev.seoTitle,
    seoDescription: rev.seoDescription,
    updatedBy: userId || null,
    lastEditedBy: userId || null,
  });
  return row.reload();
}

async function setPublish(id, { isPublished }, userId) {
  if (isPublished) return publishAnnouncement(id, userId);
  return unpublishAnnouncement(id, userId);
}

async function setPin(id, { isPinned }, userId) {
  const row = await getByIdAdmin(id);
  if (!row) {
    const e = new Error('找不到公告');
    e.status = 404;
    throw e;
  }
  await row.update({
    isPinned: !!isPinned,
    updatedBy: userId || null,
    lastEditedBy: userId || null,
  });
  return row.reload();
}

function recordAnnouncementAudit(payload) {
  const { req, action, entityId, targetSummary, beforeData, afterData, changedFields } = payload;
  auditLogService.logAuditAsync({
    module: 'announcements',
    action,
    entityType: 'Announcement',
    entityId: String(entityId),
    targetSummary,
    beforeData,
    afterData,
    changedFields,
    req,
    requestId: req?.requestId || `ann-${Date.now()}`,
  });
}

module.exports = {
  listPublicAnnouncements,
  listPublished,
  getPublicAnnouncementByParam,
  getPublishedById,
  getPublishedBySlug,
  getPublishedByParam,
  listAdmin,
  getByIdAdmin,
  getByIdAdminUnscoped,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
  archiveAnnouncement,
  duplicateAnnouncement,
  bulkAnnouncementsAction,
  listRevisions,
  restoreRevision,
  createRevisionSnapshot,
  setPublish,
  setPin,
  recordAnnouncementAudit,
  excerptFromContent,
  stripTags,
  normalizeAnnouncementStatus,
  serializeAnnouncementForPublic,
  serializeAnnouncementForAdmin,
  validateAnnouncementPayload,
  ensureUniqueSlug,
  baseSlugFromTitle,
  TITLE_MAX,
  SUMMARY_MAX,
  CONTENT_MAX,
  ANNOUNCEMENT_STATUS,
};
