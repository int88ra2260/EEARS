'use strict';

const express = require('express');
const router = express.Router();
const {
  authMiddleware,
  requirePermission,
  requireAnyPermission,
  requirePermissionAndEventAccess,
  hasPermission,
  canAccessEventType,
  P,
} = require('../middlewares/auth');
const { Event } = require('../models');
const etGroupingService = require('../services/etGrouping/etGroupingService');
const etLeaderService = require('../services/etGrouping/etLeaderService');
const etTaskTemplateService = require('../services/etGrouping/etTaskTemplateService');
const etSessionTaskService = require('../services/etGrouping/etSessionTaskService');
const etLeaderPreferenceService = require('../services/etGrouping/etLeaderPreferenceService');
const etGroupingExportService = require('../services/etGrouping/etGroupingExportService');
const etGroupingReportService = require('../services/etGrouping/etGroupingReportService');
const etStudentInsightService = require('../services/etGrouping/etStudentInsightService');
const etStudentTrendService = require('../services/etGrouping/etStudentTrendService');
const etActivityRecommendationService = require('../services/etGrouping/etActivityRecommendationService');
const auditLogService = require('../services/auditLogService');

async function loadEventForAccess(req, res, next) {
  try {
    const event = await Event.findByPk(req.params.id || req.params.eventId, {
      attributes: ['id', 'eventType', 'date', 'name', 'semesterId', 'groupingMode'],
    });
    if (!event) return res.status(404).json({ success: false, message: '活動不存在' });
    req.accessEvent = event;
    next();
  } catch (err) {
    next(err);
  }
}

function accessEventType(req) {
  return req.accessEvent?.eventType;
}

function handleServiceError(res, err, next) {
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      code: err.code || 'ET_GROUPING_ERROR',
      message: err.message,
    });
  }
  return next(err);
}

const viewGroupingAuth = [
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_VIEW_ET_GROUPING, accessEventType),
];

const manageGroupingAuth = [
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_MANAGE_ET_GROUPING, accessEventType),
];

function taskMarkAccessFlags(req) {
  const canManage = hasPermission(req.user, P.CAN_MANAGE_ET_GROUPING);
  const canMark = hasPermission(req.user, P.CAN_MARK_ET_SESSION_TASKS);
  return { canManage, canMark };
}

const viewTaskMarksAuth = [
  authMiddleware,
  loadEventForAccess,
  (req, res, next) => {
    const { canManage, canMark } = taskMarkAccessFlags(req);
    if (!canManage && !canMark) {
      return res.status(403).json({ success: false, message: '無權限檢視任務勾選' });
    }
    if (!canAccessEventType(req.user, accessEventType(req))) {
      return res.status(403).json({ success: false, message: '無權限存取此活動類型' });
    }
    req.etTaskAccess = { canManage, canMark };
    return next();
  },
];

const saveTaskMarksAuth = viewTaskMarksAuth;

router.get(
  '/bands',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_ET_GROUPING),
  async (req, res, next) => {
    try {
      const semesterId = req.query.semesterId != null ? Number(req.query.semesterId) : null;
      const bands = await etGroupingService.listBands({ semesterId });
      res.json({ success: true, data: bands });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/bands',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_ET_GROUPING),
  async (req, res, next) => {
    try {
      const semesterId = req.body.semesterId != null ? Number(req.body.semesterId) : null;
      const bands = await etGroupingService.upsertBands(req.body.bands || [], { semesterId });
      auditLogService.logAuditAsync({
        module: 'et_grouping',
        action: 'update_band_configs',
        entityType: 'EtGroupBandConfig',
        targetSummary: `semesterId=${semesterId ?? 'global'}`,
        afterData: { bandCount: bands.length },
        req,
      });
      res.json({ success: true, data: bands });
    } catch (err) {
      if (err.message && !err.status) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next(err);
    }
  }
);

router.get('/events/:id/grouping', viewGroupingAuth, async (req, res, next) => {
  try {
    const data = await etGroupingService.getEventGrouping(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    return handleServiceError(res, err, next);
  }
});

router.post('/events/:id/grouping/generate', manageGroupingAuth, async (req, res, next) => {
  try {
    const force = Boolean(req.body?.force);
    const groupSlots = Array.isArray(req.body?.groupSlots) ? req.body.groupSlots : null;
    const groupingLayout = req.body?.groupingLayout === 'band_tables' ? 'band_tables' : 'physical_slots';
    const data = await etGroupingService.generateGrouping(req.params.id, {
      force,
      groupSlots,
      groupingLayout,
      userId: req.user?.id,
    });
    auditLogService.logAuditAsync({
      module: 'et_grouping',
      action: 'generate_grouping',
      entityType: 'Event',
      entityId: Number(req.params.id),
      targetSummary: `eventId=${req.params.id}`,
      afterData: {
        force,
        groupingLayout,
        groupSlots: data.plan?.abilityGroupSlots || [],
        studentCount: data.students?.length || 0,
      },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    return handleServiceError(res, err, next);
  }
});

router.patch('/events/:id/grouping/assignments', manageGroupingAuth, async (req, res, next) => {
  try {
    const data = await etGroupingService.patchAssignments(
      req.params.id,
      req.body?.patches || [],
      { userId: req.user?.id }
    );
    auditLogService.logAuditAsync({
      module: 'et_grouping',
      action: 'patch_assignments',
      entityType: 'Event',
      entityId: Number(req.params.id),
      targetSummary: `eventId=${req.params.id}`,
      afterData: { patchCount: (req.body?.patches || []).length },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    if (err.message && !err.status) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return handleServiceError(res, err, next);
  }
});

router.post('/events/:id/grouping/publish', manageGroupingAuth, async (req, res, next) => {
  try {
    const data = await etGroupingService.publishGrouping(req.params.id, { userId: req.user?.id });
    auditLogService.logAuditAsync({
      module: 'et_grouping',
      action: 'publish_grouping',
      entityType: 'Event',
      entityId: Number(req.params.id),
      targetSummary: `eventId=${req.params.id}`,
      afterData: { groupingMode: 'ability', groupCount: data.groupSummary?.length || 0 },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    return handleServiceError(res, err, next);
  }
});

router.get(
  '/leaders/candidates',
  authMiddleware,
  requireAnyPermission([P.CAN_MANAGE_ET_GROUPING, P.CAN_VIEW_ET_GROUPING]),
  async (req, res, next) => {
    try {
      const data = await etLeaderService.listLeaderCandidates();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/events/:id/group-leaders', viewGroupingAuth, async (req, res, next) => {
  try {
    const data = await etLeaderService.listGroupLeaders(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    return handleServiceError(res, err, next);
  }
});

router.put('/events/:id/group-leaders', manageGroupingAuth, async (req, res, next) => {
  try {
    const data = await etLeaderService.assignGroupLeaders(
      req.params.id,
      req.body?.assignments || [],
      { userId: req.user?.id }
    );
    if (req.body?.rememberPreference) {
      await etLeaderPreferenceService.rememberAssignmentsAsPreferences(
        req.accessEvent,
        req.body?.assignments || []
      );
    }
    auditLogService.logAuditAsync({
      module: 'et_grouping',
      action: 'assign_group_leaders',
      entityType: 'Event',
      entityId: Number(req.params.id),
      targetSummary: `eventId=${req.params.id}`,
      afterData: {
        assignmentCount: (req.body?.assignments || []).length,
        rememberPreference: Boolean(req.body?.rememberPreference),
      },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    if (err.message && !err.status) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return handleServiceError(res, err, next);
  }
});

router.post('/events/:id/group-leaders/apply-preferences', manageGroupingAuth, async (req, res, next) => {
  try {
    const data = await etLeaderPreferenceService.applyPreferencesToEvent(req.params.id, {
      userId: req.user?.id,
    });
    auditLogService.logAuditAsync({
      module: 'et_grouping',
      action: 'apply_leader_preferences',
      entityType: 'Event',
      entityId: Number(req.params.id),
      targetSummary: `eventId=${req.params.id}`,
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    if (err.message && !err.status) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return handleServiceError(res, err, next);
  }
});

router.get(
  '/leader-preferences',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_ET_GROUPING),
  async (req, res, next) => {
    try {
      const semesterId = req.query.semesterId != null ? Number(req.query.semesterId) : null;
      const data = await etLeaderPreferenceService.listPreferences({ semesterId });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/leader-preferences',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_ET_GROUPING),
  async (req, res, next) => {
    try {
      const semesterId = req.body.semesterId != null ? Number(req.body.semesterId) : null;
      const data = await etLeaderPreferenceService.upsertPreferences(req.body.preferences || [], { semesterId });
      auditLogService.logAuditAsync({
        module: 'et_grouping',
        action: 'update_leader_preferences',
        entityType: 'EtLeaderPreference',
        targetSummary: `semesterId=${semesterId ?? 'global'}`,
        afterData: { preferenceCount: (req.body.preferences || []).length },
        req,
      });
      res.json({ success: true, data });
    } catch (err) {
      if (err.message && !err.status) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next(err);
    }
  }
);

router.post(
  '/leader-preferences/apply-batch',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_ET_GROUPING),
  async (req, res, next) => {
    try {
      const eventIds = Array.isArray(req.body.eventIds) ? req.body.eventIds : [];
      const data = await etLeaderPreferenceService.applyPreferencesToEvents(eventIds, {
        userId: req.user?.id,
      });
      auditLogService.logAuditAsync({
        module: 'et_grouping',
        action: 'apply_leader_preferences_batch',
        entityType: 'Event',
        targetSummary: `eventIds=${eventIds.join(',')}`,
        afterData: {
          appliedCount: data.applied.length,
          errorCount: data.errors.length,
        },
        req,
      });
      res.json({ success: true, data });
    } catch (err) {
      if (err.message && !err.status) {
        return res.status(400).json({ success: false, message: err.message, errors: err.errors });
      }
      return handleServiceError(res, err, next);
    }
  }
);

router.get(
  '/leader-management/events',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_ET_GROUPING),
  async (req, res, next) => {
    try {
      const data = await etGroupingReportService.listLeaderManagementEvents({
        semesterId: req.query.semesterId != null ? Number(req.query.semesterId) : null,
        semesterLabel: req.query.semester || null,
        date: req.query.date || null,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/my-sessions',
  authMiddleware,
  requirePermission(P.CAN_MARK_ET_SESSION_TASKS),
  async (req, res, next) => {
    try {
      const data = await etGroupingReportService.listMyLeaderSessions(req.user?.id, {
        semesterId: req.query.semesterId != null ? Number(req.query.semesterId) : null,
        semesterLabel: req.query.semester || null,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/reports/student-trends',
  authMiddleware,
  requireAnyPermission([P.CAN_VIEW_ET_GROUPING, P.CAN_EXPORT_ET_GROUPING, P.CAN_MANAGE_ET_GROUPING]),
  async (req, res, next) => {
    try {
      const studentId = req.query.studentId || req.query.student_id;
      if (!studentId) {
        return res.status(400).json({ success: false, message: '請提供學號 studentId' });
      }
      const data = await etStudentTrendService.getStudentEtTrends(studentId, {
        semesterLabel: req.query.semester || null,
      });
      res.json({ success: true, data });
    } catch (err) {
      if (err.message && !err.status) {
        return res.status(400).json({ success: false, message: err.message });
      }
      return handleServiceError(res, err, next);
    }
  }
);

router.get(
  '/students/:studentId/insights',
  authMiddleware,
  requireAnyPermission([P.CAN_VIEW_ET_GROUPING, P.CAN_MANAGE_ET_GROUPING]),
  async (req, res, next) => {
    try {
      const data = await etStudentInsightService.getStudentEtInsights(req.params.studentId);
      res.json({ success: true, data });
    } catch (err) {
      if (err.message && !err.status) {
        return res.status(400).json({ success: false, message: err.message });
      }
      return handleServiceError(res, err, next);
    }
  }
);

router.get(
  '/students/:studentId/recommendations',
  authMiddleware,
  requireAnyPermission([P.CAN_VIEW_ET_GROUPING, P.CAN_MANAGE_ET_GROUPING]),
  async (req, res, next) => {
    try {
      const data = await etActivityRecommendationService.getEtActivityRecommendations(req.params.studentId, {
        limit: req.query.limit != null ? Number(req.query.limit) : 5,
      });
      res.json({ success: true, data });
    } catch (err) {
      if (err.message && !err.status) {
        return res.status(400).json({ success: false, message: err.message });
      }
      return handleServiceError(res, err, next);
    }
  }
);

router.get(
  '/reports/summary',
  authMiddleware,
  requireAnyPermission([P.CAN_VIEW_ET_GROUPING, P.CAN_EXPORT_ET_GROUPING, P.CAN_MANAGE_ET_GROUPING]),
  async (req, res, next) => {
    try {
      const data = await etGroupingReportService.getReportsSummary({
        semesterId: req.query.semesterId != null ? Number(req.query.semesterId) : null,
        semesterLabel: req.query.semester || null,
        date: req.query.date || null,
        dateFrom: req.query.dateFrom || null,
        dateTo: req.query.dateTo || null,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/reports/export',
  authMiddleware,
  requirePermission(P.CAN_EXPORT_ET_GROUPING),
  async (req, res, next) => {
    try {
      await etGroupingReportService.writeReportsSummaryExcel({
        semesterId: req.query.semesterId != null ? Number(req.query.semesterId) : null,
        semesterLabel: req.query.semester || null,
        date: req.query.date || null,
        dateFrom: req.query.dateFrom || null,
        dateTo: req.query.dateTo || null,
      }, res);
      auditLogService.logAuditAsync({
        module: 'et_grouping',
        action: 'export_reports_summary',
        entityType: 'EtGroupingReport',
        targetSummary: `semester=${req.query.semester || 'all'}`,
        req,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/events/:id/export',
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_EXPORT_ET_GROUPING, accessEventType),
  async (req, res, next) => {
    try {
      await etGroupingExportService.writeEventGroupingExcel(req.params.id, res);
      auditLogService.logAuditAsync({
        module: 'et_grouping',
        action: 'export_event_grouping_excel',
        entityType: 'Event',
        entityId: Number(req.params.id),
        targetSummary: `eventId=${req.params.id}`,
        req,
      });
    } catch (err) {
      return handleServiceError(res, err, next);
    }
  }
);

router.get(
  '/task-templates',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_ET_GROUPING),
  async (req, res, next) => {
    try {
      const semesterId = req.query.semesterId != null ? Number(req.query.semesterId) : null;
      const data = await etTaskTemplateService.listTaskTemplate({ semesterId });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/task-templates',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_ET_GROUPING),
  async (req, res, next) => {
    try {
      const semesterId = req.body.semesterId != null ? Number(req.body.semesterId) : null;
      const data = await etTaskTemplateService.upsertTaskTemplateItems(req.body.items || [], { semesterId });
      auditLogService.logAuditAsync({
        module: 'et_grouping',
        action: 'update_task_template',
        entityType: 'EtTaskTemplate',
        targetSummary: `semesterId=${semesterId ?? 'global'}`,
        afterData: { itemCount: data.items?.length || 0 },
        req,
      });
      res.json({ success: true, data });
    } catch (err) {
      if (err.message && !err.status) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next(err);
    }
  }
);

router.get('/events/:id/task-marks', viewTaskMarksAuth, async (req, res, next) => {
  try {
    const { canManage, canMark } = req.etTaskAccess;
    const data = await etSessionTaskService.getTaskMarksMatrix(req.params.id, {
      userId: req.user?.id,
      canManage,
      canMark,
    });
    res.json({ success: true, data });
  } catch (err) {
    return handleServiceError(res, err, next);
  }
});

router.put('/events/:id/task-marks', saveTaskMarksAuth, async (req, res, next) => {
  try {
    const { canManage, canMark } = req.etTaskAccess;
    const data = await etSessionTaskService.saveTaskMarks(
      req.params.id,
      req.body?.marks || [],
      { userId: req.user?.id, canManage, canMark }
    );
    auditLogService.logAuditAsync({
      module: 'et_grouping',
      action: 'save_task_marks',
      entityType: 'Event',
      entityId: Number(req.params.id),
      targetSummary: `eventId=${req.params.id}`,
      afterData: { markCount: (req.body?.marks || []).length },
      req,
    });
    res.json({ success: true, data });
  } catch (err) {
    if (err.message && !err.status) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return handleServiceError(res, err, next);
  }
});

module.exports = router;
