/**
 * 學習有伴：單次考試（學期）營運漏斗成效
 * 範圍依成員個人報名 semester 歸屬；含已失效／已取消團體。
 */

const { QueryTypes } = require('sequelize');
const { Settings, sequelize } = require('../models');

const TEAM_STATUSES = ['pending_approval', 'approved', 'expired', 'cancelled'];
const MEMBER_STATUSES = ['pending', 'approved', 'expired'];

function toRate(numerator, denominator) {
  if (!denominator) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function hoursBetween(start, end) {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / (1000 * 60 * 60);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Number((((sorted[mid - 1] + sorted[mid]) / 2)).toFixed(2));
  }
  return Number(sorted[mid].toFixed(2));
}

function emptyStatusCounts(keys) {
  return Object.fromEntries(keys.map((k) => [k, 0]));
}

/**
 * 純函式：由隊伍／成員列計算漏斗（便於單元測試）
 * @param {{ teams: Array, members: Array, quotaLimit: number, semester: string }} input
 */
function computeLearningPartnerFunnel({ teams, members, quotaLimit, semester }) {
  const byStatus = emptyStatusCounts(TEAM_STATUSES);
  const byTeamSize = { 3: 0, 4: 0 };
  const approvalHours = [];

  for (const team of teams) {
    const status = TEAM_STATUSES.includes(team.status) ? team.status : null;
    if (status) byStatus[status] += 1;

    const size = Number(team.teamSize);
    if (size === 3 || size === 4) byTeamSize[size] += 1;

    if (team.status === 'approved') {
      const hours = hoursBetween(team.createdAt, team.approvedAt);
      if (hours != null) approvalHours.push(hours);
    }
  }

  const memberByStatus = emptyStatusCounts(MEMBER_STATUSES);
  let representativeApproved = 0;
  let representativeTotal = 0;
  let nonRepresentativeApproved = 0;
  let nonRepresentativeTotal = 0;

  for (const member of members) {
    const status = MEMBER_STATUSES.includes(member.approvalStatus) ? member.approvalStatus : null;
    if (status) memberByStatus[status] += 1;

    const isRep = Boolean(member.isRepresentative);
    if (isRep) {
      representativeTotal += 1;
      if (member.approvalStatus === 'approved') representativeApproved += 1;
    } else {
      nonRepresentativeTotal += 1;
      if (member.approvalStatus === 'approved') nonRepresentativeApproved += 1;
    }
  }

  const teamTotal = teams.length;
  const memberTotal = members.length;
  const approvedTeams = byStatus.approved;
  const activeSeatCount = byStatus.pending_approval + byStatus.approved;

  return {
    semester,
    scope: {
      note: '依成員個人報名學期歸屬統計；含已失效／已取消。名額為全站上限（非單次考試獨立額度）。',
      teamCount: teamTotal,
      memberCount: memberTotal,
    },
    teams: {
      total: teamTotal,
      byStatus,
      approvalRatePct: toRate(approvedTeams, teamTotal),
      dropOffRatePct: toRate(byStatus.expired + byStatus.cancelled, teamTotal),
      byTeamSize,
    },
    members: {
      total: memberTotal,
      byApprovalStatus: memberByStatus,
      approvalRatePct: toRate(memberByStatus.approved, memberTotal),
      representativeApprovalRatePct: toRate(representativeApproved, representativeTotal),
      inviteeApprovalRatePct: toRate(nonRepresentativeApproved, nonRepresentativeTotal),
    },
    timing: {
      approvedTeamCount: approvalHours.length,
      avgHoursToFullApproval: approvalHours.length
        ? Number((approvalHours.reduce((s, h) => s + h, 0) / approvalHours.length).toFixed(2))
        : null,
      medianHoursToFullApproval: median(approvalHours),
    },
    quota: {
      limit: quotaLimit,
      occupiedActiveSeats: activeSeatCount,
      remainingSeats: Math.max(0, quotaLimit - activeSeatCount),
      occupancyRatePct: toRate(activeSeatCount, quotaLimit),
    },
  };
}

async function getQuotaLimit() {
  const setting = await Settings.findOne({ where: { key: 'learning_partner_quota' } });
  return setting ? parseInt(setting.value, 10) || 50 : 50;
}

/**
 * @param {{ semester: string }} params
 */
async function getLearningPartnerFunnel({ semester }) {
  const sem = String(semester || '').trim();
  if (!/^\d{3}-[12]$/.test(sem)) {
    const err = new Error('請提供有效學期（例如 114-1）');
    err.code = 'LP_INVALID_SEMESTER';
    err.status = 400;
    throw err;
  }

  const [teams, members, quotaLimit] = await Promise.all([
    sequelize.query(
      `
      SELECT
        lpt.id,
        lpt.status,
        lpt.teamSize,
        lpt.createdAt,
        lpt.approvedAt,
        lpt.expiresAt,
        lpt.cancelledAt
      FROM learning_partner_teams lpt
      WHERE lpt.id IN (
        SELECT DISTINCT lptm.teamId
        FROM learning_partner_team_members lptm
        INNER JOIN english_test_registrations etr
          ON lptm.personalRegistrationId = etr.id
        WHERE etr.semester = :semester
      )
      ORDER BY lpt.createdAt ASC
      `,
      { replacements: { semester: sem }, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `
      SELECT
        lptm.id,
        lptm.teamId,
        lptm.approvalStatus,
        lptm.isRepresentative,
        lptm.createdAt,
        lptm.approvedAt
      FROM learning_partner_team_members lptm
      WHERE lptm.teamId IN (
        SELECT DISTINCT m.teamId
        FROM learning_partner_team_members m
        INNER JOIN english_test_registrations etr
          ON m.personalRegistrationId = etr.id
        WHERE etr.semester = :semester
      )
      `,
      { replacements: { semester: sem }, type: QueryTypes.SELECT }
    ),
    getQuotaLimit(),
  ]);

  return computeLearningPartnerFunnel({
    teams,
    members,
    quotaLimit,
    semester: sem,
  });
}

module.exports = {
  computeLearningPartnerFunnel,
  getLearningPartnerFunnel,
  hoursBetween,
  median,
};
