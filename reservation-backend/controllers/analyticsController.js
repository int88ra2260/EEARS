// controllers/analyticsController.js — 薄層：僅轉呼叫 service
const { buildAccessProfile } = require('../auth/accessProfile');
const { createAPIError } = require('../utils/errorMessages');
const { Class } = require('../models');
const { assertCanAccessClass, sendClassScopeDenied } = require('../services/accessControl/classScopeGuard');
const { assertCanAccessStudent, sendStudentScopeDenied } = require('../services/accessControl/studentScopeGuard');
const studentProfileService = require('../services/studentProfileService');
const classEvaluationService = require('../services/classEvaluationService');
const analyticsService = require('../services/analyticsService');
const teacherEvaluationService = require('../services/teacherEvaluationService');
const riskDetectionService = require('../services/riskDetectionService');
const trendAnalysisService = require('../services/trendAnalysisService');

/**
 * 教師儀表板：避免以 CAN_VIEW_ANALYTICS 橫向查詢任意 teacherId。
 * - role=admin（系統內無 super_admin 列舉值，admin 即最高管理員）：可查任意 teacherId。
 * - hasAdminRights（含 teacherLevel=executive）：與既有治理一致，可查任意 teacherId（是否應限縮由營運另議）。
 * - 其餘（一般 teacher、office_staff、worker 等）：僅能查 JWT 對應之本人 Teacher.id。
 */
function sendTeacherDashboardForbidden(req, res, detailZh) {
  const apiError = createAPIError('INSUFFICIENT_PERMISSIONS', 403, detailZh || undefined);
  return res.status(403).json({
    ...apiError,
    code: 'INSUFFICIENT_PERMISSIONS',
    success: false,
    requestId: req.requestId || undefined,
  });
}

function isFullCenterAnalyticsUser(req) {
  const profile = req.accessProfile || buildAccessProfile(req.user);
  return profile.isAdmin || profile.hasAdminRights;
}

function sendAnalyticsScopeDenied(req, res, message = '您沒有存取此分析資料的權限。') {
  const apiError = createAPIError('ANALYTICS_SCOPE_DENIED', 403, message);
  return res.status(403).json({
    ...apiError,
    code: 'ANALYTICS_SCOPE_DENIED',
    success: false,
    requestId: req.requestId || undefined,
  });
}

async function assertAnalyticsClassScope(req, classId) {
  const classRecord = await Class.findByPk(classId);
  if (!classRecord) {
    const err = new Error('找不到班級');
    err.status = 404;
    throw err;
  }
  await assertCanAccessClass(req.user, classRecord);
}

function assertTeacherDashboardScope(req, requestedTeacherId) {
  const tid = parseInt(requestedTeacherId, 10);
  if (!Number.isFinite(tid)) {
    return { ok: false, status: 400, body: { error: 'teacherId 無效' } };
  }
  const jwtId = req.user?.id != null ? Number(req.user.id) : NaN;
  const profile = req.accessProfile || buildAccessProfile(req.user);
  if (profile.hasAdminRights) {
    return { ok: true };
  }
  if (Number.isFinite(jwtId) && jwtId === tid) {
    return { ok: true };
  }
  return { ok: false, forbidden: true };
}

async function getStudentProfile(req, res, next) {
  try {
    const { studentId } = req.params;
    const { fromSemester, toSemester } = req.query;
    await assertCanAccessStudent(req.user, studentId, {
      semester: req.query.semester || fromSemester || toSemester,
      sourceModule: 'analytics',
    });
    const data = await studentProfileService.getStudentProfile(studentId, {
      fromSemester,
      toSemester
    });
    res.json(data);
  } catch (err) {
    if (err.status === 403) return sendStudentScopeDenied(res, err);
    next(err);
  }
}

async function getClassEvaluation(req, res, next) {
  try {
    const { classId } = req.params;
    const { semester } = req.query;
    if (!semester) {
      return res.status(400).json({ error: '請提供 query: semester' });
    }
    await assertAnalyticsClassScope(req, parseInt(classId, 10));
    const data = await classEvaluationService.getClassEvaluation(
      parseInt(classId, 10),
      String(semester).trim()
    );
    res.json(data);
  } catch (err) {
    if (err.message === '找不到班級' || err.message === '不支援的學期') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}


async function getOverview(req, res, next) {
  try {
    const { semester, kind } = req.query;
    if (!semester) {
      return res.status(400).json({ error: '請提供 query: semester' });
    }

    const kindStr = kind ? String(kind).trim().toLowerCase() : '';
    const semesterStr = String(semester).trim();

    // Phase 8：reservation analytics（以 query: kind=reservation 切換，不影響既有報表 API）
    const data =
      kindStr === 'reservation'
        ? await analyticsService.getReservationOverview(semesterStr)
        : await analyticsService.getAdminOverview(semesterStr);
    res.json(data);
  } catch (err) {
    if (err.message === '不支援的學期') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function getTeacherDashboard(req, res, next) {
  try {
    const { teacherId } = req.params;
    const { semester } = req.query;
    if (!semester) {
      return res.status(400).json({ error: '請提供 query: semester' });
    }

    const scope = assertTeacherDashboardScope(req, teacherId);
    if (!scope.ok) {
      if (scope.body) return res.status(scope.status).json(scope.body);
      if (scope.forbidden) {
        return sendTeacherDashboardForbidden(
          req,
          res,
          '無權限檢視指定教師的儀表板資料；一般帳號僅能檢視本人。'
        );
      }
    }

    const data = await teacherEvaluationService.getTeacherDashboard(
      parseInt(teacherId, 10),
      String(semester).trim()
    );
    res.json(data);
  } catch (err) {
    if (err.message === '不支援的學期' || err.message === 'semester is required' || err.message === 'teacherId is required') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function getRisk(req, res, next) {
  try {
    const { semester } = req.query;
    if (!semester) {
      return res.status(400).json({ error: '請提供 query: semester' });
    }

    // Phase 2 MVP：回傳該學期「高風險學生」列表（由 Service 統一處理 studentId 清洗與計算）
    const risks = await riskDetectionService.getHighRisksForSemester(String(semester).trim(), {
      participationThreshold: 2
    });

    res.json({
      semester: String(semester).trim(),
      risks
    });
  } catch (err) {
    if (err.message === '不支援的學期') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function getStudentTrends(req, res, next) {
  try {
    const { studentId, fromSemester, toSemester, semester, kind } = req.query;
    const kindStr = kind ? String(kind).trim().toLowerCase() : '';

    // Phase 8：reservation activity trends（以 query: kind=reservation 串接）
    if (kindStr === 'reservation') {
      if (!semester) return res.status(400).json({ error: '請提供 query: semester' });
      const data = await analyticsService.getReservationActivityTrends(String(semester).trim());
      return res.json({ activityTrend: data });
    }

    if (!studentId) return res.status(400).json({ error: '請提供 query: studentId' });
    const data = await trendAnalysisService.getStudentTrends(
      String(studentId).trim(),
      fromSemester ? String(fromSemester).trim() : null,
      toSemester ? String(toSemester).trim() : null
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getClassTrends(req, res, next) {
  try {
    const { classId } = req.params;
    const { fromSemester, toSemester } = req.query;
    const data = await trendAnalysisService.getClassTrends(
      parseInt(classId, 10),
      fromSemester ? String(fromSemester).trim() : null,
      toSemester ? String(toSemester).trim() : null
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getOverviewTrends(req, res, next) {
  try {
    const { fromSemester, toSemester } = req.query;
    const data = await trendAnalysisService.getOverviewTrends(
      fromSemester ? String(fromSemester).trim() : null,
      toSemester ? String(toSemester).trim() : null
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function predictRisk(req, res, next) {
  try {
    const { studentId } = req.params;
    const { semester } = req.query;
    if (!semester) return res.status(400).json({ error: '請提供 query: semester' });
    const data = await riskDetectionService.predictStudentRisk(String(studentId).trim(), String(semester).trim());
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getReservationClasses(req, res, next) {
  try {
    const { semester } = req.query;
    if (!semester) return res.status(400).json({ error: '請提供 query: semester' });
    const rankings = await analyticsService.getReservationClassRankings(String(semester).trim(), {
      limit: req.query.limit ? Number(req.query.limit) : 10,
    });
    res.json({ rankings });
  } catch (err) {
    if (err.message === '不支援的學期') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function getReservationEvents(req, res, next) {
  try {
    const { semester } = req.query;
    if (!semester) return res.status(400).json({ error: '請提供 query: semester' });
    const attendance = await analyticsService.getReservationEventsAttendanceTrend(String(semester).trim());
    res.json({ attendanceTrend: attendance });
  } catch (err) {
    if (err.message === '不支援的學期') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function getReservationCapacityBreakdown(req, res, next) {
  try {
    const { semester } = req.query;
    if (!semester) return res.status(400).json({ error: '請提供 query: semester' });
    const semesterStr = String(semester).trim();
    const data = await analyticsService.getReservationCapacityBreakdown(semesterStr);
    const payload = {
      semester: data?.semester || semesterStr,
      range: data?.range || null,
      items: Array.isArray(data?.items) ? data.items : [],
      summary: data?.summary || { reservedCount: 0, capacity: 0, utilizationRate: 0 },
      byEventType: Array.isArray(data?.byEventType) ? data.byEventType : [],
      byEvent: Array.isArray(data?.byEvent) ? data.byEvent : [],
    };
    const responseBody = {
      success: true,
      payload,
    };
    const body = JSON.stringify(responseBody);
    res.status(200);
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'X-Analytics-Shape': 'reservation-capacity-breakdown:v2',
      'X-Analytics-Item-Count': String(payload.items.length),
      'X-Analytics-By-Event-Count': String(payload.byEvent.length),
    });
    return res.send(body);
  } catch (err) {
    if (err.message === '不支援的學期') {
      return res.status(400).json({
        success: false,
        error: err.message,
        payload: {
          semester: req.query.semester ? String(req.query.semester).trim() : '',
          range: null,
          items: [],
          summary: { reservedCount: 0, capacity: 0, utilizationRate: 0 },
          byEventType: [],
          byEvent: [],
        },
      });
    }
    next(err);
  }
}

module.exports = {
  getStudentProfile,
  getClassEvaluation,
  getOverview,
  getTeacherDashboard,
  getRisk,
  getStudentTrends,
  getClassTrends,
  getOverviewTrends,
  predictRisk,
  // Phase 8：reservation analytics
  getReservationClasses,
  getReservationEvents,
  getReservationCapacityBreakdown,
};
