'use strict';

const { LeaderPublicProfile } = require('../models');
const {
  normalizeProfilePayload,
  serializeAdmin,
  serializePublic,
} = require('./leaderPublicProfileFields');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function listAdmin() {
  const rows = await LeaderPublicProfile.findAll({
    order: [
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  return rows.map(serializeAdmin);
}

async function listPublic() {
  const rows = await LeaderPublicProfile.findAll({
    where: { isPublished: true },
    order: [
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  return rows.map(serializePublic);
}

async function createProfile(body, actorId) {
  const payload = normalizeProfilePayload(body, { isCreate: true });
  const existing = await LeaderPublicProfile.findOne({ where: { slug: payload.slug } });
  if (existing) throw httpError(409, '這個代號已經有人使用');

  const maxSort = await LeaderPublicProfile.max('sortOrder');
  const created = await LeaderPublicProfile.create({
    ...payload,
    sortOrder: Number.isFinite(maxSort) ? maxSort + 1 : 0,
    isPublished: payload.isPublished !== undefined ? payload.isPublished : true,
    updatedBy: actorId || null,
  });
  return serializeAdmin(created);
}

async function updateProfile(id, body, actorId) {
  const row = await LeaderPublicProfile.findByPk(id);
  if (!row) throw httpError(404, '找不到這位 Leader');

  const payload = normalizeProfilePayload(body, { isCreate: false });
  if (payload.slug && payload.slug !== row.slug) {
    const existing = await LeaderPublicProfile.findOne({ where: { slug: payload.slug } });
    if (existing) throw httpError(409, '這個代號已經有人使用');
  }
  payload.updatedBy = actorId || null;
  await row.update(payload);
  return serializeAdmin(row);
}

async function deleteProfile(id) {
  const row = await LeaderPublicProfile.findByPk(id);
  if (!row) throw httpError(404, '找不到這位 Leader');
  const removed = serializeAdmin(row);
  await row.destroy();
  return removed;
}

async function reorderProfiles(ids) {
  if (!Array.isArray(ids) || !ids.length) throw httpError(400, '請提供排序');
  const numericIds = ids.map((id) => Number(id));
  if (numericIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw httpError(400, '排序編號不正確');
  }
  if (new Set(numericIds).size !== numericIds.length) {
    throw httpError(400, '排序裡有重複的人');
  }

  const rows = await LeaderPublicProfile.findAll({ attributes: ['id'] });
  const known = new Set(rows.map((row) => row.id));
  if (numericIds.length !== known.size || numericIds.some((id) => !known.has(id))) {
    throw httpError(400, '排序必須包含目前全部的人');
  }

  await Promise.all(
    numericIds.map((id, index) => LeaderPublicProfile.update({ sortOrder: index }, { where: { id } })),
  );
  return listAdmin();
}

module.exports = {
  listAdmin,
  listPublic,
  createProfile,
  updateProfile,
  deleteProfile,
  reorderProfiles,
};
