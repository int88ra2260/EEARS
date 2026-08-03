// services/analyticsService.js
// Phase 2.5：Admin Analytics 聚合（重用 KPI + 風險 + 快取）

const {
  Class,
  ClassMembership,
  EtEnrollmentSnapshot,
  sequelize
} = require('../models');
const { getStudentsBestSkillsMap, SKILLS } = require('./learningJourney/bestSkillService');
const { Op } = require('sequelize');
const kpiService = require('./kpiService');
const riskDetectionService = require('./riskDetectionService');
const { getCache, setCache } = require('../utils/analyticsCache');
const { SEMESTER_RANGES } = require('../utils/semesterConstants');

const OVERVIEW_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * events.date 為 VARCHAR；純字串 BETWEEN 易與含時間尾碼／前後空白不一致而漏請。
 * 統一 CAST 成 DATE 比對 SEMESTER_RANGES（與行政總覽預約／名額 KPI 一致）。
 * @param {'e'|'e2'} tableAlias
 */
function sqlEventDateInSemesterRange(tableAlias) {
  const a = tableAlias === 'e2' ? 'e2' : 'e';
  return `CAST(TRIM(${a}.date) AS DATE) BETWEEN CAST(:start AS DATE) AND CAST(:end AS DATE)`;
}

/** 與 b2ReportService 一致：CEFR rank ≥ 4 視為 B2+（達標門檻） */
const LJ_ATTAINMENT_MIN_RANK = 4;

function avg(numbers) {
  const arr = (numbers || []).filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!arr.length) return null;
  return Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2));
}

function buildSurveyGroups(studentIds, surveyCompletedSet) {
  const withSurvey = [];
  const withoutSurvey = [];
  studentIds.forEach((sid) => {
    if (surveyCompletedSet.has(sid)) withSurvey.push(sid);
    else withoutSurvey.push(sid);
  });
  return { withSurvey, withoutSurvey };
}

function computeGroupParticipationMetrics(groupStudentIds, attendedCountByStudent) {
  if (!groupStudentIds.length) return null;
  return avg(groupStudentIds.map((sid) => attendedCountByStudent[sid] || 0));
}

function computeGroupScoreMetrics(groupStudentIds, scoreByStudent) {
  if (!groupStudentIds.length) return null;
  return avg(
    groupStudentIds
      .map((sid) => scoreByStudent[sid]?.totalScore)
      .filter((v) => typeof v === 'number')
  );
}

function computeSurveyCrossAnalysis(studentIds, context) {
  const groups = buildSurveyGroups(studentIds, context.surveyCompletedSet);
  return {
    withSurvey: {
      avgParticipation: computeGroupParticipationMetrics(groups.withSurvey, context.attendedCountByStudent),
      avgScore: computeGroupScoreMetrics(groups.withSurvey, context.scoreByStudent)
    },
    withoutSurvey: {
      avgParticipation: computeGroupParticipationMetrics(groups.withoutSurvey, context.attendedCountByStudent),
      avgScore: computeGroupScoreMetrics(groups.withoutSurvey, context.scoreByStudent)
    }
  };
}

function buildGroupStats(uniqueStudentMembership, highRiskStudentIds) {
  const byGradeMap = {};
  const byDepartmentMap = {};

  Object.entries(uniqueStudentMembership).forEach(([sid, m]) => {
    const grade = m.grade || 'unknown';
    const department = m.department || 'unknown';

    if (!byGradeMap[grade]) byGradeMap[grade] = { totalStudents: 0, highRiskStudentCount: 0 };
    if (!byDepartmentMap[department]) byDepartmentMap[department] = { totalStudents: 0, highRiskStudentCount: 0 };

    byGradeMap[grade].totalStudents += 1;
    byDepartmentMap[department].totalStudents += 1;

    if (highRiskStudentIds.has(sid)) {
      byGradeMap[grade].highRiskStudentCount += 1;
      byDepartmentMap[department].highRiskStudentCount += 1;
    }
  });

  return {
    byGrade: Object.entries(byGradeMap).map(([grade, v]) => ({ grade, ...v })),
    byDepartment: Object.entries(byDepartmentMap).map(([department, v]) => ({ department, ...v }))
  };
}

async function buildClassRiskRanking(uniqueStudentMembership, highRiskStudentIds) {
  const classHighRiskCount = {};
  Object.entries(uniqueStudentMembership).forEach(([sid, m]) => {
    if (!highRiskStudentIds.has(sid)) return;
    const classId = Number(m.classId);
    if (!classId) return;
    if (!classHighRiskCount[classId]) classHighRiskCount[classId] = 0;
    classHighRiskCount[classId] += 1;
  });

  const classIds = Object.keys(classHighRiskCount).map((id) => Number(id));
  if (!classIds.length) {
    return { top10Classes: [], highRiskClasses: [] };
  }

  const classRows = await Class.findAll({
    where: { id: { [Op.in]: classIds } },
    attributes: ['id', 'name'],
    raw: true
  });
  const classNameById = {};
  classRows.forEach((c) => {
    classNameById[c.id] = c.name;
  });

  const ranking = classIds.map((classId) => ({
    classId,
    className: classNameById[classId] || null,
    riskStudentCount: classHighRiskCount[classId]
  }));
  ranking.sort((a, b) => (b.riskStudentCount || 0) - (a.riskStudentCount || 0));
  return {
    top10Classes: ranking.slice(0, 10),
    highRiskClasses: ranking
  };
}

/**
 * 行政總覽「學習歷程核心 KPI」：口徑與 Learning Journey V3 一致。
 * - roster：EtEnrollmentSnapshot isActive=true（學期 active 追蹤名冊）
 * - 有效成績：至少一項 skill 之 cefrRank ≥ 1（可判讀之歷史最佳技能）
 * - 已達標：至少一項 skill 之 cefrRank ≥ LJ_ATTAINMENT_MIN_RANK（B2+，與 b2ReportService 對齊）
 * - 達標率：已達標 DISTINCT student / 追蹤學生數（canonical；**不得**以 english_test_registrations.hasCEFRB2 代替）
 * - 高風險：僅針對名冊內學生呼叫 riskDetectionService.computeRisksForStudentIds（母體與 getAdminOverview 班級名冊高風險不同）
 * - `generatedAt`：本函式計算時間，非資料匯入時間；`updatedAt` 未接治理表時為 null。
 * 詳見 docs/analytics-and-reports-metric-definitions.md。
 */
async function getLearningJourneyCoreKpi(semesterId) {
  const sem = String(semesterId || '').trim();
  const generatedAt = new Date().toISOString();
  const baseUnavailable = {
    semesterId: sem,
    rosterActiveStudentCount: null,
    validBestScoreStudentCount: null,
    attainedStudentCount: null,
    attainmentRate: null,
    highRiskStudentCount: null,
    highRiskNote: null,
    generatedAt,
    updatedAt: null,
    dataStatus: 'unavailable',
    dataStatusNote: '無法載入學習歷程核心指標'
  };

  if (!SEMESTER_RANGES[sem]) {
    return {
      ...baseUnavailable,
      dataStatusNote: '不支援的學期'
    };
  }

  try {
    const snapshots = await EtEnrollmentSnapshot.findAll({
      where: { semesterId: sem, isActive: true },
      attributes: ['studentId'],
      raw: true
    });
    const rosterIds = [
      ...new Set(
        (snapshots || [])
          .map((r) => String(r.studentId || '').trim().toUpperCase())
          .filter(Boolean)
      )
    ];
    const rosterActiveStudentCount = rosterIds.length;

    if (rosterActiveStudentCount === 0) {
      return {
        semesterId: sem,
        rosterActiveStudentCount: 0,
        validBestScoreStudentCount: 0,
        attainedStudentCount: 0,
        attainmentRate: 0,
        highRiskStudentCount: 0,
        highRiskNote: null,
        generatedAt,
        updatedAt: null,
        dataStatus: 'partial',
        dataStatusNote:
          '本學期尚無英語學習歷程 active 名冊（EtEnrollmentSnapshot）。若已於學習歷程中心匯入名冊，請確認學期代碼一致。'
      };
    }

    const bestMap = await getStudentsBestSkillsMap(rosterIds);
    let validBestScoreStudentCount = 0;
    let attainedStudentCount = 0;

    for (const sid of rosterIds) {
      const best = bestMap.get(sid) || {};
      let hasValid = false;
      let attained = false;
      for (const sk of SKILLS) {
        const cell = best[sk];
        const rank = cell && cell.rank != null ? Number(cell.rank) : NaN;
        if (Number.isFinite(rank) && rank >= 1) {
          hasValid = true;
        }
        if (Number.isFinite(rank) && rank >= LJ_ATTAINMENT_MIN_RANK) {
          attained = true;
          break;
        }
      }
      if (hasValid) validBestScoreStudentCount += 1;
      if (attained) attainedStudentCount += 1;
    }

    let highRiskStudentCount = null;
    let highRiskNote = null;
    try {
      const risks = await riskDetectionService.computeRisksForStudentIds(rosterIds, sem, {});
      highRiskStudentCount = risks.filter((r) => r.riskLevel === 'high').length;
    } catch (_) {
      highRiskStudentCount = null;
      highRiskNote = '高風險人數暫無法計算（風險模組或關聯資料異常）';
    }

    const attainmentRate =
      rosterActiveStudentCount > 0
        ? Number(((attainedStudentCount / rosterActiveStudentCount) * 100).toFixed(1))
        : 0;

    let dataStatus = 'complete';
    let dataStatusNote = null;
    if (validBestScoreStudentCount === 0) {
      dataStatus = 'partial';
      dataStatusNote =
        '已有追蹤名冊，但尚未匯入可判讀之英檢／技能成績（et_exam_attempts 無有效 skill 列）。';
    }

    return {
      semesterId: sem,
      rosterActiveStudentCount,
      validBestScoreStudentCount,
      attainedStudentCount,
      attainmentRate,
      highRiskStudentCount,
      highRiskNote,
      generatedAt,
      updatedAt: null,
      dataStatus,
      dataStatusNote
    };
  } catch (e) {
    return {
      ...baseUnavailable,
      dataStatusNote: e && e.message ? String(e.message) : '學習歷程核心指標載入失敗'
    };
  }
}

/**
 * 班級／行政總覽：母體為該學期 `class_memberships`（DISTINCT studentId 聚合至 KPI）。
 * `highRiskStudentCount`：**班級名冊**內 riskLevel=high 之學生人數（與 `learningJourneyCoreKpi.highRiskStudentCount`
 * 之 **LJ active roster** 母體不同，禁止在 UI 混用同一稱呼）。詳見 docs/analytics-and-reports-metric-definitions.md。
 */
async function getAdminOverview(semester) {
  if (!SEMESTER_RANGES[semester]) {
    throw new Error('不支援的學期');
  }
  const cacheKey = `overview:v2-lj-core:${semester}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const memberships = await ClassMembership.findAll({
    where: { semester },
    attributes: ['studentId', 'classId', 'grade', 'department'],
    raw: true
  });
  const studentIds = kpiService.normalizeStudentIds(memberships.map((m) => m.studentId));
  const totalStudents = studentIds.length;

  if (totalStudents === 0) {
    const empty = {
      semester,
      totalStudents: 0,
      participationRate: 0,
      avgParticipationCount: 0,
      bestepRegistrationRate: 0,
      bestepAttendanceRate: 0,
      bestepPassRate: 0,
      exemptionApprovedRate: 0,
      surveyCompletionRate: 0,
      violationRate: 0,
      highRiskStudentCount: 0,
      distribution: { riskLevelCounts: { low: 0, medium: 0, high: 0 } },
      surveyCrossAnalysis: null,
      byGrade: [],
      byDepartment: [],
      top10Classes: [],
      highRiskClasses: []
    };
    empty.learningJourneyCoreKpi = await getLearningJourneyCoreKpi(semester);
    setCache(cacheKey, empty, OVERVIEW_CACHE_TTL_MS);
    return empty;
  }

  const context = await kpiService.buildKpiContext(studentIds, semester);
  const participationMetrics = await kpiService.getParticipationMetrics(studentIds, semester, { context });
  const registrationMetrics = await kpiService.getBestepRegistrationMetrics(studentIds, semester, { context });
  const attendanceMetrics = await kpiService.getBestepAttendanceMetrics(studentIds, semester, {
    context,
    registrationMetrics
  });
  const passMetrics = await kpiService.getBestepPassMetrics(studentIds, semester, {
    context,
    attendanceMetrics
  });
  const exemptionMetrics = await kpiService.getExemptionMetrics(studentIds, semester, { context });
  const surveyMetrics = await kpiService.getSurveyMetrics(studentIds, semester, { context });
  const violationMetrics = await kpiService.getViolationMetrics(studentIds, semester, { context });

  const risks = await riskDetectionService.getRisksForStudents(studentIds, semester, { context });
  const riskLevelCounts = { low: 0, medium: 0, high: 0 };
  const highRiskStudentIds = new Set();
  risks.forEach((r) => {
    riskLevelCounts[r.riskLevel] = (riskLevelCounts[r.riskLevel] || 0) + 1;
    if (r.riskLevel === 'high') highRiskStudentIds.add(r.studentId);
  });

  const uniqueStudentMembership = {};
  memberships.forEach((m) => {
    const sid = kpiService.normalizeStudentIds([m.studentId])[0];
    if (!sid) return;
    if (!uniqueStudentMembership[sid]) uniqueStudentMembership[sid] = m;
  });

  const surveyCrossAnalysis = computeSurveyCrossAnalysis(studentIds, context);
  const { byGrade, byDepartment } = buildGroupStats(uniqueStudentMembership, highRiskStudentIds);
  const { top10Classes, highRiskClasses } = await buildClassRiskRanking(uniqueStudentMembership, highRiskStudentIds);

  const result = {
    semester,
    totalStudents,
    participationRate: participationMetrics.participationRate,
    avgParticipationCount: participationMetrics.avgParticipationCount,
    bestepRegistrationRate: registrationMetrics.bestepRegistrationRate,
    bestepAttendanceRate: attendanceMetrics.bestepAttendanceRate,
    bestepPassRate: passMetrics.bestepPassRate,
    exemptionApprovedRate: exemptionMetrics.exemptionApprovedRate,
    surveyCompletionRate: surveyMetrics.surveyCompletionRate,
    violationRate: violationMetrics.violationRate,
    highRiskStudentCount: highRiskStudentIds.size,
    distribution: { riskLevelCounts },
    surveyCrossAnalysis,
    byGrade,
    byDepartment,
    top10Classes,
    highRiskClasses
  };

  result.learningJourneyCoreKpi = await getLearningJourneyCoreKpi(semester);

  setCache(cacheKey, result, OVERVIEW_CACHE_TTL_MS);
  return result;
}

function safePct(n, d) {
  const dn = typeof d === 'number' ? d : Number(d);
  const nn = typeof n === 'number' ? n : Number(n);
  if (!dn || Number.isNaN(dn)) return 0;
  if (Number.isNaN(nn)) return 0;
  return Number(((nn / dn) * 100).toFixed(2));
}

function toSeries(rows, mapFn) {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapFn).filter(Boolean);
}

function normalizeEventType(t) {
  const s = t == null ? '' : String(t).trim();
  return s || '未分類';
}

function buildCapacityBreakdownPayload({ semester, start, end, byEventType, byEvent }) {
  const items = (Array.isArray(byEventType) ? byEventType : []).map((row) => ({
    eventType: row.eventType,
    reservedCount: Number(row.totalReservations || 0),
    capacity: Number(row.totalEventCapacity || 0),
    utilizationRate: Number(row.bookingRate || 0),
  }));
  const summary = items.reduce(
    (acc, row) => {
      acc.reservedCount += Number(row.reservedCount || 0);
      acc.capacity += Number(row.capacity || 0);
      return acc;
    },
    { reservedCount: 0, capacity: 0, utilizationRate: 0 }
  );
  summary.utilizationRate = safePct(summary.reservedCount, summary.capacity);

  return {
    semester,
    range: {
      startDate: start,
      endDate: end,
    },
    items,
    summary,
    byEventType,
    byEvent,
  };
}

/**
 * Phase 8：預約營運分析（SQL aggregation）。母體：reservations × events（學期日期區間）。
 *
 * 回傳欄位 `englishPassRate` 為 **legacy 營運指標**：english_test_registrations.hasCEFRB2 為肯定值之比例。
 * 不得稱為 Learning Journey canonical 達標率（與 learningJourneyCoreKpi.attainmentRate 無關）。
 * 詳見 docs/analytics-and-reports-metric-definitions.md。
 *
 * KPI：
 * - 總預約數
 * - bookingRate：總預約數 ÷ 學期日期區間內各活動 maxCapacity 加總（名額利用率）
 * - 出席率（已簽到 / 總預約）
 * - 違規率（已登記違規 / 總預約）
 * - englishPassRate：legacy hasCEFRB2 標記比例（勿命名為達標率）
 */
async function getReservationOverview(semester) {
  if (!SEMESTER_RANGES[semester]) {
    throw new Error('不支援的學期');
  }
  const { start, end } = SEMESTER_RANGES[semester];

  const overviewSql = `
    SELECT
      COUNT(*) AS totalReservations,
      SUM(CASE WHEN r.checkinStatus = '已簽到' THEN 1 ELSE 0 END) AS attendedCount,
      SUM(CASE WHEN r.checkinStatus = '已登記違規' THEN 1 ELSE 0 END) AS violationCount,
      (
        SELECT COALESCE(SUM(e2.maxCapacity), 0)
        FROM events e2
        WHERE ${sqlEventDateInSemesterRange('e2')}
      ) AS totalEventCapacity
    FROM reservations r
    INNER JOIN events e ON e.id = r.eventId
    WHERE ${sqlEventDateInSemesterRange('e')}
  `;

  // QueryTypes.SELECT：query 直接回傳列陣列，不可寫成 const [rows] = await query(...)（會誤取第一列當「整份結果」）
  const ovRows = await sequelize.query(overviewSql, {
    replacements: { start, end },
    type: sequelize.QueryTypes.SELECT,
    raw: true,
  });

  const ov = (Array.isArray(ovRows) && ovRows[0]) || {};

  const totalReservations = Number(ov?.totalReservations || 0);
  const attendedCount = Number(ov?.attendedCount || 0);
  const violationCount = Number(ov?.violationCount || 0);
  const totalEventCapacity = Number(ov?.totalEventCapacity || 0);

  const bookingRate = safePct(totalReservations, totalEventCapacity);
  const attendanceRate = safePct(attendedCount, totalReservations);
  const violationRate = safePct(violationCount, totalReservations);

  const englishSql = `
    SELECT
      COUNT(*) AS totalRegistrations,
      SUM(
        CASE
          WHEN et.hasCEFRB2 IN ('是', 'true', 'yes', '1') THEN 1
          ELSE 0
        END
      ) AS passCount
    FROM english_test_registrations et
    WHERE et.semester = :semester
  `;

  const enRows = await sequelize.query(englishSql, {
    replacements: { semester },
    type: sequelize.QueryTypes.SELECT,
    raw: true,
  });

  const en = (Array.isArray(enRows) && enRows[0]) || {};

  const totalRegistrations = Number(en?.totalRegistrations || 0);
  const passCount = Number(en?.passCount || 0);
  const englishPassRate = safePct(passCount, totalRegistrations);
  const capacityBreakdown = await getReservationCapacityBreakdown(semester);

  return {
    semester,
    totalReservations,
    totalEventCapacity,
    bookingRate,
    attendanceRate,
    violationRate,
    englishPassRate,
    capacityBreakdown,
  };
}

async function getReservationActivityTrends(semester) {
  if (!SEMESTER_RANGES[semester]) {
    throw new Error('不支援的學期');
  }
  const { start, end } = SEMESTER_RANGES[semester];

  const sql = `
    SELECT
      CAST(TRIM(e.date) AS DATE) AS date,
      COUNT(*) AS reservationsCount
    FROM reservations r
    INNER JOIN events e ON e.id = r.eventId
    WHERE ${sqlEventDateInSemesterRange('e')}
    GROUP BY CAST(TRIM(e.date) AS DATE)
    ORDER BY date ASC
  `;

  const rows = await sequelize.query(sql, {
    replacements: { start, end },
    type: sequelize.QueryTypes.SELECT,
    raw: true,
  });

  return toSeries(rows, (row) => ({
    date: row.date,
    reservationsCount: Number(row.reservationsCount || 0),
  }));
}

async function getReservationEventsAttendanceTrend(semester) {
  if (!SEMESTER_RANGES[semester]) {
    throw new Error('不支援的學期');
  }
  const { start, end } = SEMESTER_RANGES[semester];

  const sql = `
    SELECT
      CAST(TRIM(e.date) AS DATE) AS date,
      SUM(CASE WHEN r.checkinStatus = '已簽到' THEN 1 ELSE 0 END) AS attendedCount,
      COUNT(*) AS totalCount
    FROM reservations r
    INNER JOIN events e ON e.id = r.eventId
    WHERE ${sqlEventDateInSemesterRange('e')}
    GROUP BY CAST(TRIM(e.date) AS DATE)
    ORDER BY date ASC
  `;

  const rows = await sequelize.query(sql, {
    replacements: { start, end },
    type: sequelize.QueryTypes.SELECT,
    raw: true,
  });

  return toSeries(rows, (row) => {
    const totalCount = Number(row.totalCount || 0);
    const attendedCount = Number(row.attendedCount || 0);
    return {
      date: row.date,
      attendanceRate: safePct(attendedCount, totalCount),
    };
  });
}

/**
 * 名額利用率分項：依 eventType 加總名額與預約數；依各場次 events 列出名額與預約數。
 * 日期篩選與 getReservationOverview 一致（SEMESTER_RANGES）。
 */
async function getReservationCapacityBreakdown(semester) {
  if (!SEMESTER_RANGES[semester]) {
    throw new Error('不支援的學期');
  }
  const { start, end } = SEMESTER_RANGES[semester];

  const byTypeSql = `
    SELECT
      eventType,
      SUM(maxCapacity) AS totalEventCapacity,
      SUM(totalReservations) AS totalReservations
    FROM (
      SELECT
        e.id AS eventId,
        e.eventType AS eventType,
        e.maxCapacity AS maxCapacity,
        COUNT(r.id) AS totalReservations
      FROM events e
      LEFT JOIN reservations r ON r.eventId = e.id
      WHERE ${sqlEventDateInSemesterRange('e')}
      GROUP BY e.id, e.eventType, e.maxCapacity
    ) perEvent
    GROUP BY eventType
    ORDER BY eventType ASC
  `;

  const byEventSql = `
    SELECT
      e.id AS eventId,
      e.name AS eventName,
      e.date AS eventDate,
      e.eventType AS eventType,
      e.maxCapacity AS maxCapacity,
      COUNT(r.id) AS totalReservations
    FROM events e
    LEFT JOIN reservations r ON r.eventId = e.id
    WHERE ${sqlEventDateInSemesterRange('e')}
    GROUP BY e.id, e.name, e.date, e.eventType, e.maxCapacity
    ORDER BY CAST(TRIM(e.date) AS DATE) ASC, e.name ASC, e.id ASC
  `;

  const byTypeRows = await sequelize.query(byTypeSql, {
    replacements: { start, end },
    type: sequelize.QueryTypes.SELECT,
    raw: true,
  });
  const byEventRows = await sequelize.query(byEventSql, {
    replacements: { start, end },
    type: sequelize.QueryTypes.SELECT,
    raw: true,
  });

  const byEventType = (Array.isArray(byTypeRows) ? byTypeRows : []).map((row) => {
    const totalEventCapacity = Number(row.totalEventCapacity || 0);
    const totalReservations = Number(row.totalReservations || 0);
    return {
      eventType: normalizeEventType(row.eventType),
      totalEventCapacity,
      totalReservations,
      bookingRate: safePct(totalReservations, totalEventCapacity),
    };
  });

  const byEvent = (Array.isArray(byEventRows) ? byEventRows : []).map((row) => {
    const maxCapacity = Number(row.maxCapacity || 0);
    const totalReservations = Number(row.totalReservations || 0);
    return {
      eventId: Number(row.eventId || 0),
      eventName: row.eventName != null ? String(row.eventName) : '',
      eventDate: row.eventDate,
      eventType: normalizeEventType(row.eventType),
      maxCapacity,
      totalReservations,
      bookingRate: safePct(totalReservations, maxCapacity),
    };
  });

  const payload = buildCapacityBreakdownPayload({ semester, start, end, byEventType, byEvent });

  if (process.env.NODE_ENV !== 'production') {
    const totals = payload.summary || {};
    console.debug('[EEARS Analytics] reservation-capacity-breakdown', {
      semester,
      startDate: start,
      endDate: end,
      rowCount: payload.items.length,
      reservedTotal: totals.reservedCount,
      capacityTotal: totals.capacity,
    });
  }

  return payload;
}

async function getReservationClassRankings(semester, { limit = 10 } = {}) {
  if (!SEMESTER_RANGES[semester]) {
    throw new Error('不支援的學期');
  }
  const { start, end } = SEMESTER_RANGES[semester];
  const lim = Number(limit) > 0 ? Number(limit) : 10;

  const sql = `
    SELECT
      c.id AS classId,
      c.name AS className,
      COUNT(*) AS reservationsCount,
      SUM(CASE WHEN r.checkinStatus = '已簽到' THEN 1 ELSE 0 END) AS attendedCount,
      SUM(CASE WHEN r.checkinStatus = '已登記違規' THEN 1 ELSE 0 END) AS violationCount,
      SUM(CASE WHEN r.checkinStatus = '已簽到' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS attendanceRate,
      SUM(CASE WHEN r.checkinStatus = '已登記違規' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS violationRate
    FROM class_memberships m
    INNER JOIN classes c ON c.id = m.classId
    INNER JOIN reservations r ON r.studentId = m.studentId
    INNER JOIN events e ON e.id = r.eventId
    WHERE m.semester = :semester
      AND c.semester = :semester
      AND ${sqlEventDateInSemesterRange('e')}
    GROUP BY c.id, c.name
    ORDER BY violationRate DESC
    LIMIT ${lim}
  `;

  const rows = await sequelize.query(sql, {
    replacements: { semester, start, end },
    type: sequelize.QueryTypes.SELECT,
    raw: true,
  });

  return toSeries(rows, (row) => ({
    classId: Number(row.classId || 0),
    className: row.className || null,
    reservationsCount: Number(row.reservationsCount || 0),
    attendanceRate: Number(row.attendanceRate || 0),
    violationRate: Number(row.violationRate || 0),
  }));
}

module.exports = {
  getAdminOverview,
  getLearningJourneyCoreKpi,
  // Phase 8 reservation analytics
  getReservationOverview,
  getReservationActivityTrends,
  getReservationEventsAttendanceTrend,
  getReservationCapacityBreakdown,
  getReservationClassRankings,
};

