// services/bestepRankingService.js
const {
  LearningPartnerTeam,
  LearningPartnerTeamMember,
  BestepExamScore,
  BestepAttendance,
  BestepTeamRanking,
  EnglishTestRegistration,
  sequelize
} = require('../models');
const { Op } = require('sequelize');
const { resolveComponentAttended } = require('./bestepClassService');
const { getCefrRank } = require('./learningJourney/utils/cefr');

const ATOMIC_SKILLS = ['L', 'R', 'S', 'W'];
const CEFR_RANK_B1 = 3;
const CEFR_RANK_B2 = 4;

// 積分獎勵（規則 2）
const REWARD_AMOUNTS = {
  1: 5000,
  2: 4000,
  3: 3000,
  4: 2500,
  5: 2000,
  6: 1500,
  11: 1000
};

// 出席獎勵（規則 1）
const ATTENDANCE_INDIVIDUAL_REWARD = 200;
const ATTENDANCE_TEAM_BONUS = 300;

// 個人特別獎勵（規則 3）
const INDIVIDUAL_SPECIAL_REWARD = 5000;

/**
 * 取得積分獎勵金額
 * @param {number} rank - 名次
 * @returns {number} 獎勵金額
 */
function getRewardAmount(rank) {
  if (rank <= 0) return 0;
  if (rank === 1) return REWARD_AMOUNTS[1];
  if (rank === 2) return REWARD_AMOUNTS[2];
  if (rank === 3) return REWARD_AMOUNTS[3];
  if (rank === 4) return REWARD_AMOUNTS[4];
  if (rank === 5) return REWARD_AMOUNTS[5];
  if (rank >= 6 && rank <= 10) return REWARD_AMOUNTS[6];
  if (rank >= 11 && rank <= 20) return REWARD_AMOUNTS[11];
  return 0;
}

function hasAllFourSkillsAttended(attendanceMap) {
  return ATOMIC_SKILLS.every(
    (skill) => resolveComponentAttended(attendanceMap, skill) === true
  );
}

function buildAttendanceMapForStudent(attendanceRecords) {
  const map = {};
  (attendanceRecords || []).forEach((record) => {
    map[record.examType] = { attended: record.attended };
  });
  return map;
}

function buildAttendanceMaps(attendanceRecords) {
  const byStudent = {};
  (attendanceRecords || []).forEach((record) => {
    if (!byStudent[record.studentId]) {
      byStudent[record.studentId] = [];
    }
    byStudent[record.studentId].push(record);
  });

  const maps = {};
  Object.entries(byStudent).forEach(([studentId, records]) => {
    maps[studentId] = buildAttendanceMapForStudent(records);
  });
  return maps;
}

function computeMemberAttendanceRewards(attendanceMap, teamAllAttended) {
  const attendedAllFour = hasAllFourSkillsAttended(attendanceMap);
  const attendanceReward = attendedAllFour ? ATTENDANCE_INDIVIDUAL_REWARD : 0;
  const teamAttendanceBonus = teamAllAttended && attendedAllFour
    ? ATTENDANCE_TEAM_BONUS
    : 0;

  return {
    attendedAllFour,
    attendanceReward,
    teamAttendanceBonus,
    attendanceTotal: attendanceReward + teamAttendanceBonus
  };
}

function isTeamAllMembersAttended(members, attendanceMaps) {
  if (!members?.length) return false;
  return members.every((member) => {
    const map = attendanceMaps[member.studentId] || {};
    return hasAllFourSkillsAttended(map);
  });
}

function normalizeCefrLabel(level) {
  if (level == null || level === '') return '';
  return String(level).trim().toUpperCase().replace(/＋/g, '+');
}

/** 聽、讀：CEFR 達 B1+ 以上（B1+ 或 B2 以上；純 B1 不符合） */
function meetsListeningReadingCefr(level) {
  const label = normalizeCefrLabel(level);
  if (!label) return false;
  if (label === 'B1+') return true;
  const rank = getCefrRank(level);
  return rank != null && rank >= CEFR_RANK_B2;
}

/** 說、寫：CEFR 達 B1 以上 */
function meetsSpeakingWritingCefr(level) {
  const rank = getCefrRank(level);
  return rank != null && rank >= CEFR_RANK_B1;
}

/**
 * 專案參與資格：四項皆出席，且聽讀 B1+、說寫 B1 以上
 */
function isProjectEligibleForIndividualAward(score, attendanceMap) {
  if (!score) return false;
  if (!hasAllFourSkillsAttended(attendanceMap || {})) return false;
  if (!meetsListeningReadingCefr(score.listeningLevel)) return false;
  if (!meetsListeningReadingCefr(score.readingLevel)) return false;
  if (!meetsSpeakingWritingCefr(score.speakingLevel)) return false;
  if (!meetsSpeakingWritingCefr(score.writingLevel)) return false;
  return resolveMemberTotalScore(score) != null;
}

async function loadTeamCompetitionMembers(semester) {
  return LearningPartnerTeamMember.findAll({
    where: {
      activeFlag: 1,
      approvalStatus: 'approved'
    },
    attributes: ['studentId', 'name', 'email', 'personalRegistrationId'],
    include: [{
      model: LearningPartnerTeam,
      as: 'team',
      where: {
        activeFlag: 1,
        status: 'approved'
      },
      required: true,
      attributes: ['id', 'teamName']
    }, {
      model: EnglishTestRegistration,
      as: 'personalRegistration',
      where: { semester },
      required: true,
      attributes: ['id', 'semester']
    }]
  });
}

/**
 * 計算個人特別獎：符合資格且已報名團體賽的學生中，總分最高者
 * @returns {{ winners: Array, isTied: boolean, rewardAmount: number, eligibleCount: number }}
 */
function computeIndividualSpecialAward(scores, options = {}) {
  const {
    nameByStudentId = {},
    eligibleStudentIds = null,
    attendanceMaps = {}
  } = options;
  const candidates = [];

  (scores || []).forEach((score) => {
    if (eligibleStudentIds && !eligibleStudentIds.has(score.studentId)) {
      return;
    }

    const attendanceMap = attendanceMaps[score.studentId] || {};
    if (!isProjectEligibleForIndividualAward(score, attendanceMap)) {
      return;
    }

    const totalScore = resolveMemberTotalScore(score);
    if (totalScore == null) return;
    candidates.push({
      studentId: score.studentId,
      name: nameByStudentId[score.studentId] || score.studentId,
      totalScore: parseFloat(totalScore.toFixed(2))
    });
  });

  if (candidates.length === 0) {
    return {
      winners: [],
      isTied: false,
      rewardAmount: INDIVIDUAL_SPECIAL_REWARD,
      eligibleCount: 0
    };
  }

  const maxScore = Math.max(...candidates.map((c) => c.totalScore));
  const winners = candidates.filter((c) => Math.abs(c.totalScore - maxScore) <= 0.01);

  return {
    winners,
    isTied: winners.length > 1,
    rewardAmount: INDIVIDUAL_SPECIAL_REWARD,
    eligibleCount: candidates.length
  };
}

function enrichMemberWithRewards(member, {
  attendanceMaps,
  teamAllAttended,
  scoreReward,
  individualWinnerIds
}) {
  const attendanceMap = attendanceMaps[member.studentId] || {};
  const attendance = computeMemberAttendanceRewards(attendanceMap, teamAllAttended);
  const individualSpecialReward = individualWinnerIds.has(member.studentId)
    ? INDIVIDUAL_SPECIAL_REWARD
    : 0;

  return {
    ...member,
    ...attendance,
    scoreReward,
    individualSpecialReward,
    totalReward: attendance.attendanceTotal + scoreReward + individualSpecialReward
  };
}

function mapRegistrationContact(reg) {
  if (!reg) return null;
  return {
    idNumber: reg.idNumber || reg.nationalId || '',
    phone: reg.phone || '',
    email: reg.email || ''
  };
}

async function loadStudentContactMap(semester, teams, individualAward) {
  const studentIds = new Set();
  const personalRegistrationIds = new Set();

  teams.forEach((team) => {
    (team.members || []).forEach((member) => {
      studentIds.add(member.studentId);
      if (member.personalRegistrationId) {
        personalRegistrationIds.add(member.personalRegistrationId);
      }
    });
  });

  (individualAward?.winners || []).forEach((winner) => {
    studentIds.add(winner.studentId);
  });

  const contactMap = {};

  if (personalRegistrationIds.size > 0) {
    const byRegistrationId = await EnglishTestRegistration.findAll({
      where: { id: { [Op.in]: [...personalRegistrationIds] } },
      attributes: ['id', 'studentId', 'idNumber', 'nationalId', 'phone', 'email']
    });
    byRegistrationId.forEach((reg) => {
      contactMap[reg.studentId] = mapRegistrationContact(reg);
    });
  }

  const missingStudentIds = [...studentIds].filter((studentId) => !contactMap[studentId]);
  if (missingStudentIds.length > 0) {
    const byStudentSemester = await EnglishTestRegistration.findAll({
      where: {
        studentId: { [Op.in]: missingStudentIds },
        semester
      },
      attributes: ['studentId', 'idNumber', 'nationalId', 'phone', 'email']
    });
    byStudentSemester.forEach((reg) => {
      if (!contactMap[reg.studentId]) {
        contactMap[reg.studentId] = mapRegistrationContact(reg);
      }
    });
  }

  return contactMap;
}

function attachContactInfo(member, contactMap) {
  const contact = contactMap[member.studentId] || {};
  return {
    ...member,
    idNumber: contact.idNumber || '',
    phone: contact.phone || '',
    email: contact.email || member.email || ''
  };
}

function enrichTeamsWithContactInfo(teams, contactMap) {
  return teams.map((team) => ({
    ...team,
    members: (team.members || []).map((member) => attachContactInfo(member, contactMap))
  }));
}

function enrichIndividualAwardWithContact(individualAward, contactMap) {
  if (!individualAward) return individualAward;
  return {
    ...individualAward,
    winners: (individualAward.winners || []).map((winner) => attachContactInfo(winner, contactMap))
  };
}

function enrichTeamsWithRewards(teams, { attendanceMaps, individualAward }) {
  const individualWinnerIds = new Set(
    (individualAward?.winners || []).map((w) => w.studentId)
  );

  return teams.map((team) => {
    const teamAllAttended = isTeamAllMembersAttended(team.members, attendanceMaps);
    const scoreReward = team.rewardAmount || 0;

    const members = (team.members || []).map((member) =>
      enrichMemberWithRewards(member, {
        attendanceMaps,
        teamAllAttended,
        scoreReward,
        individualWinnerIds
      })
    );

    return {
      ...team,
      teamAllAttended,
      members
    };
  });
}

/**
 * 計算團體名次
 * @param {string} semester - 學期
 * @returns {Promise<object>}
 */
async function calculateTeamRanking(semester) {
  const transaction = await sequelize.transaction();

  try {
    const teams = await LearningPartnerTeam.findAll({
      where: {
        status: 'approved',
        activeFlag: 1
      },
      include: [{
        model: LearningPartnerTeamMember,
        as: 'members',
        where: {
          activeFlag: 1,
          approvalStatus: 'approved'
        },
        required: true
      }],
      transaction
    });

    const teamMetrics = [];

    for (const team of teams) {
      const memberStudentIds = team.members.map((m) => m.studentId);

      const scores = await BestepExamScore.findAll({
        where: {
          studentId: { [Op.in]: memberStudentIds },
          semester
        },
        transaction
      });

      const validScores = scores.filter((s) =>
        (s.totalScore !== null && s.totalScore !== undefined) ||
        (s.listeningScore !== null &&
          s.readingScore !== null &&
          s.speakingScore !== null &&
          s.writingScore !== null)
      );

      if (validScores.length === 0) {
        continue;
      }

      const scoreMap = {};
      validScores.forEach((s) => {
        scoreMap[s.studentId] = s;
      });

      const memberScores = team.members
        .map((m) => {
          const score = scoreMap[m.studentId];
          if (!score) return null;
          const totalScore = resolveMemberTotalScore(score);
          if (totalScore == null) return null;
          return {
            studentId: m.studentId,
            name: m.name,
            email: m.email,
            personalRegistrationId: m.personalRegistrationId,
            isRepresentative: m.isRepresentative,
            totalScore: parseFloat(totalScore.toFixed(2)),
            passed: score.passed || false
          };
        })
        .filter((m) => m !== null);

      if (memberScores.length === 0) {
        continue;
      }

      const avgScore = memberScores.reduce((sum, m) => sum + m.totalScore, 0) / memberScores.length;

      teamMetrics.push({
        teamId: team.id,
        teamName: team.teamName || `隊伍${team.id}`,
        avgScore: parseFloat(avgScore.toFixed(2)),
        members: memberScores
      });
    }

    teamMetrics.sort((a, b) => b.avgScore - a.avgScore);

    let currentRank = 1;
    for (let i = 0; i < teamMetrics.length; i++) {
      if (i > 0 && Math.abs(teamMetrics[i].avgScore - teamMetrics[i - 1].avgScore) > 0.01) {
        let tiedCount = 1;
        for (let j = i - 2; j >= 0; j--) {
          if (Math.abs(teamMetrics[j].avgScore - teamMetrics[i - 1].avgScore) <= 0.01) {
            tiedCount++;
          } else {
            break;
          }
        }
        currentRank = currentRank + tiedCount;
      }
      teamMetrics[i].rank = currentRank;
      teamMetrics[i].rewardAmount = getRewardAmount(currentRank);
    }

    const calculatedAt = new Date();
    for (const metric of teamMetrics) {
      await BestepTeamRanking.upsert({
        teamId: metric.teamId,
        semester,
        avgScore: metric.avgScore,
        rank: metric.rank,
        rewardAmount: metric.rewardAmount,
        calculatedAt
      }, {
        transaction
      });
    }

    await transaction.commit();

    return buildRankingResponse(semester, teamMetrics, calculatedAt);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function resolveMemberTotalScore(score) {
  if (!score) return null;
  if (score.totalScore !== null && score.totalScore !== undefined) {
    return parseFloat(score.totalScore);
  }
  const listening = parseFloat(score.listeningScore || 0);
  const reading = parseFloat(score.readingScore || 0);
  const speaking = parseFloat(score.speakingScore || 0);
  const writing = parseFloat(score.writingScore || 0);
  if (
    score.listeningScore === null &&
    score.readingScore === null &&
    score.speakingScore === null &&
    score.writingScore === null
  ) {
    return null;
  }
  return listening + reading + speaking + writing;
}

async function buildRankingResponse(semester, teams, calculatedAt) {
  const teamCompetitionMembers = await loadTeamCompetitionMembers(semester);
  const teamCompetitionStudentIds = new Set(
    teamCompetitionMembers.map((member) => member.studentId)
  );

  const nameByStudentId = {};
  teamCompetitionMembers.forEach((member) => {
    nameByStudentId[member.studentId] = member.name;
  });
  teams.forEach((team) => {
    (team.members || []).forEach((m) => {
      if (!nameByStudentId[m.studentId]) {
        nameByStudentId[m.studentId] = m.name;
      }
    });
  });

  const attendanceStudentIds = [...new Set([
    ...teamCompetitionStudentIds,
    ...teams.flatMap((team) => (team.members || []).map((m) => m.studentId))
  ])];

  const [allSemesterScores, attendanceRecords] = await Promise.all([
    teamCompetitionStudentIds.size > 0
      ? BestepExamScore.findAll({
        where: {
          semester,
          studentId: { [Op.in]: [...teamCompetitionStudentIds] }
        }
      })
      : [],
    attendanceStudentIds.length > 0
      ? BestepAttendance.findAll({
        where: {
          studentId: { [Op.in]: attendanceStudentIds },
          semester
        }
      })
      : []
  ]);

  const attendanceMaps = buildAttendanceMaps(attendanceRecords);
  const individualAward = computeIndividualSpecialAward(allSemesterScores, {
    nameByStudentId,
    eligibleStudentIds: teamCompetitionStudentIds,
    attendanceMaps
  });
  const enrichedTeams = enrichTeamsWithRewards(teams, { attendanceMaps, individualAward });
  const contactMap = await loadStudentContactMap(semester, enrichedTeams, individualAward);

  return {
    semester,
    teams: enrichTeamsWithContactInfo(enrichedTeams, contactMap),
    individualAward: enrichIndividualAwardWithContact(individualAward, contactMap),
    calculatedAt
  };
}

async function getTeamRanking(semester) {
  const rankings = await BestepTeamRanking.findAll({
    where: { semester },
    include: [{
      model: LearningPartnerTeam,
      as: 'team',
      include: [{
        model: LearningPartnerTeamMember,
        as: 'members',
        where: {
          activeFlag: 1,
          approvalStatus: 'approved'
        },
        required: false
      }]
    }],
    order: [['rank', 'ASC'], ['avgScore', 'DESC']]
  });

  const studentIds = [];
  rankings.forEach((r) => {
    (r.team?.members || []).forEach((m) => studentIds.push(m.studentId));
  });

  const scores = studentIds.length > 0
    ? await BestepExamScore.findAll({
      where: {
        studentId: { [Op.in]: [...new Set(studentIds)] },
        semester
      }
    })
    : [];

  const scoreMap = {};
  scores.forEach((s) => {
    scoreMap[s.studentId] = s;
  });

  let latestCalculatedAt = null;

  const teams = rankings.map((r) => {
    if (r.calculatedAt && (!latestCalculatedAt || r.calculatedAt > latestCalculatedAt)) {
      latestCalculatedAt = r.calculatedAt;
    }

    const members = (r.team?.members || []).map((m) => {
      const score = scoreMap[m.studentId];
      const totalScore = resolveMemberTotalScore(score);
      return {
        studentId: m.studentId,
        name: m.name,
        email: m.email,
        personalRegistrationId: m.personalRegistrationId,
        isRepresentative: m.isRepresentative,
        totalScore: totalScore != null ? parseFloat(totalScore.toFixed(2)) : null,
        passed: score?.passed || false
      };
    });

    return {
      teamId: r.teamId,
      teamName: r.team?.teamName || `隊伍${r.teamId}`,
      avgScore: parseFloat(r.avgScore),
      rank: r.rank,
      rewardAmount: r.rewardAmount,
      calculatedAt: r.calculatedAt,
      members
    };
  });

  const response = await buildRankingResponse(semester, teams, latestCalculatedAt);

  return {
    semester: response.semester,
    teams: response.teams,
    individualAward: response.individualAward,
    calculatedAt: latestCalculatedAt
  };
}

module.exports = {
  calculateTeamRanking,
  getTeamRanking,
  getRewardAmount,
  hasAllFourSkillsAttended,
  computeMemberAttendanceRewards,
  computeIndividualSpecialAward,
  isTeamAllMembersAttended,
  isProjectEligibleForIndividualAward,
  meetsListeningReadingCefr,
  meetsSpeakingWritingCefr,
  resolveMemberTotalScore,
  ATTENDANCE_INDIVIDUAL_REWARD,
  ATTENDANCE_TEAM_BONUS,
  INDIVIDUAL_SPECIAL_REWARD
};
