'use strict';

jest.mock('../models', () => ({
  Event: { findByPk: jest.fn() },
  Teacher: { findAll: jest.fn(), findByPk: jest.fn() },
  EtEventGroupLeader: { findOrCreate: jest.fn(), findAll: jest.fn() },
  EtEventGroupAssignment: { update: jest.fn() },
  sequelize: { transaction: jest.fn() },
}));

const { Teacher } = require('../models');
const { listLeaderCandidates } = require('../services/etGrouping/etLeaderService');

describe('etLeaderService.listLeaderCandidates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns only active leader role accounts', async () => {
    Teacher.findAll.mockResolvedValue([
      { id: 1, name: 'Amy', email: 'a@test', role: 'leader', studentId: 'B123' },
    ]);
    const rows = await listLeaderCandidates();
    expect(Teacher.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, role: 'leader' },
    }));
    expect(rows).toEqual([
      { id: 1, name: 'Amy', email: 'a@test', role: 'leader', studentId: 'B123' },
    ]);
  });
});
