'use strict';

const { Op } = require('sequelize');
const { LeaderPublicProfile, LeaderSemesterAssignment } = require('../models');
const { getCurrentSemester, isValidSemester } = require('../utils/semester');
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

/**
 * 序列化 Leader 包含學期指派資訊
 */
function serializeAdminWithAssignment(row, assignment) {
  const base = serializeAdmin(row);
  return {
    ...base,
    isArchived: !!row.isArchived,
    semesterAssignment: assignment
      ? {
          id: assignment.id,
          semesterId: assignment.semesterId,
          isPublished: !!assignment.isPublished,
          sortOrder: assignment.sortOrder,
        }
      : null,
  };
}

/**
 * 取得當前學期 ID
 */
function ensureSemesterId(semesterId) {
  if (semesterId && isValidSemester(semesterId)) {
    return semesterId;
  }
  return getCurrentSemester();
}

// ============ 後台列表 ============

/**
 * 列出指定學期的 Leaders（未封存）
 */
async function listAdminBySemester(semesterId, { includeArchived = false } = {}) {
  const semester = ensureSemesterId(semesterId);

  const whereProfile = includeArchived ? {} : { isArchived: false };

  const assignments = await LeaderSemesterAssignment.findAll({
    where: { semesterId: semester },
    include: [
      {
        model: LeaderPublicProfile,
        as: 'leader',
        where: whereProfile,
        required: true,
      },
    ],
    order: [
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  return assignments.map((a) => serializeAdminWithAssignment(a.leader, a));
}

/**
 * 列出封存的 Leaders（不分學期）
 */
async function listArchivedLeaders() {
  const rows = await LeaderPublicProfile.findAll({
    where: { isArchived: true },
    order: [
      ['displayName', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  return rows.map((row) => ({
    ...serializeAdmin(row),
    isArchived: true,
    semesterAssignment: null,
  }));
}

/**
 * 列出所有 Leaders（後台總覽用）
 */
async function listAdmin() {
  const rows = await LeaderPublicProfile.findAll({
    where: { isArchived: false },
    order: [
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  return rows.map((row) => ({
    ...serializeAdmin(row),
    isArchived: false,
  }));
}

// ============ 公開列表 ============

/**
 * 列出當前學期公開的 Leaders
 */
async function listPublic() {
  const semester = getCurrentSemester();

  const assignments = await LeaderSemesterAssignment.findAll({
    where: {
      semesterId: semester,
      isPublished: true,
    },
    include: [
      {
        model: LeaderPublicProfile,
        as: 'leader',
        where: { isArchived: false },
        required: true,
      },
    ],
    order: [
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  return assignments.map((a) => serializePublic(a.leader));
}

// ============ Leader CRUD ============

/**
 * 建立 Leader 並指派到學期
 */
async function createProfile(body, actorId, semesterId) {
  const semester = ensureSemesterId(semesterId);
  const payload = normalizeProfilePayload(body, { isCreate: true });

  const existing = await LeaderPublicProfile.findOne({ where: { slug: payload.slug } });
  if (existing) throw httpError(409, '這個代號已經有人使用');

  // 建立 profile
  const created = await LeaderPublicProfile.create({
    ...payload,
    sortOrder: 0,
    isPublished: true,
    isArchived: false,
    updatedBy: actorId || null,
  });

  // 建立學期指派
  const maxSort = await LeaderSemesterAssignment.max('sortOrder', {
    where: { semesterId: semester },
  });

  const assignment = await LeaderSemesterAssignment.create({
    leaderId: created.id,
    semesterId: semester,
    isPublished: body.isPublished !== false,
    sortOrder: Number.isFinite(maxSort) ? maxSort + 1 : 0,
  });

  return serializeAdminWithAssignment(created, assignment);
}

/**
 * 更新 Leader 資料（共用資料）
 */
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

  return {
    ...serializeAdmin(row),
    isArchived: !!row.isArchived,
  };
}

/**
 * 刪除 Leader（完全刪除，包含所有學期指派）
 */
async function deleteProfile(id) {
  const row = await LeaderPublicProfile.findByPk(id);
  if (!row) throw httpError(404, '找不到這位 Leader');
  const removed = serializeAdmin(row);
  await row.destroy(); // CASCADE 會刪除所有 assignments
  return removed;
}

// ============ 封存/還原 ============

/**
 * 封存 Leader
 */
async function archiveProfile(id, actorId) {
  const row = await LeaderPublicProfile.findByPk(id);
  if (!row) throw httpError(404, '找不到這位 Leader');
  if (row.isArchived) throw httpError(400, '這位 Leader 已經封存');

  await row.update({ isArchived: true, updatedBy: actorId || null });

  return {
    ...serializeAdmin(row),
    isArchived: true,
  };
}

/**
 * 還原封存的 Leader
 */
async function unarchiveProfile(id, actorId) {
  const row = await LeaderPublicProfile.findByPk(id);
  if (!row) throw httpError(404, '找不到這位 Leader');
  if (!row.isArchived) throw httpError(400, '這位 Leader 不在封存狀態');

  await row.update({ isArchived: false, updatedBy: actorId || null });

  return {
    ...serializeAdmin(row),
    isArchived: false,
  };
}

// ============ 學期指派 ============

/**
 * 指派 Leader 到學期
 */
async function assignToSemester(leaderId, semesterId, options = {}) {
  const semester = ensureSemesterId(semesterId);

  const leader = await LeaderPublicProfile.findByPk(leaderId);
  if (!leader) throw httpError(404, '找不到這位 Leader');
  if (leader.isArchived) throw httpError(400, '封存的 Leader 不能指派學期');

  const existing = await LeaderSemesterAssignment.findOne({
    where: { leaderId, semesterId: semester },
  });
  if (existing) throw httpError(409, '這位 Leader 已經在這個學期');

  const maxSort = await LeaderSemesterAssignment.max('sortOrder', {
    where: { semesterId: semester },
  });

  const assignment = await LeaderSemesterAssignment.create({
    leaderId,
    semesterId: semester,
    isPublished: options.isPublished !== false,
    sortOrder: Number.isFinite(maxSort) ? maxSort + 1 : 0,
  });

  return serializeAdminWithAssignment(leader, assignment);
}

/**
 * 從學期移除 Leader（不刪除 Leader 本身）
 */
async function removeFromSemester(leaderId, semesterId) {
  const semester = ensureSemesterId(semesterId);

  const assignment = await LeaderSemesterAssignment.findOne({
    where: { leaderId, semesterId: semester },
  });
  if (!assignment) throw httpError(404, '這位 Leader 不在這個學期');

  await assignment.destroy();
  return { success: true };
}

/**
 * 更新學期指派（發布狀態）
 */
async function updateSemesterAssignment(assignmentId, body) {
  const assignment = await LeaderSemesterAssignment.findByPk(assignmentId);
  if (!assignment) throw httpError(404, '找不到這筆學期指派');

  const patch = {};
  if (body.isPublished !== undefined) patch.isPublished = !!body.isPublished;

  await assignment.update(patch);

  const leader = await LeaderPublicProfile.findByPk(assignment.leaderId);
  return serializeAdminWithAssignment(leader, assignment);
}

/**
 * 排序學期內的 Leaders
 */
async function reorderInSemester(semesterId, ids) {
  const semester = ensureSemesterId(semesterId);

  if (!Array.isArray(ids) || !ids.length) throw httpError(400, '請提供排序');
  const numericIds = ids.map((id) => Number(id));
  if (numericIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw httpError(400, '排序編號不正確');
  }
  if (new Set(numericIds).size !== numericIds.length) {
    throw httpError(400, '排序裡有重複的人');
  }

  // 這裡的 ids 是 assignment.id
  const assignments = await LeaderSemesterAssignment.findAll({
    where: { semesterId: semester },
    attributes: ['id'],
  });
  const known = new Set(assignments.map((a) => a.id));

  if (numericIds.length !== known.size || numericIds.some((id) => !known.has(id))) {
    throw httpError(400, '排序必須包含該學期全部的人');
  }

  await Promise.all(
    numericIds.map((id, index) =>
      LeaderSemesterAssignment.update({ sortOrder: index }, { where: { id } })
    )
  );

  return listAdminBySemester(semester);
}

/**
 * 從另一學期複製 Leaders 到新學期
 */
async function copyFromSemester(sourceSemesterId, targetSemesterId) {
  const source = ensureSemesterId(sourceSemesterId);
  const target = ensureSemesterId(targetSemesterId);

  if (source === target) throw httpError(400, '來源與目標學期不能相同');

  const sourceAssignments = await LeaderSemesterAssignment.findAll({
    where: { semesterId: source },
    include: [
      {
        model: LeaderPublicProfile,
        as: 'leader',
        where: { isArchived: false },
        required: true,
      },
    ],
    order: [['sortOrder', 'ASC']],
  });

  const existingTargetIds = await LeaderSemesterAssignment.findAll({
    where: { semesterId: target },
    attributes: ['leaderId'],
  }).then((rows) => new Set(rows.map((r) => r.leaderId)));

  let copied = 0;
  let skipped = 0;

  for (const sa of sourceAssignments) {
    if (existingTargetIds.has(sa.leaderId)) {
      skipped += 1;
      continue;
    }
    await LeaderSemesterAssignment.create({
      leaderId: sa.leaderId,
      semesterId: target,
      isPublished: sa.isPublished,
      sortOrder: sa.sortOrder,
    });
    copied += 1;
  }

  return { copied, skipped, total: sourceAssignments.length };
}

/**
 * 取得可用的學期列表（有指派過的學期 + 當前學期）
 */
async function listAvailableSemesters() {
  const current = getCurrentSemester();

  const usedSemesters = await LeaderSemesterAssignment.findAll({
    attributes: [[LeaderSemesterAssignment.sequelize.fn('DISTINCT', LeaderSemesterAssignment.sequelize.col('semesterId')), 'semesterId']],
    raw: true,
  });

  const semesterSet = new Set(usedSemesters.map((r) => r.semesterId));
  semesterSet.add(current);

  // 排序學期（較新的在前）
  const sorted = Array.from(semesterSet).sort((a, b) => {
    // 例如 '114-2' > '114-1' > '113-2'
    const [ya, sa] = a.split('-').map(Number);
    const [yb, sb] = b.split('-').map(Number);
    if (ya !== yb) return yb - ya;
    return sb - sa;
  });

  return sorted.map((id) => ({
    id,
    label: id,
    isCurrent: id === current,
  }));
}

// ============ 舊版相容（暫時保留） ============

/**
 * @deprecated 改用 reorderInSemester
 */
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
    numericIds.map((id, index) => LeaderPublicProfile.update({ sortOrder: index }, { where: { id } }))
  );
  return listAdmin();
}

module.exports = {
  // 後台列表
  listAdmin,
  listAdminBySemester,
  listArchivedLeaders,
  listAvailableSemesters,
  // 公開列表
  listPublic,
  // Leader CRUD
  createProfile,
  updateProfile,
  deleteProfile,
  // 封存
  archiveProfile,
  unarchiveProfile,
  // 學期指派
  assignToSemester,
  removeFromSemester,
  updateSemesterAssignment,
  reorderInSemester,
  copyFromSemester,
  // 舊版相容
  reorderProfiles,
};
