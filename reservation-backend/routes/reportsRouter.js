const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const reportController = require('../controllers/reportController');
const { Class } = require('../models');
const { buildAccessProfile } = require('../auth/accessProfile');
const {
  assertCanAccessClass,
  sendClassScopeDenied,
} = require('../services/accessControl/classScopeGuard');

function requireFullCenterReportScope(req, res, next) {
  const profile = req.accessProfile || buildAccessProfile(req.user);
  if (profile.isAdmin || profile.hasAdminRights) return next();
  return res.status(403).json({
    success: false,
    errorCode: 'REPORT_SCOPE_DENIED',
    message: '您沒有存取此報表資料的權限。',
  });
}

function requireTeacherReportScope(req, res, next) {
  const profile = req.accessProfile || buildAccessProfile(req.user);
  if (profile.isAdmin || profile.hasAdminRights) return next();
  const requestedTeacherId = Number(req.params.teacherId);
  const userId = Number(req.user?.id);
  if (Number.isInteger(requestedTeacherId) && Number.isInteger(userId) && requestedTeacherId === userId) {
    return next();
  }
  return res.status(403).json({
    success: false,
    errorCode: 'REPORT_SCOPE_DENIED',
    message: '您沒有存取此報表資料的權限。',
  });
}

async function requireClassReportScope(req, res, next) {
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

// PDF/Excel 報表下載：與前台「分析與報表」一致，限管理員或執行長
router.use('/reports', authMiddleware, requirePermission(P.CAN_EXPORT_REPORTS));

router.get('/reports/class/:classId', requireClassReportScope, reportController.getClassReport);
router.get('/reports/teacher/:teacherId', requireTeacherReportScope, reportController.getTeacherReport);
router.get('/reports/overview', requireFullCenterReportScope, reportController.getOverviewReport);
router.get('/reports/high-risk', requireFullCenterReportScope, reportController.getHighRiskReport);

module.exports = router;

