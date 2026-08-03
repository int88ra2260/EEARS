const weeklyReportService = require('../services/weeklyReportService');
const auditLogService = require('../services/auditLogService');

function snapshot(row) {
  if (!row) return null;
  return {
    id: row.id,
    issueKey: row.issueKey,
    title: row.title,
    status: row.status,
    publishedAt: row.publishedAt,
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
  };
}

async function list(req, res, next) {
  try {
    const data = await weeklyReportService.listAdmin({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
    });
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const row = await weeklyReportService.getByIdAdmin(req.params.id);
    if (!row) return res.status(404).json({ error: '找不到週報' });
    return res.json(row);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const data = await weeklyReportService.createWeeklyReport(req.body, actorId);
    auditLogService.logAuditAsync({
      module: 'weekly_reports',
      action: 'create',
      entityType: 'WeeklyReport',
      entityId: data.id,
      targetSummary: data.title,
      afterData: snapshot(data),
      req,
      requestId: req.requestId || null,
    });
    return res.status(201).json(data);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const before = await weeklyReportService.getByIdAdmin(req.params.id);
    if (!before) return res.status(404).json({ error: '找不到週報' });
    const data = await weeklyReportService.updateWeeklyReport(req.params.id, req.body, actorId);
    auditLogService.logAuditAsync({
      module: 'weekly_reports',
      action: 'update',
      entityType: 'WeeklyReport',
      entityId: data.id,
      targetSummary: data.title,
      beforeData: snapshot(before),
      afterData: snapshot(data),
      changedFields: auditLogService.diffShallow(snapshot(before), snapshot(data)),
      req,
      requestId: req.requestId || null,
    });
    return res.json(data);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const before = await weeklyReportService.getByIdAdmin(req.params.id);
    if (!before) return res.status(404).json({ error: '找不到週報' });
    await weeklyReportService.deleteWeeklyReport(req.params.id);
    auditLogService.logAuditAsync({
      module: 'weekly_reports',
      action: 'delete',
      entityType: 'WeeklyReport',
      entityId: before.id,
      targetSummary: before.title,
      beforeData: snapshot(before),
      req,
      requestId: req.requestId || null,
    });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function previewToken(req, res, next) {
  try {
    const data = await weeklyReportService.createPreviewToken(req.params.id, req.body?.ttlSec);
    if (!data) return res.status(404).json({ error: '找不到週報' });
    return res.json(data);
  } catch (err) {
    if (err.message?.includes('JWT_SECRET')) {
      return res.status(500).json({ error: err.message });
    }
    next(err);
  }
}

async function analytics(req, res, next) {
  try {
    const weeklyInteractionService = require('../services/weeklyInteractionService');
    const data = await weeklyInteractionService.getAnalytics(req.params.id);
    if (!data) return res.status(404).json({ error: '找不到週報' });
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

async function duplicate(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const data = await weeklyReportService.duplicateWeeklyReport(req.params.id, req.body || {}, actorId);
    if (!data) return res.status(404).json({ error: '找不到週報' });
    auditLogService.logAuditAsync({
      module: 'weekly_reports',
      action: 'duplicate',
      entityType: 'WeeklyReport',
      entityId: data.id,
      targetSummary: data.title,
      afterData: snapshot(data),
      req,
      requestId: req.requestId || null,
    });
    return res.status(201).json(data);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  previewToken,
  duplicate,
  analytics,
};
