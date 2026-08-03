'use strict';

const {
  Event,
  Teacher,
  EtEventGroupLeader,
  EtEventGroupAssignment,
  sequelize,
} = require('../../models');

async function listLeaderCandidates() {
  const teachers = await Teacher.findAll({
    where: {
      isActive: true,
      role: 'leader',
    },
    attributes: ['id', 'name', 'email', 'role', 'studentId'],
    order: [['name', 'ASC'], ['id', 'ASC']],
  });
  return teachers.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    role: t.role,
    studentId: t.studentId || null,
  }));
}

async function listGroupLeaders(eventId) {
  const rows = await EtEventGroupLeader.findAll({
    where: { eventId },
    include: [{ model: Teacher, as: 'leader', attributes: ['id', 'name'], required: false }],
    order: [['groupLabel', 'ASC']],
  });
  return rows.map((row) => ({
    id: row.id,
    groupLabel: row.groupLabel,
    leaderTeacherId: row.leaderTeacherId,
    leaderName: row.leader?.name || null,
  }));
}

async function syncLeaderToAssignments(eventId, groupLabel, leaderTeacherId, { transaction } = {}) {
  await EtEventGroupAssignment.update(
    { leaderTeacherId: leaderTeacherId || null },
    { where: { eventId, groupLabel }, transaction }
  );
}

async function assignGroupLeaders(eventId, assignments = [], { userId: _userId } = {}) {
  const event = await Event.findByPk(eventId);
  if (!event) throw Object.assign(new Error('活動不存在'), { status: 404 });
  if ((event.eventType || 'English Table') !== 'English Table') {
    throw Object.assign(new Error('僅 English Table 活動支援 Leader 指派'), { status: 400 });
  }
  if (!Array.isArray(assignments) || !assignments.length) {
    throw new Error('請提供至少一筆 Leader 指派');
  }

  const transaction = await sequelize.transaction();
  try {
    for (const item of assignments) {
      const groupLabel = String(item.groupLabel || '').trim();
      if (!groupLabel) continue;
      const leaderTeacherId = item.leaderTeacherId ? Number(item.leaderTeacherId) : null;

      if (leaderTeacherId) {
        const teacher = await Teacher.findByPk(leaderTeacherId, { transaction });
        if (!teacher || teacher.isActive === false) {
          throw Object.assign(new Error(`Leader 帳號不存在或已停用（${leaderTeacherId}）`), { status: 400 });
        }
      }

      const [row] = await EtEventGroupLeader.findOrCreate({
        where: { eventId, groupLabel },
        defaults: { eventId, groupLabel, leaderTeacherId },
        transaction,
      });
      await row.update({ leaderTeacherId }, { transaction });
      await syncLeaderToAssignments(eventId, groupLabel, leaderTeacherId, { transaction });
    }
    await transaction.commit();
    return listGroupLeaders(eventId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getLeaderGroupLabels(eventId, teacherId) {
  if (!teacherId) return [];
  const rows = await EtEventGroupLeader.findAll({
    where: { eventId, leaderTeacherId: teacherId },
    attributes: ['groupLabel'],
  });
  return rows.map((row) => row.groupLabel);
}

async function assertCanAccessGroup({
  eventId,
  teacherId,
  groupLabel,
  canManage,
}) {
  if (canManage) return true;
  const labels = await getLeaderGroupLabels(eventId, teacherId);
  return labels.includes(groupLabel);
}

async function listMyLeaderSessions(teacherId, filters = {}) {
  const etGroupingReportService = require('./etGroupingReportService');
  return etGroupingReportService.listMyLeaderSessions(teacherId, filters);
}

module.exports = {
  listLeaderCandidates,
  listGroupLeaders,
  assignGroupLeaders,
  getLeaderGroupLabels,
  assertCanAccessGroup,
  syncLeaderToAssignments,
  listMyLeaderSessions,
};
