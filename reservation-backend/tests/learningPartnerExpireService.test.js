jest.mock('../models', () => ({
  LearningPartnerTeam: { findAll: jest.fn(), update: jest.fn() },
  LearningPartnerTeamMember: { update: jest.fn() },
  sequelize: { transaction: jest.fn() },
}));

jest.mock('../utils/emailQueue', () => ({
  enqueue: jest.fn(),
}));

const { LearningPartnerTeam, LearningPartnerTeamMember, sequelize } = require('../models');
const emailQueue = require('../utils/emailQueue');
const { expirePendingLearningPartnerTeams } = require('../services/learningPartnerExpireService');

describe('learningPartnerExpireService', () => {
  const transaction = { commit: jest.fn(), rollback: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockResolvedValue(transaction);
    emailQueue.enqueue.mockResolvedValue(1);
  });

  test('expires overdue pending teams and queues the existing notice', async () => {
    LearningPartnerTeam.findAll.mockResolvedValue([
      {
        id: 9,
        teamName: 'A',
        members: [
          { email: 'a@example.com', name: 'Ann', studentId: 'B1', approvalStatus: 'pending' },
          { email: '', name: 'NoMail', studentId: 'B2', approvalStatus: 'pending' },
        ],
      },
    ]);
    LearningPartnerTeam.update.mockResolvedValue([1]);
    LearningPartnerTeamMember.update.mockResolvedValue([1]);

    const result = await expirePendingLearningPartnerTeams(new Date('2026-11-18T12:00:00Z'));

    expect(result).toEqual({ expired: 1, notified: 1 });
    expect(LearningPartnerTeam.update).toHaveBeenCalledWith(
      { status: 'expired', activeFlag: 0 },
      expect.objectContaining({ where: { id: 9, status: 'pending_approval' } })
    );
    expect(emailQueue.enqueue).toHaveBeenCalledWith(
      'learningPartnerExpired',
      expect.objectContaining({ email: 'a@example.com', teamId: 9 }),
      expect.objectContaining({ relatedEntityType: 'LearningPartnerTeam', relatedEntityId: '9' })
    );
    expect(transaction.commit).toHaveBeenCalled();
  });

  test('does not email when the status update lost the race', async () => {
    LearningPartnerTeam.findAll.mockResolvedValue([{ id: 3, members: [{ email: 'a@example.com' }] }]);
    LearningPartnerTeam.update.mockResolvedValue([0]);

    const result = await expirePendingLearningPartnerTeams();

    expect(result).toEqual({ expired: 0, notified: 0 });
    expect(transaction.rollback).toHaveBeenCalled();
    expect(emailQueue.enqueue).not.toHaveBeenCalled();
  });
});
