const {
  computeLearningPartnerFunnel,
  hoursBetween,
  median,
} = require('../services/learningPartnerFunnelService');

describe('learningPartnerFunnelService', () => {
  test('hoursBetween / median helpers', () => {
    expect(hoursBetween('2026-03-01T00:00:00Z', '2026-03-01T12:00:00Z')).toBe(12);
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  test('computeLearningPartnerFunnel aggregates team and member funnel', () => {
    const created = new Date('2026-03-01T00:00:00Z');
    const approvedAt = new Date('2026-03-01T10:00:00Z');

    const result = computeLearningPartnerFunnel({
      semester: '114-2',
      quotaLimit: 50,
      teams: [
        {
          id: 1,
          status: 'approved',
          teamSize: 3,
          createdAt: created,
          approvedAt,
        },
        {
          id: 2,
          status: 'pending_approval',
          teamSize: 4,
          createdAt: created,
          approvedAt: null,
        },
        {
          id: 3,
          status: 'expired',
          teamSize: 3,
          createdAt: created,
          approvedAt: null,
        },
      ],
      members: [
        { approvalStatus: 'approved', isRepresentative: true },
        { approvalStatus: 'approved', isRepresentative: false },
        { approvalStatus: 'approved', isRepresentative: false },
        { approvalStatus: 'approved', isRepresentative: true },
        { approvalStatus: 'pending', isRepresentative: false },
        { approvalStatus: 'pending', isRepresentative: false },
        { approvalStatus: 'pending', isRepresentative: false },
        { approvalStatus: 'expired', isRepresentative: true },
        { approvalStatus: 'expired', isRepresentative: false },
        { approvalStatus: 'expired', isRepresentative: false },
      ],
    });

    expect(result.semester).toBe('114-2');
    expect(result.teams.total).toBe(3);
    expect(result.teams.byStatus).toEqual({
      pending_approval: 1,
      approved: 1,
      expired: 1,
      cancelled: 0,
    });
    expect(result.teams.byTeamSize).toEqual({ 3: 2, 4: 1 });
    expect(result.teams.approvalRatePct).toBe(33.3);
    expect(result.teams.dropOffRatePct).toBe(33.3);

    expect(result.members.total).toBe(10);
    expect(result.members.byApprovalStatus).toEqual({
      pending: 3,
      approved: 4,
      expired: 3,
    });
    expect(result.members.approvalRatePct).toBe(40);
    expect(result.members.inviteeApprovalRatePct).toBe(28.6);

    expect(result.timing.approvedTeamCount).toBe(1);
    expect(result.timing.avgHoursToFullApproval).toBe(10);
    expect(result.timing.medianHoursToFullApproval).toBe(10);

    expect(result.quota).toEqual({
      limit: 50,
      occupiedActiveSeats: 2,
      remainingSeats: 48,
      occupancyRatePct: 4,
    });
  });

  test('empty semester returns zeroed funnel', () => {
    const result = computeLearningPartnerFunnel({
      semester: '114-1',
      quotaLimit: 50,
      teams: [],
      members: [],
    });
    expect(result.teams.total).toBe(0);
    expect(result.teams.approvalRatePct).toBeNull();
    expect(result.members.approvalRatePct).toBeNull();
    expect(result.timing.avgHoursToFullApproval).toBeNull();
  });
});
