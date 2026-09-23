'use strict';

const fs = require('fs');
const path = require('path');
const MediaAsset = require('../models/MediaAsset');

const MAX_ATTACHMENTS = 5;
const BACKEND_ROOT = path.join(__dirname, '..');
const FRONTEND_PUBLIC = path.join(__dirname, '..', '..', 'reservation-frontend', 'public');

/**
 * 正規化後台送出的附件清單（僅保留必要欄位）。
 * @param {unknown} raw
 * @returns {{ mediaId: number|null, url: string, filename: string, mime: string|null, label: string|null }[]}
 */
function normalizeAttachmentsInput(raw) {
  if (raw == null) return [];
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const url = String(item.url || '').trim();
    if (!url) continue;
    if (!url.startsWith('/') || url.includes('..')) continue;
    const mediaIdRaw = item.mediaId ?? item.dbId ?? null;
    const mediaId = mediaIdRaw != null && Number.isFinite(Number(mediaIdRaw))
      ? Number(mediaIdRaw)
      : null;
    out.push({
      mediaId,
      url,
      filename: String(item.filename || item.originalName || item.label || path.basename(url)).slice(0, 200),
      mime: item.mime || item.mimeType || null,
      label: item.label ? String(item.label).slice(0, 200) : null,
    });
    if (out.length >= MAX_ATTACHMENTS) break;
  }
  return out;
}

function resolveDiskPath(url) {
  const u = String(url || '').trim();
  if (!u.startsWith('/') || u.includes('..')) return null;
  if (u.startsWith('/uploads/')) {
    const full = path.join(BACKEND_ROOT, u.replace(/^\//, ''));
    if (fs.existsSync(full)) return full;
    return null;
  }
  if (u.startsWith('/images/')) {
    const full = path.join(FRONTEND_PUBLIC, u.replace(/^\//, ''));
    if (fs.existsSync(full)) return full;
    return null;
  }
  return null;
}

/**
 * 把模板附件轉成 nodemailer attachments（略過找不到的檔案）。
 * @param {Array} attachments
 * @returns {Promise<{ attachments: object[], warnings: string[] }>}
 */
async function buildNodemailerAttachments(attachments) {
  const list = normalizeAttachmentsInput(attachments);
  const result = [];
  const warnings = [];

  for (const item of list) {
    let diskPath = resolveDiskPath(item.url);
    let filename = item.filename;
    let contentType = item.mime || undefined;

    if (!diskPath && item.mediaId) {
      // eslint-disable-next-line no-await-in-loop
      const row = await MediaAsset.findByPk(item.mediaId);
      if (row) {
        diskPath = resolveDiskPath(row.url);
        filename = filename || row.originalName || row.label || path.basename(row.url);
        contentType = contentType || row.mime || undefined;
      }
    }

    if (!diskPath) {
      warnings.push(`附件找不到檔案：${item.label || item.filename || item.url}`);
      continue;
    }

    result.push({
      filename: filename || path.basename(diskPath),
      path: diskPath,
      contentType,
    });
  }

  return { attachments: result, warnings };
}

module.exports = {
  MAX_ATTACHMENTS,
  normalizeAttachmentsInput,
  resolveDiskPath,
  buildNodemailerAttachments,
};
