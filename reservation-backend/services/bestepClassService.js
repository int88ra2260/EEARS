// services/bestepClassService.js
const { 
  Class, 
  ClassMembership, 
  EnglishTestRegistration,
  LearningPartnerTeam,
  LearningPartnerTeamMember,
  BestepAttendance,
  BestepExamScore,
  BestepTeamRanking,
  EtEnrollmentSnapshot
} = require('../models');
const { Op } = require('sequelize');
const {
  pickLatestRegistrationPerStudent,
  computeExemptionDisplayType,
  formatExamTypeLabel
} = require('../utils/exemptionUtils');

function buildExamTypeFilter(type) {
  if (!type || type === 'all') return null;
  if (type === 'LR') return ['LR', 'LRSW'];
  if (type === 'SW') return ['SW', 'LRSW'];
  return [type];
}

function mapRegistrationForStudent(reg) {
  if (!reg) return null;
  return {
    status: reg.status,
    regId: reg.id,
    examType: reg.examType,
    examTypeLabel: formatExamTypeLabel(reg.examType),
    updatedAt: reg.updatedAt,
    exemptionType: computeExemptionDisplayType(reg),
    exemption_review_status: reg.exemption_review_status || null,
    exemptionVerifiedType: reg.exemption_verified_type || null
  };
}

/**
 * 將班級名冊列與報名／出席／成績／團體資料組合為 BESTEP 學生列
 */
async function enrichMembershipsWithBestepData(memberships, semester, options = {}) {
  const { examType = 'all', applyExamFilter = true } = options;
  const studentIds = memberships.map((m) => m.studentId);
  if (studentIds.length === 0) {
    return [];
  }

  const registrationExamTypes = applyExamFilter ? buildExamTypeFilter(examType) : null;
  const allRegsForStudents = await EnglishTestRegistration.findAll({
    where: {
      studentId: { [Op.in]: studentIds },
      semester
    },
    order: [['updatedAt', 'DESC'], ['id', 'DESC']]
  });
  const latestByStudent = pickLatestRegistrationPerStudent(allRegsForStudents);
  const matchesExamFilter = (reg) => {
    if (!registrationExamTypes || !reg) return true;
    return registrationExamTypes.includes(reg.examType);
  };

  const registrationsMap = {};
  studentIds.forEach((sid) => {
    const reg = latestByStudent[sid];
    if (!reg || !matchesExamFilter(reg)) {
      return;
    }
    registrationsMap[sid] = mapRegistrationForStudent(reg);
  });

  const teamMembers = await LearningPartnerTeamMember.findAll({
    where: {
      studentId: { [Op.in]: studentIds },
      activeFlag: 1
    },
    include: [{
      model: LearningPartnerTeam,
      as: 'team',
      where: {
        status: 'approved',
        activeFlag: 1
      },
      required: false
    }]
  });

  const teamIds = [...new Set(teamMembers.map((tm) => tm.teamId).filter((id) => id))];
  const rankings = teamIds.length > 0 ? await BestepTeamRanking.findAll({
    where: {
      teamId: { [Op.in]: teamIds },
      semester
    }
  }) : [];
  const rankingsMap = {};
  rankings.forEach((r) => {
    rankingsMap[r.teamId] = {
      rank: r.rank,
      rewardAmount: r.rewardAmount
    };
  });

  const groupRegistrationsMap = {};
  teamMembers.forEach((tm) => {
    if (tm.team && tm.teamId) {
      const ranking = rankingsMap[tm.teamId];
      groupRegistrationsMap[tm.studentId] = {
        teamId: tm.team.id,
        teamName: tm.team.teamName || `隊伍${tm.team.id}`,
        role: tm.isRepresentative ? 'leader' : 'member',
        teamStatus: tm.team.status,
        rank: ranking?.rank || null,
        rewardAmount: ranking?.rewardAmount || null
      };
    }
  });

  const attendanceWhere = {
    studentId: { [Op.in]: studentIds },
    semester
  };
  if (applyExamFilter && examType !== 'all') {
    if (examType === 'LR') {
      attendanceWhere.examType = { [Op.in]: ['L', 'R', 'LR'] };
    } else if (examType === 'SW') {
      attendanceWhere.examType = { [Op.in]: ['S', 'W', 'SW'] };
    } else {
      attendanceWhere.examType = examType;
    }
  }

  const attendances = await BestepAttendance.findAll({ where: attendanceWhere });
  const attendanceMap = {};
  attendances.forEach((att) => {
    if (!attendanceMap[att.studentId]) {
      attendanceMap[att.studentId] = {};
    }
    attendanceMap[att.studentId][att.examType] = {
      attended: att.attended,
      examDate: att.examDate,
      absentReason: att.absentReason
    };
  });

  const scores = await BestepExamScore.findAll({
    where: {
      studentId: { [Op.in]: studentIds },
      semester
    }
  });
  const scoresMap = {};
  scores.forEach((score) => {
    scoresMap[score.studentId] = {
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
    };
  });

  return memberships.map((membership) => {
    const studentId = membership.studentId;
    return {
      studentId,
      studentName: membership.studentName,
      department: membership.department,
      email: membership.email,
      grade: membership.grade,
      personalRegistration: registrationsMap[studentId] || null,
      groupRegistration: groupRegistrationsMap[studentId] || null,
      attendance: attendanceMap[studentId] || {},
      score: scoresMap[studentId] || null
    };
  });
}

/**
 * 班級 BESTEP 卡片統計（全班、學習歷程名冊本國學生口徑，與 Excel 匯出一致）
 */
async function buildClassBestepOverviewStatistics(classId, semester) {
  const [allMemberships, rosterMap] = await Promise.all([
    ClassMembership.findAll({
      where: { classId, semester },
      order: [['studentId', 'ASC']]
    }),
    loadSemesterRosterMap(semester)
  ]);

  const allStudents = await enrichMembershipsWithBestepData(allMemberships, semester, {
    examType: 'all',
    applyExamFilter: false
  });

  const statsStudents = allStudents.map((student) => ({
    ...student,
    ...resolveDomesticExportStatus(student.studentId, rosterMap)
  }));

  const summary = computeClassBestepExportSummary(statsStudents);
  const passedCount = allStudents.filter((s) => s.score && s.score.passed).length;
  const scoredStudents = allStudents.filter((s) => s.score && s.score.totalScore != null);
  const avgScore = scoredStudents.length > 0
    ? Number((
      scoredStudents.reduce((sum, s) => sum + parseFloat(s.score.totalScore || 0), 0)
      / scoredStudents.length
    ).toFixed(2))
    : null;
  const passRate = summary.registeredCount > 0
    ? Number(((passedCount / summary.registeredCount) * 100).toFixed(2))
    : 0;

  return {
    totalStudents: allMemberships.length,
    domesticStudentCount: summary.enrolledCount,
    registeredCount: summary.registeredCount,
    registrationRate: summary.registrationRate,
    totalExamCount: summary.registrationSlots,
    registrationDenominator: summary.registrationDenominator,
    attendedSlots: summary.attendedSlots,
    totalRegistrationExamSlots: summary.totalRegistrationExamSlots,
    attendanceRate: summary.attendanceRate,
    lrAttendanceRate: summary.lrAttendanceRate,
    sAttendanceRate: summary.sAttendanceRate,
    wAttendanceRate: summary.wAttendanceRate,
    lrTotalSlots: summary.lrTotalSlots,
    lrAttendedSlots: summary.lrAttendedSlots,
    sTotalSlots: summary.sTotalSlots,
    sAttendedSlots: summary.sAttendedSlots,
    wTotalSlots: summary.wTotalSlots,
    wAttendedSlots: summary.wAttendedSlots,
    fullAttendanceCount: summary.fullAttendanceCount,
    passedCount,
    passRate,
    avgScore
  };
}

/**
 * 取得班級 BESTEP 概況
 * @param {number} classId - 班級 ID
 * @param {string} semester - 學期
 * @param {string} examType - 考試類型：'LR' | 'SW' | 'all'
 * @param {object} filters - 篩選條件
 * @returns {Promise<object>}
 */
async function getClassBestepOverview(classId, semester, examType = 'all', filters = {}) {
  const { page = 1, pageSize = 50, search = '' } = filters;

  // 1. 取得班級資訊
  const classInfo = await Class.findByPk(classId);
  if (!classInfo) {
    throw new Error('班級不存在');
  }

  // 2. 取得班級學生列表
  const whereClause = {
    classId,
    semester
  };

  if (search) {
    whereClause[Op.or] = [
      { studentId: { [Op.like]: `%${search}%` } },
      { studentName: { [Op.like]: `%${search}%` } }
    ];
  }

  const { count: totalStudents, rows: memberships } = await ClassMembership.findAndCountAll({
    where: whereClause,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: [['studentId', 'ASC']]
  });

  const students = await enrichMembershipsWithBestepData(memberships, semester, {
    examType,
    applyExamFilter: true
  });

  const statistics = await buildClassBestepOverviewStatistics(classId, semester);

  return {
    classInfo: {
      classId: classInfo.id,
      className: classInfo.name,
      semester: classInfo.semester,
      teacherName: classInfo.teacherName
    },
    statistics,
    students,
    pagination: {
      page,
      pageSize,
      total: totalStudents,
      totalPages: Math.ceil(totalStudents / pageSize)
    }
  };
}

function normalizeEmptyValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeStudentId(studentId) {
  return normalizeEmptyValue(studentId).trim().toUpperCase();
}

const ATOMIC_EXAM_COMPONENTS = ['L', 'R', 'S', 'W'];
const NON_DOMESTIC_GRADE_NOTE = '非本國學生';

function isSuccessfulBestepRegistration(registration) {
  if (!registration) return false;
  const status = normalizeEmptyValue(registration.status).trim();
  return status === 'success' || status === 'registered_success';
}

/**
 * 將報考項目展開為 L/R/S/W 單項（供計次與出席欄位使用）
 */
function expandRegistrationToComponents(examType) {
  const code = normalizeEmptyValue(examType).trim().toUpperCase();
  if (!code || code === 'NON') return [];
  if (code === 'LRSW') return [...ATOMIC_EXAM_COMPONENTS];
  if (code === 'LR') return ['L', 'R'];
  if (code === 'SW') return ['S', 'W'];
  if (ATOMIC_EXAM_COMPONENTS.includes(code)) return [code];
  return [];
}

function resolveComponentAttended(attendanceMap, component) {
  const att = attendanceMap || {};
  const rec = att[component];
  if (rec && typeof rec.attended === 'boolean') {
    return rec.attended;
  }

  if (component === 'L' || component === 'R') {
    const lr = att.LR;
    if (lr && typeof lr.attended === 'boolean') {
      return lr.attended;
    }
  }

  if (component === 'S' || component === 'W') {
    const sw = att.SW;
    if (sw && typeof sw.attended === 'boolean') {
      return sw.attended;
    }
  }

  return null;
}

function getAttendanceExportCell(attendanceMap, component, registeredComponents) {
  if (!registeredComponents.includes(component)) {
    return '';
  }

  const attended = resolveComponentAttended(attendanceMap, component);
  if (attended === null) {
    return '';
  }

  return attended ? '✓' : '缺席';
}

function isRegistrationFailed(registration) {
  if (!registration) {
    return false;
  }
  const status = normalizeEmptyValue(registration.status).trim();
  if (status === 'success' || status === 'registered_success') {
    return false;
  }
  if (status === 'not_registered' || status === '未報名') {
    return false;
  }
  return true;
}

/**
 * 是否有報考欄：成功顯示報考項目（中文），其餘顯示未報名／報名失敗
 */
function getExportRegistrationDisplay(registration) {
  if (!registration) {
    return '未報名';
  }
  const status = normalizeEmptyValue(registration.status).trim();
  if (status === 'success' || status === 'registered_success') {
    return formatExamTypeLabel(registration.examType)
      || normalizeEmptyValue(registration.examType).trim().toUpperCase();
  }
  if (status === 'not_registered' || status === '未報名') {
    return '未報名';
  }
  return '報名失敗';
}

function getApprovedExemptionComponents(registration) {
  if (!registration || registration.exemption_review_status !== 'approved') {
    return [];
  }
  return expandRegistrationToComponents(registration.exemptionVerifiedType);
}

/**
 * 計次 = 報名成功項目數 + 抵免通過項目數
 */
function computeStudentExamCount(registration) {
  let count = 0;
  if (isSuccessfulBestepRegistration(registration)) {
    count += expandRegistrationToComponents(registration.examType).length;
  }
  count += getApprovedExemptionComponents(registration).length;
  return count;
}

function getRegistrationComponentsForAttendance(registration) {
  if (!isSuccessfulBestepRegistration(registration)) {
    return [];
  }
  return expandRegistrationToComponents(registration.examType);
}

/**
 * 學習歷程名冊（EtEnrollmentSnapshot）比對：在冊且非明確外籍才納入統計
 */
function resolveDomesticExportStatus(studentId, rosterMap) {
  const sid = normalizeStudentId(studentId);
  const snap = rosterMap.get(sid);
  if (!snap) {
    return {
      inRoster: false,
      isDomesticForStats: false,
      showNonDomesticNote: true
    };
  }
  if (snap.isDomestic === false) {
    return {
      inRoster: true,
      isDomesticForStats: false,
      showNonDomesticNote: true
    };
  }
  return {
    inRoster: true,
    isDomesticForStats: true,
    showNonDomesticNote: false
  };
}

async function loadSemesterRosterMap(semester) {
  const rows = await EtEnrollmentSnapshot.findAll({
    where: { semesterId: semester, isActive: true },
    attributes: ['studentId', 'isDomestic'],
    raw: true
  });
  const map = new Map();
  rows.forEach((row) => {
    const sid = normalizeStudentId(row.studentId);
    if (!sid) {
      return;
    }
    map.set(sid, { isDomestic: row.isDomestic });
  });
  return map;
}

function formatExportGrade(grade, showNonDomesticNote) {
  const base = normalizeEmptyValue(grade);
  if (!showNonDomesticNote) {
    return base;
  }
  if (!base) {
    return NON_DOMESTIC_GRADE_NOTE;
  }
  if (base.includes(NON_DOMESTIC_GRADE_NOTE)) {
    return base;
  }
  return `${base}（${NON_DOMESTIC_GRADE_NOTE}）`;
}

function getExportExemptionCode(registration) {
  if (!registration || registration.exemption_review_status !== 'approved') {
    return '';
  }
  const code = normalizeEmptyValue(registration.exemptionVerifiedType).trim().toUpperCase();
  if (!code || code === 'NONE') {
    return '';
  }
  return code;
}

function computeAttendanceRatePercent(attendedCount, totalSlots) {
  if (!totalSlots || totalSlots <= 0) {
    return null;
  }
  return Number(((attendedCount / totalSlots) * 100).toFixed(2));
}

/**
 * 計算匯出／卡片摘要統計（僅納入學習歷程名冊內本國學生）
 * - 報考率 = 本國學生總計次（排除不在名冊、報名失敗）/ 本國學生×4（排除不在名冊、報名失敗）
 * - 到考率（總/LR/S/W）= 各範圍實際出席項目數 / 總報考項目數（僅報名成功者應考項目）
 */
function computeClassBestepExportSummary(students) {
  const domesticStudents = students.filter((s) => s.isDomesticForStats);
  const rateBaseStudents = domesticStudents.filter(
    (s) => !isRegistrationFailed(s.personalRegistration)
  );

  let totalExamCount = 0;
  let registeredCount = 0;
  let totalRegistrationExamSlots = 0;
  let attendedSlots = 0;
  let fullAttendanceCount = 0;
  const componentSlots = { L: 0, R: 0, S: 0, W: 0 };
  const componentAttended = { L: 0, R: 0, S: 0, W: 0 };

  rateBaseStudents.forEach((student) => {
    const personal = student.personalRegistration;
    totalExamCount += computeStudentExamCount(personal);

    if (!isSuccessfulBestepRegistration(personal)) {
      return;
    }

    registeredCount += 1;
    const components = getRegistrationComponentsForAttendance(personal);
    totalRegistrationExamSlots += components.length;

    let allAttended = components.length > 0;
    components.forEach((component) => {
      componentSlots[component] += 1;
      const attended = resolveComponentAttended(student.attendance || {}, component);
      if (attended === true) {
        attendedSlots += 1;
        componentAttended[component] += 1;
      } else {
        allAttended = false;
      }
    });

    if (allAttended) {
      fullAttendanceCount += 1;
    }
  });

  const registrationDenominator = rateBaseStudents.length * 4;
  const lrTotalSlots = componentSlots.L + componentSlots.R;
  const lrAttendedSlots = componentAttended.L + componentAttended.R;

  const registrationRate = registrationDenominator > 0
    ? Number(((totalExamCount / registrationDenominator) * 100).toFixed(2))
    : 0;
  const attendanceRate = computeAttendanceRatePercent(attendedSlots, totalRegistrationExamSlots);
  const lrAttendanceRate = computeAttendanceRatePercent(lrAttendedSlots, lrTotalSlots);
  const sAttendanceRate = computeAttendanceRatePercent(componentAttended.S, componentSlots.S);
  const wAttendanceRate = computeAttendanceRatePercent(componentAttended.W, componentSlots.W);

  return {
    enrolledCount: domesticStudents.length,
    registeredCount,
    registrationRate,
    registrationSlots: totalExamCount,
    registrationDenominator,
    totalRegistrationExamSlots,
    attendedSlots,
    attendanceRate,
    lrAttendanceRate,
    sAttendanceRate,
    wAttendanceRate,
    lrTotalSlots,
    lrAttendedSlots,
    sTotalSlots: componentSlots.S,
    sAttendedSlots: componentAttended.S,
    wTotalSlots: componentSlots.W,
    wAttendedSlots: componentAttended.W,
    fullAttendanceCount
  };
}

/**
 * 建立班級 BESTEP 匯出資料（含上方摘要與學生列表）
 */
async function buildClassBestepExportData(classId, semester, examType = 'all', filters = {}) {
  const { search = '' } = filters;

  const classInfo = await Class.findByPk(classId);
  if (!classInfo) throw new Error('班級不存在');

  const whereClause = {
    classId,
    semester
  };

  if (search) {
    whereClause[Op.or] = [
      { studentId: { [Op.like]: `%${search}%` } },
      { studentName: { [Op.like]: `%${search}%` } }
    ];
  }

  const totalCount = await ClassMembership.count({ where: whereClause });
  if (totalCount === 0) {
    return {
      classInfo: {
        className: classInfo.name,
        teacherName: classInfo.teacherName || ''
      },
      summary: computeClassBestepExportSummary([]),
      rows: []
    };
  }

  const overview = await getClassBestepOverview(classId, semester, examType, {
    page: 1,
    pageSize: totalCount,
    search
  });

  const rosterMap = await loadSemesterRosterMap(semester);
  const students = (overview.students || []).map((student) => ({
    ...student,
    ...resolveDomesticExportStatus(student.studentId, rosterMap)
  }));
  const summary = computeClassBestepExportSummary(students);

  const rows = students.map((student) => {
    const personal = student.personalRegistration;
    const registeredComponents = getRegistrationComponentsForAttendance(personal);
    const attendanceMap = student.attendance || {};
    const examCount = computeStudentExamCount(personal);

    return {
      studentId: normalizeEmptyValue(student.studentId),
      studentName: normalizeEmptyValue(student.studentName),
      department: normalizeEmptyValue(student.department),
      grade: formatExportGrade(student.grade, student.showNonDomesticNote),
      registeredExamType: getExportRegistrationDisplay(personal),
      exemptionCode: getExportExemptionCode(personal),
      examCount: examCount > 0 ? examCount : '',
      listeningAttendance: getAttendanceExportCell(attendanceMap, 'L', registeredComponents),
      readingAttendance: getAttendanceExportCell(attendanceMap, 'R', registeredComponents),
      speakingAttendance: getAttendanceExportCell(attendanceMap, 'S', registeredComponents),
      writingAttendance: getAttendanceExportCell(attendanceMap, 'W', registeredComponents)
    };
  });

  return {
    classInfo: {
      className: overview.classInfo?.className || classInfo.name,
      teacherName: overview.classInfo?.teacherName || classInfo.teacherName || ''
    },
    summary,
    rows
  };
}

module.exports = {
  getClassBestepOverview,
  buildClassBestepExportData,
  expandRegistrationToComponents,
  computeClassBestepExportSummary,
  computeAttendanceRatePercent,
  computeStudentExamCount,
  resolveComponentAttended,
  resolveDomesticExportStatus,
  getExportRegistrationDisplay,
  isRegistrationFailed
};
