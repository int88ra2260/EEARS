'use strict';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VIDEO_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const PHOTO_PATTERN = /^\/(?:uploads|images)\/[A-Za-z0-9._~/-]+$/;

const TEXT_LIMITS = {
  displayName: 80,
  degree: 120,
  experience: 300,
  languages: 120,
  focus: 120,
};

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function cleanText(value, max) {
  const text = String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (text.length > max) {
    throw httpError(400, `內容請勿超過 ${max} 字`);
  }
  return text;
}

function normalizeSlug(value) {
  const slug = String(value ?? '').trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug) || slug.length < 2 || slug.length > 40) {
    throw httpError(400, '代號請用 2–40 字的英文小寫、數字或連字號');
  }
  return slug;
}

function normalizePhotoUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) return null;
  if (url.length > 500 || url.includes('..') || !PHOTO_PATTERN.test(url)) {
    throw httpError(400, '大頭照請從媒體庫選擇');
  }
  return url;
}

function normalizeVideoId(value) {
  const videoId = String(value ?? '').trim();
  if (!videoId) return null;
  if (!VIDEO_PATTERN.test(videoId)) {
    throw httpError(400, '請填 YouTube 影片編號，不要貼整段網址');
  }
  return videoId;
}

function normalizeProfilePayload(body, { isCreate = false } = {}) {
  const source = body && typeof body === 'object' ? body : {};
  const payload = {};

  if (isCreate || source.slug !== undefined) {
    payload.slug = normalizeSlug(source.slug);
  }
  if (isCreate || source.displayName !== undefined) {
    const displayName = cleanText(source.displayName, TEXT_LIMITS.displayName);
    if (!displayName) throw httpError(400, '請填寫顯示名稱');
    payload.displayName = displayName;
  }
  if (source.photoUrl !== undefined) payload.photoUrl = normalizePhotoUrl(source.photoUrl);
  if (source.degree !== undefined) payload.degree = cleanText(source.degree, TEXT_LIMITS.degree);
  if (source.experience !== undefined) payload.experience = cleanText(source.experience, TEXT_LIMITS.experience);
  if (source.languages !== undefined) payload.languages = cleanText(source.languages, TEXT_LIMITS.languages);
  if (source.focus !== undefined) payload.focus = cleanText(source.focus, TEXT_LIMITS.focus);
  if (source.videoId !== undefined) payload.videoId = normalizeVideoId(source.videoId);
  if (source.isPublished !== undefined) payload.isPublished = !!source.isPublished;

  return payload;
}

function serializePublic(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.slug,
    name: plain.displayName,
    photo: plain.photoUrl || '',
    degree: plain.degree || '',
    experience: plain.experience || '',
    languages: plain.languages || '',
    focus: plain.focus || '',
    videoId: plain.videoId || '',
  };
}

function serializeAdmin(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    slug: plain.slug,
    displayName: plain.displayName,
    sortOrder: plain.sortOrder,
    isPublished: !!plain.isPublished,
    photoUrl: plain.photoUrl || '',
    degree: plain.degree || '',
    experience: plain.experience || '',
    languages: plain.languages || '',
    focus: plain.focus || '',
    videoId: plain.videoId || '',
    updatedAt: plain.updatedAt || null,
  };
}

module.exports = {
  TEXT_LIMITS,
  normalizeProfilePayload,
  serializePublic,
  serializeAdmin,
};
