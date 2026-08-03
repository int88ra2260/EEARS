const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission, requireSystemPermission, P } = require('../middlewares/auth');
const analyticsController = require('../controllers/analyticsController');
const { buildAccessProfile } = require('../auth/accessProfile');
const { Class } = require('../models');
const { assertCanAccessClass, sendClassScopeDenied } = require('../services/accessControl/classScopeGuard');
const { assertCanAccessStudent, sendStudentScopeDenied } = require('../services/accessControl/studentScopeGuard');

const adminOnlyAnalytics = requireSystemPermission(P.CAN_VIEW_ANALYTICS);

/** 教學儀表板：不依賴 table 是否已 seed can_view_analytics；老師以 can_view_classes 即可看本人儀表板 */
function requireTeacherDashboardAccess(req, res, next) {
  const profile = req.accessProfile || buildAccessProfile(req.user);
  if (profile.isAdmin || profile.hasAdminRights) return next();
  if (profile.permissionSet.has(P.CAN_VIEW_ANALYTICS)) return next();
  if (profile.isTeacher && profile.permissionSet.has(P.CAN_VIEW_CLASSES)) return next();
  return res.status(403).json({
    success: false,
    code: 'INSUFFICIENT_PERMISSIONS',
    error: '權限不足',
    message: '您沒有檢視教學儀表板的權限。',
  });
}

/** 行政中心總覽／風險：admin 或執行長（hasAdminRights） */
function requireFullCenterAnalytics(req, res, next) {
  const profile = req.accessProfile || buildAccessProfile(req.user);
  if (profile.isAdmin || profile.hasAdminRights) return next();
  return res.status(403).json({
    success: false,
    errorCode: 'ANALYTICS_SCOPE_DENIED',
    message: '您沒有存取此分析資料的權限。',
  });
}

/** 教學綜合趨勢（全校 proxy）：admin／executive，或具分析權的活動負責人老師 */
function requireTeachingImpactTrends(req, res, next) {
  const profile = req.accessProfile || buildAccessProfile(req.user);
  if (profile.isAdmin || profile.hasAdminRights) return next();
  const managerLevels = new Set(['et_manager', 'if_manager', 'jt_manager']);
  if (
    profile.role === 'teacher'
    && managerLevels.has(profile.teacherLevel || '')
    && profile.permissionSet.has(P.CAN_VIEW_ANALYTICS)
  ) {
    return next();
  }
  return res.status(403).json({
    success: false,
    errorCode: 'ANALYTICS_SCOPE_DENIED',
    message: '您沒有存取此分析資料的權限。',
  });
}

async function requireAnalyticsClassScope(req, res, next) {
  try {
    const classRecord = await Class.findByPk(req.params.classId);
    if (!classRecord) return res.status(404).json({ error: '找不到班級' });
    await assertCanAccessClass(req.user, classRecord);
    return next();
  } catch (err) {
    if (err.status === 403) return sendClassScopeDenied(res, err);
    return next(err);
  }
}

async function requireAnalyticsStudentParamScope(req, res, next) {
  try {
    await assertCanAccessStudent(req.user, req.params.studentId, {
      semester: req.query.semester || req.query.fromSemester || req.query.toSemester,
      sourceModule: 'analytics',
    });
    return next();
  } catch (err) {
    if (err.status === 403) return sendStudentScopeDenied(res, err);
    return next(err);
  }
}

async function requireAnalyticsStudentQueryScope(req, res, next) {
  if (String(req.query.kind || '').trim().toLowerCase() === 'reservation') {
    return adminOnlyAnalytics(req, res, next);
  }
  try {
    await assertCanAccessStudent(req.user, req.query.studentId, {
      semester: req.query.semester || req.query.fromSemester || req.query.toSemester,
      sourceModule: 'analytics',
    });
    return next();
  } catch (err) {
    if (err.status === 403) return sendStudentScopeDenied(res, err);
    return next(err);
  }
}

// 學習歷程／行政分析 API：依路由分別檢查權限（避免 table-first 缺 can_view_analytics 時阻擋教師儀表板）
router.use('/analytics', authMiddleware);

router.get(
  '/analytics/students/:studentId',
  requirePermission(P.CAN_VIEW_ANALYTICS),
  requireAnalyticsStudentParamScope,
  analyticsController.getStudentProfile
);
router.get(
  '/analytics/classes/:classId',
  requirePermission(P.CAN_VIEW_ANALYTICS),
  requireAnalyticsClassScope,
  analyticsController.getClassEvaluation
);
router.get('/analytics/overview', requireFullCenterAnalytics, analyticsController.getOverview);
router.get('/analytics/classes', requireFullCenterAnalytics, analyticsController.getReservationClasses);
router.get('/analytics/events', requireFullCenterAnalytics, analyticsController.getReservationEvents);
router.get(
  '/analytics/reservation-capacity-breakdown',
  requireFullCenterAnalytics,
  analyticsController.getReservationCapacityBreakdown
);
router.get('/analytics/risk', requireFullCenterAnalytics, analyticsController.getRisk);
router.get(
  '/analytics/risk/predict/:studentId',
  requirePermission(P.CAN_VIEW_ANALYTICS),
  requireAnalyticsStudentParamScope,
  analyticsController.predictRisk
);
router.get(
  '/analytics/teachers/:teacherId/dashboard',
  requireTeacherDashboardAccess,
  analyticsController.getTeacherDashboard
);
router.get(
  '/analytics/trends',
  requirePermission(P.CAN_VIEW_ANALYTICS),
  requireAnalyticsStudentQueryScope,
  analyticsController.getStudentTrends
);
router.get(
  '/analytics/trends/classes/:classId',
  requirePermission(P.CAN_VIEW_ANALYTICS),
  requireAnalyticsClassScope,
  analyticsController.getClassTrends
);
router.get('/analytics/trends/overview', requireTeachingImpactTrends, analyticsController.getOverviewTrends);

module.exports = router;
