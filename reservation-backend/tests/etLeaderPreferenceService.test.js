'use strict';

jest.mock('../models', () => ({
  EtLeaderPreference: {
    findAll: jest.fn(),
    findOrCreate: jest.fn(),
  },
  Teacher: {
    findByPk: jest.fn(),
  },
  Event: {
    findByPk: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn(),
  },
}));

jest.mock('../services/etGrouping/etLeaderService', () => ({
  assignGroupLeaders: jest.fn(),
}));

const {
  EtLeaderPreference,
  Teacher,
  Event,
  sequelize,
} = require('../models');
const { assignGroupLeaders } = require('../services/etGrouping/etLeaderService');
const {
  buildPreferenceAssignmentsForEvent,
  rememberAssignmentsAsPreferences,
  applyPreferencesToEvents,
} = require('../services/etGrouping/etLeaderPreferenceService');

describe('etLeaderPreferenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('buildPreferenceAssignmentsForEvent returns assignments for saved group labels', async () => {
    EtLeaderPreference.findAll.mockResolvedValue([
      { groupLabel: 'Group 1', leaderTeacherId: 11, leader: { name: 'A' } },
      { groupLabel: 'Group 2', leaderTeacherId: 22, leader: { name: 'B' } },
    ]);
    const event = { semesterId: 5, groupCount: 2, perGroupCapacity: 4, maxCapacity: 8 };
    const assignments = await buildPreferenceAssignmentsForEvent(event);
    expect(assignments).toEqual([
      { groupLabel: 'Group 1', leaderTeacherId: 11 },
      { groupLabel: 'Group 2', leaderTeacherId: 22 },
    ]);
  });

  test('rememberAssignmentsAsPreferences upserts preference rows', async () => {
    const transaction = { commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(transaction);
    const row = { update: jest.fn().mockResolvedValue(undefined) };
    EtLeaderPreference.findOrCreate.mockResolvedValue([row, true]);
    await rememberAssignmentsAsPreferences(
      { semesterId: 2 },
      [{ groupLabel: 'Group 1', leaderTeacherId: 7 }]
    );
    expect(EtLeaderPreference.findOrCreate).toHaveBeenCalledWith({
      where: { semesterId: 2, groupLabel: 'Group 1' },
      defaults: { semesterId: 2, groupLabel: 'Group 1', leaderTeacherId: 7 },
      transaction,
    });
    expect(row.update).toHaveBeenCalledWith({ leaderTeacherId: 7 }, { transaction });
    expect(transaction.commit).toHaveBeenCalled();
    expect(Teacher.findByPk).not.toHaveBeenCalled();
    expect(assignGroupLeaders).not.toHaveBeenCalled();
  });

  test('applyPreferencesToEvents applies to multiple events and collects errors', async () => {
    EtLeaderPreference.findAll.mockResolvedValue([
      { groupLabel: 'Group 1', leaderTeacherId: 11, leader: { name: 'A' } },
    ]);
    Event.findByPk
      .mockResolvedValueOnce({ id: 1, semesterId: null, groupCount: 1, perGroupCapacity: 4, maxCapacity: 4 })
      .mockResolvedValueOnce(null);
    assignGroupLeaders.mockResolvedValue([{ groupLabel: 'Group 1', leaderTeacherId: 11 }]);

    const result = await applyPreferencesToEvents([1, 2], { userId: 9 });
    expect(assignGroupLeaders).toHaveBeenCalledTimes(1);
    expect(result.applied).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].eventId).toBe(2);
  });
});
