// services/teacherEvaluationService.js
// Phase 2：教師儀表板（我的教學儀表板）
//
// 指標母體：該教師授課班級（ClassTeacher 或 Class.teacherName，與班級參與概況一致）
// + class_memberships 當學期學生；KPI 來自 kpiService（班級行政口徑）。
// riskStudentCount 為各班班級名冊內高風險人數，非 LJ active roster 母體。詳見 docs/analytics-and-reports-metric-definitions.md。

const { Op } = require('sequelize');
const { Class, ClassMembership, ClassTeacher, Teacher } = require('../models');
const kpiService = require('./kpiService');
const riskDetectionService = require('./riskDetectionService');
const { getCache, setCache } = require('../utils/analyticsCache');

const TEACHER_DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 與班級參與概況 classScopeGuard 對齊：ClassTeacher 對應 + Class.teacherName 後備。
 * @param {number} teacherId
 * @param {string} semester
 * @returns {Promise<number[]>}
 */
async function resolveTeacherClassIds(teacherId, semester) {
  const sem = String(semester || '').trim();
  const classIdSet = new Set();

  const teacherClassRows = await ClassTeacher.findAll({
    where: { teacherId, semester: sem, isActive: true },
    attributes: ['classId'],
    raw: true,
  });
  teacherClassRows.forEach((row) => {
    const id = Number(row.classId);
    if (Number.isInteger(id)) classIdSet.add(id);
  });

  const teacher = await Teacher.findByPk(teacherId, { attributes: ['id', 'name'] });
  const teacherName = String(teacher?.name || '').trim();
  if (teacherName) {
    const byName = await Class.findAll({
      where: { semester: sem, teacherName },
      attributes: ['id'],
      raw: true,
    });
    byName.forEach((row) => {
      const id = Number(row.id);
      if (Number.isInteger(id)) classIdSet.add(id);
    });
  }

  return [...classIdSet];
}

/**
 * @param {number} teacherId
 * @param {string} semester
 */
async function getTeacherDashboard(teacherId, semester) {
  if (!teacherId) throw new Error('teacherId is required');
  if (!semester) throw new Error('semester is required');

  const cacheKey = `teacher:${teacherId}:${semester}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const classIds = await resolveTeacherClassIds(teacherId, semester);
  if (classIds.length === 0) {
    return {
      teacherId,
      semester,
      classes: [],
      summary: {
        totalClasses: 0,
        avgParticipationRate: 0,
        avgPassRate: 0,
        totalRiskStudents: 0
      }
    };
  }

  const classesInfo = await Class.findAll({
    where: { id: { [Op.in]: classIds } },
    attributes: ['id', 'name']
  });
  const classNameById = {};
  classesInfo.forEach((c) => {
    classNameById[c.id] = c.name;
  });

  // 批次化關鍵：一次取 teacher 名下所有班級學生，再在記憶體分組計算 KPI，避免逐班多重查詢 (N+1)
  const allMemberships = await ClassMembership.findAll({
    where: { classId: { [Op.in]: classIds }, semester },
    attributes: ['classId', 'studentId'],
    raw: true
  });
  const studentIdsByClassId = {};
  allMemberships.forEach((m) => {
    const sid = kpiService.normalizeStudentIds([m.studentId])[0];
    if (!sid) return;
    if (!studentIdsByClassId[m.classId]) studentIdsByClassId[m.classId] = [];
    studentIdsByClassId[m.classId].push(sid);
  });
  Object.keys(studentIdsByClassId).forEach((cid) => {
    studentIdsByClassId[cid] = kpiService.normalizeStudentIds(studentIdsByClassId[cid]);
  });

  const allStudentIds = kpiService.normalizeStudentIds(
    Object.values(studentIdsByClassId).flat()
  );
  const context = await kpiService.buildKpiContext(allStudentIds, semester);
  const riskMap = {};
  const allRisks = await riskDetectionService.getRisksForStudents(allStudentIds, semester, { context });
  allRisks.forEach((r) => {
    riskMap[r.studentId] = r;
  });

  const classResults = [];
  for (const classId of classIds) {
    const studentIds = studentIdsByClassId[classId] || [];
    const studentCount = studentIds.length;

    const registrationMetrics = await kpiService.getBestepRegistrationMetrics(studentIds, semester, { context });
    const attendanceMetrics = await kpiService.getBestepAttendanceMetrics(studentIds, semester, {
      context,
      registrationMetrics
    });
    const passMetrics = await kpiService.getBestepPassMetrics(studentIds, semester, {
      context,
      attendanceMetrics
    });
    const participationMetrics = await kpiService.getParticipationMetrics(studentIds, semester, { context });
    const exemptionMetrics = await kpiService.getExemptionMetrics(studentIds, semester, { context });
    const riskStudentCount = studentIds.filter((sid) => riskMap[sid]?.riskLevel === 'high').length;

    classResults.push({
      classId,
      className: classNameById[classId] || null,
      studentCount,
      participationRate: participationMetrics.participationRate,
      bestepRegistrationRate: registrationMetrics.bestepRegistrationRate,
      bestepPassRate: passMetrics.bestepPassRate,
      exemptionApprovedRate: exemptionMetrics.exemptionApprovedRate,
      riskStudentCount
    });
  }

  const totalRiskStudents = classResults.reduce((sum, c) => sum + (c.riskStudentCount || 0), 0);

  const totalStudentCount = classResults.reduce((sum, c) => sum + (c.studentCount || 0), 0);
  const avgParticipationRate =
    totalStudentCount > 0
      ? Number(
          (
            classResults.reduce((sum, c) => sum + (c.participationRate * c.studentCount) / 100, 0) /
            totalStudentCount
          ) * 100
        ) // keep as Number
      : 0;

  const avgPassRate =
    totalStudentCount > 0
      ? Number(
          (
            classResults.reduce((sum, c) => sum + (c.bestepPassRate * c.studentCount) / 100, 0) /
            totalStudentCount
          ) * 100
        )
      : 0;

  const result = {
    teacherId,
    semester,
    classes: classResults,
    summary: {
      totalClasses: classResults.length,
      avgParticipationRate: Number(avgParticipationRate.toFixed(2)),
      avgPassRate: Number(avgPassRate.toFixed(2)),
      totalRiskStudents
    }
  };
  setCache(cacheKey, result, TEACHER_DASHBOARD_CACHE_TTL_MS);
  return result;
}

module.exports = {
  getTeacherDashboard,
  resolveTeacherClassIds,
};

