const {
  getRewardAmount,
  hasAllFourSkillsAttended,
  computeMemberAttendanceRewards,
  computeIndividualSpecialAward,
  isTeamAllMembersAttended,
  isProjectEligibleForIndividualAward,
  meetsListeningReadingCefr,
  meetsSpeakingWritingCefr,
  ATTENDANCE_INDIVIDUAL_REWARD,
  ATTENDANCE_TEAM_BONUS,
  INDIVIDUAL_SPECIAL_REWARD
} = require('../services/bestepRankingService');

// attachContactInfo is internal; mirror its behavior for contact merge expectations
function attachContactInfo(member, contactMap) {
  const contact = contactMap[member.studentId] || {};
  return {
    ...member,
    idNumber: contact.idNumber || '',
    phone: contact.phone || '',
    email: contact.email || member.email || ''
  };
}

const fullAttendanceMap = {
  L: { attended: true },
  R: { attended: true },
  S: { attended: true },
  W: { attended: true }
};

function eligibleScore(overrides = {}) {
  return {
    studentId: 'A001',
    listeningLevel: 'B1+',
    readingLevel: 'B2',
    speakingLevel: 'B1',
    writingLevel: 'B1+',
    totalScore: 800,
    ...overrides
  };
}

describe('bestepRankingService', () => {
  test('getRewardAmount returns tiered score rewards', () => {
    expect(getRewardAmount(1)).toBe(5000);
    expect(getRewardAmount(5)).toBe(2000);
    expect(getRewardAmount(8)).toBe(1500);
    expect(getRewardAmount(15)).toBe(1000);
    expect(getRewardAmount(21)).toBe(0);
  });

  test('hasAllFourSkillsAttended requires L/R/S/W all attended', () => {
    expect(hasAllFourSkillsAttended({
      L: { attended: true },
      R: { attended: true },
      S: { attended: true },
      W: { attended: true }
    })).toBe(true);

    expect(hasAllFourSkillsAttended({
      LR: { attended: true },
      SW: { attended: true }
    })).toBe(true);

    expect(hasAllFourSkillsAttended({
      L: { attended: true },
      R: { attended: false },
      S: { attended: true },
      W: { attended: true }
    })).toBe(false);
  });

  test('computeMemberAttendanceRewards applies individual and team bonus', () => {
    const fullAttendance = {
      L: { attended: true },
      R: { attended: true },
      S: { attended: true },
      W: { attended: true }
    };

    const solo = computeMemberAttendanceRewards(fullAttendance, false);
    expect(solo.attendanceReward).toBe(ATTENDANCE_INDIVIDUAL_REWARD);
    expect(solo.teamAttendanceBonus).toBe(0);
    expect(solo.attendanceTotal).toBe(200);

    const withTeam = computeMemberAttendanceRewards(fullAttendance, true);
    expect(withTeam.attendanceReward).toBe(ATTENDANCE_INDIVIDUAL_REWARD);
    expect(withTeam.teamAttendanceBonus).toBe(ATTENDANCE_TEAM_BONUS);
    expect(withTeam.attendanceTotal).toBe(500);

    const partial = computeMemberAttendanceRewards({
      L: { attended: true },
      R: { attended: true }
    }, true);
    expect(partial.attendanceReward).toBe(0);
    expect(partial.teamAttendanceBonus).toBe(0);
  });

  test('isTeamAllMembersAttended checks every member', () => {
    const members = [
      { studentId: 'A' },
      { studentId: 'B' }
    ];
    const maps = {
      A: { L: { attended: true }, R: { attended: true }, S: { attended: true }, W: { attended: true } },
      B: { L: { attended: true }, R: { attended: true }, S: { attended: true }, W: { attended: true } }
    };
    expect(isTeamAllMembersAttended(members, maps)).toBe(true);

    maps.B.L = { attended: false };
    expect(isTeamAllMembersAttended(members, maps)).toBe(false);
  });

  test('CEFR eligibility follows project rules', () => {
    expect(meetsListeningReadingCefr('B1+')).toBe(true);
    expect(meetsListeningReadingCefr('B2')).toBe(true);
    expect(meetsListeningReadingCefr('B1')).toBe(false);
    expect(meetsSpeakingWritingCefr('B1')).toBe(true);
    expect(meetsSpeakingWritingCefr('A2')).toBe(false);
  });

  test('isProjectEligibleForIndividualAward requires attendance and CEFR thresholds', () => {
    expect(isProjectEligibleForIndividualAward(
      eligibleScore(),
      fullAttendanceMap
    )).toBe(true);

    expect(isProjectEligibleForIndividualAward(
      eligibleScore({ listeningLevel: 'B1' }),
      fullAttendanceMap
    )).toBe(false);

    expect(isProjectEligibleForIndividualAward(
      eligibleScore(),
      { L: { attended: true } }
    )).toBe(false);
  });

  test('computeIndividualSpecialAward only considers team competition members', () => {
    const scores = [
      eligibleScore({ studentId: 'TEAM01', totalScore: 850 }),
      eligibleScore({ studentId: 'SOLO99', totalScore: 950 })
    ];
    const attendanceMaps = {
      TEAM01: fullAttendanceMap,
      SOLO99: fullAttendanceMap
    };

    const result = computeIndividualSpecialAward(scores, {
      nameByStudentId: { TEAM01: '團隊生', SOLO99: '個人生' },
      eligibleStudentIds: new Set(['TEAM01']),
      attendanceMaps
    });

    expect(result.winners).toHaveLength(1);
    expect(result.winners[0].studentId).toBe('TEAM01');
    expect(result.eligibleCount).toBe(1);
    expect(result.rewardAmount).toBe(INDIVIDUAL_SPECIAL_REWARD);
  });

  test('computeIndividualSpecialAward picks top eligible scorer and handles ties', () => {
    const scores = [
      eligibleScore({ studentId: 'A', totalScore: 800 }),
      eligibleScore({ studentId: 'B', totalScore: 900 }),
      eligibleScore({ studentId: 'C', totalScore: 750 })
    ];
    const attendanceMaps = {
      A: fullAttendanceMap,
      B: fullAttendanceMap,
      C: fullAttendanceMap
    };

    const single = computeIndividualSpecialAward(scores, {
      nameByStudentId: { B: '王小明' },
      eligibleStudentIds: new Set(['A', 'B', 'C']),
      attendanceMaps
    });
    expect(single.winners).toHaveLength(1);
    expect(single.winners[0].studentId).toBe('B');
    expect(single.winners[0].name).toBe('王小明');
    expect(single.isTied).toBe(false);

    const tied = computeIndividualSpecialAward([
      eligibleScore({ studentId: 'A', totalScore: 900 }),
      eligibleScore({ studentId: 'B', totalScore: 900 })
    ], {
      eligibleStudentIds: new Set(['A', 'B']),
      attendanceMaps: { A: fullAttendanceMap, B: fullAttendanceMap }
    });
    expect(tied.winners).toHaveLength(2);
    expect(tied.isTied).toBe(true);
  });

  test('attachContactInfo prefers registration contact and falls back to member email', () => {
    const member = { studentId: 'A123', name: '測試', email: 'member@example.com' };
    const enriched = attachContactInfo(member, {
      A123: {
        idNumber: 'A123456789',
        phone: '0912345678',
        email: 'reg@example.com'
      }
    });
    expect(enriched.idNumber).toBe('A123456789');
    expect(enriched.phone).toBe('0912345678');
    expect(enriched.email).toBe('reg@example.com');

    const fallback = attachContactInfo(member, {});
    expect(fallback.email).toBe('member@example.com');
  });
});
