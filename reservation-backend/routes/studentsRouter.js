const express = require('express');
const { authMiddleware, requirePermission, P } = require('../middlewares/auth');
const { assertCanAccessStudent, sendStudentScopeDenied } = require('../services/accessControl/studentScopeGuard');
const studentProfileService = require('../services/studentProfileService');

const router = express.Router();

async function requireStudentProfileScope(req, res, next) {
  try {
    await assertCanAccessStudent(req.user, req.params.studentId, {
      semester: req.query.semester || req.query.fromSemester || req.query.toSemester,
      sourceModule: 'students_legacy_profile',
    });
    return next();
  } catch (err) {
    if (err.status === 403) {
      err.requestId = req.requestId;
      return sendStudentScopeDenied(res, err);
    }
    return next(err);
  }
}

// Deprecated compatibility endpoint for the legacy/MVP student profile.
// New student profile screens should use /api/admin/learning-journey-v3/*.
router.get('/students/:studentId/profile', authMiddleware, requirePermission(P.CAN_VIEW_ANALYTICS), requireStudentProfileScope, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { fromSemester, toSemester } = req.query;
    const data = await studentProfileService.getStudentProfile(studentId, { fromSemester, toSemester });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

