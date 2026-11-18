const { Op } = require('sequelize');
const { LearningPartnerTeam, LearningPartnerTeamMember, sequelize } = require('../models');
const emailQueue = require('../utils/emailQueue');

/**
 * 將超過 expiresAt、仍在等待全員同意的學習有伴團體標成失效，並寄出既有失效信。
 * 不記錄信箱、姓名或同意 token。
 */
async function expirePendingLearningPartnerTeams(now = new Date()) {
  const teams = await LearningPartnerTeam.findAll({
    where: {
      status: 'pending_approval',
      expiresAt: { [Op.lt]: now },
    },
    include: [{ model: LearningPartnerTeamMember, as: 'members' }],
  });

  let expired = 0;
  let notified = 0;

  for (const team of teams) {
    const transaction = await sequelize.transaction();
    try {
      const [updated] = await LearningPartnerTeam.update({
        status: 'expired',
        activeFlag: 0,
      }, {
        where: { id: team.id, status: 'pending_approval' },
        transaction,
      });
      if (!updated) {
        await transaction.rollback();
        continue;
      }
      await LearningPartnerTeamMember.update(
        { activeFlag: 0 },
        { where: { teamId: team.id }, transaction }
      );
      await LearningPartnerTeamMember.update(
        { approvalStatus: 'expired', approvalToken: null },
        { where: { teamId: team.id, approvalStatus: 'pending' }, transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('[learningPartnerExpire] 更新團體狀態失敗');
      continue;
    }

    expired += 1;
    const members = Array.isArray(team.members) ? team.members : [];
    for (const member of members) {
      const email = member && member.email ? String(member.email).trim() : '';
      if (!email) continue;
      try {
        await emailQueue.enqueue('learningPartnerExpired', {
          email,
          name: member.name || '',
          studentId: member.studentId || '',
          teamId: team.id,
          teamName: team.teamName || '',
        }, {
          relatedEntityType: 'LearningPartnerTeam',
          relatedEntityId: String(team.id),
        });
        notified += 1;
      } catch (error) {
        console.error('[learningPartnerExpire] 失效信排入失敗');
      }
    }
  }

  return { expired, notified };
}

module.exports = {
  expirePendingLearningPartnerTeams,
};
