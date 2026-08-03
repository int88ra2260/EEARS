// routes/teacherRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission, requireSystemPermission, P } = require('../middlewares/auth');
const { hasAnyPermission } = require('../auth/accessProfile');

function requireTeacherAccessDebugViewer(req, res, next) {
  if (req.user?.role === 'admin') return next();
  if (hasAnyPermission(req.user, [P.CAN_VIEW_AUDIT_LOGS, P.CAN_VIEW_INTERNAL_DIAGNOSTICS])) {
    return next();
  }
  return res.status(403).json({
    success: false,
    code: 'ACCESS_DEBUG_DENIED',
    error: '您沒有檢視權限來源的權限。',
  });
}

const manageAccountsAuth = [authMiddleware, requirePermission(P.CAN_MANAGE_ACCOUNTS)];
// 系統級：僅 admin 可執行（例如未來拆分 admin 帳號管理時可用）
const systemAccountsAuth = [authMiddleware, requireSystemPermission(P.CAN_MANAGE_ACCOUNTS)];
const {
  createTeacher,
  getTeachers,
  getTeacherClasses,
  getStudentParticipation,
  updateTeacher,
  deleteTeacher,
  resetTeacherPassword,
  changeOwnPassword,
  getTeacherAccessDebug,
} = require('../controllers/teacherController');

// 老師查看學生參與狀況（需要登入）
router.get('/teachers/students/participation', authMiddleware, getStudentParticipation);

// 老師自行變更密碼
router.post('/teachers/change-password', authMiddleware, changeOwnPassword);

// 管理員帳號相關路由
router.post('/admin/teachers', ...manageAccountsAuth, createTeacher);
router.get('/admin/teachers', ...manageAccountsAuth, getTeachers);
router.patch('/admin/teachers/:teacherId', ...manageAccountsAuth, updateTeacher);
router.delete('/admin/teachers/:teacherId', ...manageAccountsAuth, deleteTeacher);
router.post('/admin/teachers/:teacherId/reset-password', ...manageAccountsAuth, resetTeacherPassword);
router.get('/admin/teachers/:teacherId/classes', ...manageAccountsAuth, getTeacherClasses);
router.get(
  '/admin/teachers/:teacherId/access-debug',
  authMiddleware,
  requireTeacherAccessDebugViewer,
  getTeacherAccessDebug
);

module.exports = router;
