/**
 * Deprecated legacy/MVP student profile compatibility layer.
 *
 * The official Learning Journey source is /api/admin/learning-journey-v3/*.
 * Do not add new product features here; route new profile work to Learning
 * Journey V3 or the future Learning Journey Hub. This service remains only for
 * compatibility with older analytics/profile endpoints.
 */
const {
  ClassMembership,
  EnglishTestRegistration,
  BestepAttendance,
  BestepExamScore,
  EnglishTableSurveyResponse,
  EtExamAttempt,
  EtExamAttemptScore,
  EtCefrLevel,
  sequelize
} = require('../models');
const { Op, QueryTypes } = require('sequelize');
const { SEMESTER_RANGES, compareSemester } = require('../utils/semesterConstants');
const {
  computeExemptionDisplayType,
  pickLatestRegistrationPerStudent
} = require('../utils/exemptionUtils');
const adminClasses = require('../controllers/adminClassesController');
const riskDetectionService = require('./riskDetectionService');

/**
 * @param {string} studentId
 * @param {{ fromSemester?: string, toSemester?: string }} [options]
 */
async function getStudentProfile(studentId, options = {}) {
  const { fromSemester, toSemester } = options;
  const clean = adminClasses.cleanStudentId(studentId);
  if (!clean) {
    throw new Error('學號無效');
  }

  const memberships = await ClassMembership.findAll({
    where: { studentId: { [Op.or]: [studentId, clean] } },
    order: [['semester', 'ASC']]
  });

  const semesterSet = new Set();
  memberships.forEach((m) => {
    if (m.semester) semesterSet.add(m.semester);
  });

  const allRegs = await EnglishTestRegistration.findAll({
    where: { studentId: { [Op.or]: [studentId, clean] } },
    order: [['updatedAt', 'DESC']]
  });
  allRegs.forEach((r) => {
    if (r.semester) semesterSet.add(r.semester);
  });

  let semestersList = [...semesterSet].sort(compareSemester);
  if (fromSemester) {
    semestersList = semestersList.filter((s) => compareSemester(fromSemester, s) <= 0);
  }
  if (toSemester) {
    semestersList = semestersList.filter((s) => compareSemester(s, toSemester) <= 0);
  }

  const latestBySem = {};
  const regsBySem = {};
  allRegs.forEach((r) => {
    const sem = r.semester || '_null';
    if (!regsBySem[sem]) regsBySem[sem] = [];
    regsBySem[sem].push(r);
  });
  Object.keys(regsBySem).forEach((sem) => {
    const picked = pickLatestRegistrationPerStudent(regsBySem[sem]);
    const k = Object.keys(picked)[0];
    if (k) latestBySem[sem === '_null' ? null : sem] = picked[k];
  });

  const basicInfo = {
    studentId: clean,
    nameFromMembership: memberships[0]?.studentName || null,
    department: memberships[0]?.department || null
  };

  const semesters = [];
  let totalParticipation = 0;
  const scoresNum = [];

  for (const semester of semestersList) {
    const range = SEMESTER_RANGES[semester];
    if (!range) continue;

    const mem = memberships.find((m) => m.semester === semester);
    const participation = await adminClasses.getStudentParticipationStats(
      clean,
      range,
      'All'
    );

    totalParticipation += participation.attendedCountTotal || 0;

    const violCount = await countEventViolationsForStudentInRange(clean, range);

    const reg = latestBySem[semester] || null;
    const attendRows = await BestepAttendance.findAll({
      where: { studentId: clean, semester }
    });
    const attended = {};
    attendRows.forEach((a) => {
      attended[a.examType] = {
        attended: a.attended,
        examDate: a.examDate,
        absentReason: a.absentReason
      };
    });

    const score = await BestepExamScore.findOne({
      where: { studentId: clean, semester }
    });

    if (score && score.totalScore != null) {
      const n = parseFloat(score.totalScore);
      if (!isNaN(n)) scoresNum.push(n);
    }

    semesters.push({
      semester,
      classId: mem ? mem.classId : null,
      className: null,
      participation: {
        reservedCount: participation.reservedCount,
        attendedCountTotal: participation.attendedCountTotal,
        noShowCount: participation.noShowCount,
        totalHours: participation.totalHours,
        pointScore: participation.pointScore,
        attendedByType: participation.attendedByType
      },
      bestep: {
        registered: !!(reg && reg.status),
        registrationStatus: reg ? reg.status : null,
        examType: reg ? reg.examType : null,
        attended,
        score: score
          ? {
              listeningScore: score.listeningScore,
              readingScore: score.readingScore,
              speakingScore: score.speakingScore,
              writingScore: score.writingScore,
              listeningLevel: score.listeningLevel,
              readingLevel: score.readingLevel,
              speakingLevel: score.speakingLevel,
              writingLevel: score.writingLevel,
              totalScore: score.totalScore,
              overallLevel: score.overallLevel,
              passed: score.passed
            }
          : null,
        exemption: reg
          ? {
              reviewStatus: reg.exemption_review_status,
              verifiedType: reg.exemption_verified_type,
              displayLabel: computeExemptionDisplayType(reg)
            }
          : null
      },
      violations: violCount,
      survey: {
        note: 'English Table 問卷依學期分開填寫',
        englishTableCompleted: false
      }
    });
  }

  for (const semRow of semesters) {
    const sem = semRow.semester;
    const surveyRow = await EnglishTableSurveyResponse.findOne({
      where: { studentId: { [Op.or]: [clean, studentId] }, semester: sem },
    });
    semRow.survey.englishTableCompleted = !!surveyRow;
  }

  let etAttempts = [];
  try {
    etAttempts = await EtExamAttempt.findAll({
      where: { studentId: clean, status: 'valid' },
      include: [
        {
          model: EtExamAttemptScore,
          as: 'scores',
          required: false
        }
      ],
      order: [['testDate', 'DESC']]
    });
  } catch (e) {
    etAttempts = [];
  }

  const avgScore =
    scoresNum.length > 0
      ? scoresNum.reduce((a, b) => a + b, 0) / scoresNum.length
      : null;
  const bestScore = scoresNum.length > 0 ? Math.max(...scoresNum) : null;

  // Phase 9：計算英檢（et_exam_attempts）的「每項能力最佳分數」與「CEFR 成長」
  // - 每項能力最佳：比較最高 cefr（rank），同 rank 則取最大 rawScore
  // - CEFR 成長：依 testDate 排序，輸出每次整體/各項 cefr（含 rank）
  const cefrRankMap = {};
  try {
    const cefrRows = await EtCefrLevel.findAll({ raw: true });
    cefrRows.forEach((r) => {
      if (!r?.level) return;
      cefrRankMap[r.level] = Number(r.rank);
    });
  } catch (_) {
    // fallback（不依賴資料表存在性）
    ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].forEach((lvl, idx) => {
      cefrRankMap[lvl] = idx + 1;
    });
  }

  const compareByCefrThenRaw = (a, b) => {
    // a/b: { cefr, rawScore }
    const aRank = cefrRankMap[a?.cefr] || -1;
    const bRank = cefrRankMap[b?.cefr] || -1;
    if (aRank !== bRank) return aRank - bRank;
    const aRaw = typeof a?.rawScore === 'number' ? a.rawScore : Number(a?.rawScore);
    const bRaw = typeof b?.rawScore === 'number' ? b.rawScore : Number(b?.rawScore);
    const ar = Number.isFinite(aRaw) ? aRaw : -Infinity;
    const br = Number.isFinite(bRaw) ? bRaw : -Infinity;
    return ar - br;
  };

  const SKILLS = ['LISTENING', 'READING', 'SPEAKING', 'WRITING'];

  const bestBySkill = {};
  const cefrGrowthBySkill = {
    LISTENING: [],
    READING: [],
    SPEAKING: [],
    WRITING: [],
  };
  const overallByAttempt = [];

  // 依 testDate ASC 建立成長序列（old -> new）
  const attemptsSorted = [...etAttempts].sort((a, b) => {
    const ta = new Date(a.testDate || a.createdAt || 0).getTime();
    const tb = new Date(b.testDate || b.createdAt || 0).getTime();
    return ta - tb;
  });

  for (const attempt of attemptsSorted) {
    const scores = (attempt.scores || []).filter(Boolean);

    // 每項能力成長（取此 attempt 的 cefr）
    for (const skill of SKILLS) {
      const s = scores.find((x) => x.skill === skill);
      const cefr = s?.cefr || null;
      const rawScore = s?.rawScore != null ? Number(s.rawScore) : null;
      const rank = cefr != null ? cefrRankMap[cefr] || null : null;

      cefrGrowthBySkill[skill].push({
        testDate: attempt.testDate,
        cefr,
        cefrRank: rank,
        rawScore,
      });

      if (!bestBySkill[skill]) bestBySkill[skill] = { bestRawScore: null, bestCefr: null, bestCefrRank: null };
      if (cefr != null) {
        const current = { cefr, rawScore };
        const currentBest = {
          cefr: bestBySkill[skill].bestCefr,
          rawScore: bestBySkill[skill].bestRawScore,
        };
        if (
          !bestBySkill[skill].bestCefr ||
          compareByCefrThenRaw(current, currentBest) > 0
        ) {
          bestBySkill[skill] = {
            bestRawScore: rawScore,
            bestCefr: cefr,
            bestCefrRank: rank,
          };
        }
      } else if (rawScore != null) {
        // cefr 缺失時仍保留 rawScore 的最高值（保守）
        const current = { cefr: null, rawScore };
        const currentBest = { cefr: bestBySkill[skill].bestCefr, rawScore: bestBySkill[skill].bestRawScore };
        if (!bestBySkill[skill].bestCefr || compareByCefrThenRaw(current, currentBest) > 0) {
          bestBySkill[skill] = {
            bestRawScore: rawScore,
            bestCefr: bestBySkill[skill].bestCefr || null,
            bestCefrRank: bestBySkill[skill].bestCefrRank || null,
          };
        }
      }
    }

    // overall cefr（取各項 cefr 的最低 rank；類似 bestep overallLevel 的定義）
    const cefrs = SKILLS.map((skill) => {
      const s = scores.find((x) => x.skill === skill);
      return s?.cefr || null;
    }).filter(Boolean);
    const ranks = cefrs
      .map((c) => cefrRankMap[c])
      .filter((r) => Number.isFinite(r));

    const overallRank = ranks.length ? Math.min(...ranks) : null;
    const overallCefr =
      overallRank != null
        ? Object.entries(cefrRankMap).find(([, r]) => r === overallRank)?.[0] || null
        : null;

    overallByAttempt.push({
      testDate: attempt.testDate,
      overallCefr,
      overallCefrRank: overallRank,
    });
  }

  const overallBestRank = overallByAttempt
    .map((x) => x.overallCefrRank)
    .filter((r) => r != null);
  const overallBestCefrRank = overallBestRank.length ? Math.max(...overallBestRank) : null;
  const overallBestCefr =
    overallBestCefrRank != null
      ? Object.entries(cefrRankMap).find(([, r]) => r === overallBestCefrRank)?.[0] || null
      : null;

  // 風險輸出統一使用 riskDetectionService 規則與格式
  let risk = null;
  if (semestersList.length > 0) {
    const latestSemester = semestersList[semestersList.length - 1];
    const list = await riskDetectionService.getRisksForStudents([clean], latestSemester);
    risk = list[0] || null;
  }

  return {
    studentId: clean,
    basicInfo,
    semesters,
    etExamAttempts: etAttempts.map((a) => ({
      id: a.id,
      testType: a.testType,
      testDate: a.testDate,
      source: a.source,
      scores: (a.scores || []).map((s) => ({
        skill: s.skill,
        rawScore: s.rawScore,
        cefr: s.cefr
      })),
      // 額外：overall cefr（用來畫 CEFR 成長）
      overallCefr:
        (cefrRankMap &&
          (() => {
            const cefrs = (a.scores || [])
              .map((s) => s.cefr)
              .filter(Boolean);
            const ranks = cefrs.map((c) => cefrRankMap[c]).filter((r) => Number.isFinite(r));
            if (!ranks.length) return null;
            const overallRank = Math.min(...ranks);
            return Object.entries(cefrRankMap).find(([, r]) => r === overallRank)?.[0] || null;
          })()) ||
        null,
    })),
    summary: {
      totalParticipation,
      avgScore: avgScore != null ? Number(avgScore.toFixed(2)) : null,
      bestScore: bestScore != null ? bestScore : null,
      riskLevel: risk?.riskLevel || 'low',
      riskScore: risk?.riskScore || 0,
      riskReasons: risk?.reasons || []
    },
    englishTest: {
      bestBySkill,
      overallBestCefr,
      cefrGrowth: {
        overallByAttempt,
        bySkill: cefrGrowthBySkill
      }
    }
  };
}

async function countEventViolationsForStudentInRange(cleanStudentId, range) {
  try {
    const rows = await sequelize.query(
      `
      SELECT COUNT(*) AS c
      FROM event_violations ev
      INNER JOIN Users u ON ev.userId = u.id
      WHERE u.studentId = :sid
        AND ev.recordedAt >= :start
        AND ev.recordedAt <= :end
      `,
      {
        replacements: {
          sid: cleanStudentId,
          start: `${range.start} 00:00:00`,
          end: `${range.end} 23:59:59`
        },
        type: QueryTypes.SELECT
      }
    );
    return parseInt(rows[0]?.c || 0, 10) || 0;
  } catch (e) {
    return 0;
  }
}

module.exports = {
  getStudentProfile
};
