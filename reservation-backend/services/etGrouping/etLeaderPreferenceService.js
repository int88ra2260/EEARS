'use strict';

const { EtLeaderPreference, Teacher, sequelize } = require('../../models');
const { resolveLegacyGroupCount } = require('../../utils/eventCapacity');
const { buildPhysicalGroupLabel } = require('./etPhysicalGroupAssignment');
const { assignGroupLeaders } = require('./etLeaderService');

async function listPreferences({ semesterId = null } = {}) {
  const where = {};
  if (semesterId != null) {
    where.semesterId = semesterId;
  } else {
    where.semesterId = null;
  }
  let rows = await EtLeaderPreference.findAll({
    where,
    include: [{ model: Teacher, as: 'leader', attributes: ['id', 'name'], required: false }],
    order: [['groupLabel', 'ASC']],
  });
  if (!rows.length && semesterId != null) {
    rows = await EtLeaderPreference.findAll({
      where: { semesterId: null },
      include: [{ model: Teacher, as: 'leader', attributes: ['id', 'name'], required: false }],
      order: [['groupLabel', 'ASC']],
    });
  }
  return rows.map((row) => ({
    id: row.id,
    semesterId: row.semesterId,
    groupLabel: row.groupLabel,
    leaderTeacherId: row.leaderTeacherId,
    leaderName: row.leader?.name || null,
  }));
}

async function upsertPreferences(preferences = [], { semesterId = null } = {}) {
  if (!Array.isArray(preferences) || !preferences.length) {
    throw new Error('請提供至少一筆 Leader 偏好');
  }
  const transaction = await sequelize.transaction();
  try {
    for (const item of preferences) {
      const groupLabel = String(item.groupLabel || '').trim();
      const leaderTeacherId = Number(item.leaderTeacherId);
      if (!groupLabel || !leaderTeacherId) continue;
      const teacher = await Teacher.findByPk(leaderTeacherId, { transaction });
      if (!teacher || teacher.isActive === false) {
        throw Object.assign(new Error(`Leader 帳號不存在或已停用（${leaderTeacherId}）`), { status: 400 });
      }
      const [row] = await EtLeaderPreference.findOrCreate({
        where: { semesterId, groupLabel },
        defaults: { semesterId, groupLabel, leaderTeacherId },
        transaction,
      });
      await row.update({ leaderTeacherId }, { transaction });
    }
    await transaction.commit();
    return listPreferences({ semesterId });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function rememberAssignmentsAsPreferences(event, assignments = []) {
  if (!event || !assignments.length) return;
  const semesterId = event.semesterId ?? null;
  const transaction = await sequelize.transaction();
  try {
    for (const item of assignments) {
      const groupLabel = String(item.groupLabel || '').trim();
      const leaderTeacherId = item.leaderTeacherId ? Number(item.leaderTeacherId) : null;
      if (!groupLabel || !leaderTeacherId) continue;
      const [row] = await EtLeaderPreference.findOrCreate({
        where: { semesterId, groupLabel },
        defaults: { semesterId, groupLabel, leaderTeacherId },
        transaction,
      });
      await row.update({ leaderTeacherId }, { transaction });
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function buildPreferenceAssignmentsForEvent(event) {
  const groupCount = resolveLegacyGroupCount(event);
  const prefs = await listPreferences({ semesterId: event.semesterId });
  const prefMap = new Map(prefs.map((p) => [p.groupLabel, p.leaderTeacherId]));
  const assignments = [];
  for (let i = 1; i <= groupCount; i += 1) {
    const groupLabel = buildPhysicalGroupLabel(i);
    const leaderTeacherId = prefMap.get(groupLabel);
    if (leaderTeacherId) {
      assignments.push({ groupLabel, leaderTeacherId });
    }
  }
  return assignments;
}

async function applyPreferencesToEvent(eventId, { userId, remember = false } = {}) {
  const { Event } = require('../../models');
  const event = await Event.findByPk(eventId);
  if (!event) throw Object.assign(new Error('活動不存在'), { status: 404 });
  const assignments = await buildPreferenceAssignmentsForEvent(event);
  if (!assignments.length) {
    throw Object.assign(new Error('尚無可套用的學期 Leader 偏好'), { status: 400 });
  }
  const result = await assignGroupLeaders(eventId, assignments, { userId });
  if (remember) {
    await rememberAssignmentsAsPreferences(event, assignments);
  }
  return result;
}

async function applyPreferencesToEvents(eventIds = [], { userId } = {}) {
  if (!Array.isArray(eventIds) || !eventIds.length) {
    throw Object.assign(new Error('請選擇至少一場活動'), { status: 400 });
  }
  const applied = [];
  const errors = [];
  for (const rawId of eventIds) {
    const eventId = Number(rawId);
    if (!Number.isFinite(eventId) || eventId <= 0) continue;
    try {
      const data = await applyPreferencesToEvent(eventId, { userId });
      applied.push({ eventId, leaders: data });
    } catch (err) {
      errors.push({
        eventId,
        message: err.message || '套用失敗',
        code: err.code || null,
      });
    }
  }
  if (!applied.length && errors.length) {
    throw Object.assign(new Error(errors[0].message || '批次套用失敗'), {
      status: 400,
      code: 'BATCH_APPLY_FAILED',
      errors,
    });
  }
  return { applied, errors };
}

module.exports = {
  listPreferences,
  upsertPreferences,
  rememberAssignmentsAsPreferences,
  buildPreferenceAssignmentsForEvent,
  applyPreferencesToEvent,
  applyPreferencesToEvents,
};
