/**
 * 學習有伴：單次考試（學期）有伴 vs 無伴成績對照
 * 「有參加」= 該學期已完成同意之團體成員（與團體名次資格一致）
 * 「沒參加」= 同學期 BESTEP 成績名單中，非上述成員者
 * 數字用來比較趨勢，不保證參加就進步。
 */

const { QueryTypes } = require('sequelize');
const { BestepExamScore, sequelize } = require('../models');
const { resolveMemberTotalScore } = require('./bestepRankingService');

const SKILL_FIELDS = [
  { key: 'listening', scoreField: 'listeningScore' },
  { key: 'reading', scoreField: 'readingScore' },
  { key: 'speaking', scoreField: 'speakingScore' },
  { key: 'writing', scoreField: 'writingScore' },
];

function normStudentId(v) {
  return String(v || '').trim().toUpperCase();
}

function toRate(numerator, denominator) {
  if (!denominator) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function avg(values) {
  if (!values.length) return null;
  return Number((values.reduce((s, n) => s + n, 0) / values.length).toFixed(2));
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Number((((sorted[mid - 1] + sorted[mid]) / 2)).toFixed(2));
  }
  return Number(sorted[mid].toFixed(2));
}

function summarizeScoreGroup(scores) {
  const totals = [];
  const skillValues = {
    listening: [],
    reading: [],
    speaking: [],
    writing: [],
  };
  let passedCount = 0;

  for (const score of scores) {
    const total = resolveMemberTotalScore(score);
    if (total != null && Number.isFinite(total)) totals.push(total);

    for (const { key, scoreField } of SKILL_FIELDS) {
      const raw = score[scoreField];
      if (raw === null || raw === undefined || raw === '') continue;
      const n = parseFloat(raw);
      if (Number.isFinite(n)) skillValues[key].push(n);
    }

    if (score.passed === true || score.passed === 1 || score.passed === '1') {
      passedCount += 1;
    }
  }

  const skills = {};
  for (const { key } of SKILL_FIELDS) {
    skills[key] = {
      count: skillValues[key].length,
      avg: avg(skillValues[key]),
      median: median(skillValues[key]),
    };
  }

  return {
    studentCount: scores.length,
    withTotalScoreCount: totals.length,
    avgTotalScore: avg(totals),
    medianTotalScore: median(totals),
    passedCount,
    passRatePct: toRate(passedCount, scores.length),
    skills,
  };
}

function diffNullable(a, b) {
  if (a == null || b == null) return null;
  return Number((a - b).toFixed(2));
}

/**
 * 純函式：由兩組成績列計算對照（便於單元測試）
 */
function computeLearningPartnerOutcomeComparison({
  semester,
  partnerMemberIds,
  partnerScores,
  nonPartnerScores,
}) {
  const partnerIds = new Set((partnerMemberIds || []).map(normStudentId).filter(Boolean));
  const scoredPartnerIds = new Set(
    (partnerScores || []).map((s) => normStudentId(s.studentId)).filter(Boolean)
  );
  const partnerWithoutScoreCount = [...partnerIds].filter((id) => !scoredPartnerIds.has(id)).length;

  const partner = summarizeScoreGroup(partnerScores || []);
  const nonPartner = summarizeScoreGroup(nonPartnerScores || []);

  const skillDelta = {};
  for (const { key } of SKILL_FIELDS) {
    skillDelta[key] = {
      avg: diffNullable(partner.skills[key].avg, nonPartner.skills[key].avg),
      median: diffNullable(partner.skills[key].median, nonPartner.skills[key].median),
    };
  }

  return {
    semester,
    definition: {
      partner: '該學期已完成同意之學習有伴團體成員（與團體名次資格一致）',
      nonPartner: '同學期 BESTEP 成績名單中，非學習有伴成員者',
      caveat: '數字用來比較趨勢，不保證參加就進步；未控制先備程度與自選偏誤。',
    },
    coverage: {
      partnerMemberCount: partnerIds.size,
      partnerWithScoreCount: partner.studentCount,
      partnerWithoutScoreCount,
      nonPartnerWithScoreCount: nonPartner.studentCount,
      examScoreTotal: partner.studentCount + nonPartner.studentCount,
    },
    partner,
    nonPartner,
    delta: {
      avgTotalScore: diffNullable(partner.avgTotalScore, nonPartner.avgTotalScore),
      medianTotalScore: diffNullable(partner.medianTotalScore, nonPartner.medianTotalScore),
      passRatePctPoints: diffNullable(partner.passRatePct, nonPartner.passRatePct),
      skills: skillDelta,
    },
  };
}

async function loadApprovedPartnerStudentIds(semester) {
  const rows = await sequelize.query(
    `
    SELECT DISTINCT lptm.studentId AS studentId
    FROM learning_partner_team_members lptm
    INNER JOIN learning_partner_teams lpt ON lpt.id = lptm.teamId
    INNER JOIN english_test_registrations etr ON lptm.personalRegistrationId = etr.id
    WHERE etr.semester = :semester
      AND lptm.activeFlag = 1
      AND lptm.approvalStatus = 'approved'
      AND lpt.activeFlag = 1
      AND lpt.status = 'approved'
    `,
    { replacements: { semester }, type: QueryTypes.SELECT }
  );
  return [...new Set(rows.map((r) => normStudentId(r.studentId)).filter(Boolean))];
}

/**
 * @param {{ semester: string }} params
 */
async function getLearningPartnerOutcomeComparison({ semester }) {
  const sem = String(semester || '').trim();
  if (!/^\d{3}-[12]$/.test(sem)) {
    const err = new Error('請提供有效學期（例如 114-1）');
    err.code = 'LP_INVALID_SEMESTER';
    err.status = 400;
    throw err;
  }

  const [partnerMemberIds, allScores] = await Promise.all([
    loadApprovedPartnerStudentIds(sem),
    BestepExamScore.findAll({
      where: { semester: sem },
      attributes: [
        'studentId',
        'listeningScore',
        'readingScore',
        'speakingScore',
        'writingScore',
        'totalScore',
        'passed',
      ],
    }),
  ]);

  const partnerIdSet = new Set(partnerMemberIds);
  const partnerScores = [];
  const nonPartnerScores = [];

  for (const row of allScores) {
    const plain = typeof row.toJSON === 'function' ? row.toJSON() : row;
    const sid = normStudentId(plain.studentId);
    if (partnerIdSet.has(sid)) partnerScores.push(plain);
    else nonPartnerScores.push(plain);
  }

  return computeLearningPartnerOutcomeComparison({
    semester: sem,
    partnerMemberIds,
    partnerScores,
    nonPartnerScores,
  });
}

module.exports = {
  computeLearningPartnerOutcomeComparison,
  getLearningPartnerOutcomeComparison,
  summarizeScoreGroup,
  normStudentId,
};
