'use strict';

const { getStudentTimeline } = require('../services/learningJourney/analytics/timelineReadService');
const { queryAnalyticStudents, queryAnalyticExams } = require('../services/learningJourney/analytics/analyticsQueryService');
const { exportResearchData } = require('../services/learningJourney/analytics/researchExportService');
const { runQualityAssertions } = require('../services/learningJourney/analytics/qualityPanelService');
const {
  shouldRunAsync,
  startAnalyticsRebuildJob,
  runAnalyticsRebuildSync,
} = require('../services/learningJourney/analytics/analyticRebuildJobService');
const { getAnalyticsSummary } = require('../services/learningJourney/analytics/analyticsSummaryService');
const { getLvaAnalytics } = require('../services/learningJourney/analytics/lvaAnalyticsService');
const {
  createLvaModelRun,
  listLvaModelRuns,
  getLvaModelRun,
} = require('../services/learningJourney/analytics/lvaModelRunService');
const { assertCanAccessStudent, sendStudentScopeDenied } = require('../services/accessControl/studentScopeGuard');

async function requireStudentScope(req, res, next) {
  try {
    await assertCanAccessStudent(req.user, req.params.studentId, {
      semesterId: req.query.semesterId || req.query.semester,
    });
    return next();
  } catch (err) {
    return sendStudentScopeDenied(res, err);
  }
}

async function getTimeline(req, res) {
  try {
    const data = await getStudentTimeline(req.params.studentId, {
      snapshotVersion: req.query.snapshot_version || req.query.snapshotVersion,
    });
    if (!data) {
      return res.status(404).json({ success: false, error: '找不到學生', requestId: req.requestId });
    }
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getAnalyticsStudents(req, res) {
  try {
    const data = await queryAnalyticStudents(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getAnalyticsExams(req, res) {
  try {
    const data = await queryAnalyticExams(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getResearchExport(req, res) {
  try {
    const data = await exportResearchData(req.query || {});
    const format = String(req.query.format || 'csv').toLowerCase();
    if (format === 'csv' && data.csv) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="lj-research-${Date.now()}.csv"`);
      res.setHeader('X-LJ-Snapshot-Version', data.snapshotVersion);
      return res.send(data.csv);
    }
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getQualityAssertions(req, res) {
  try {
    const data = await runQualityAssertions({
      snapshotVersion: req.query.snapshot_version || req.query.snapshotVersion,
    });
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getAnalyticsSummaryHandler(req, res) {
  try {
    const data = await getAnalyticsSummary(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getLvaAnalyticsHandler(req, res) {
  try {
    const data = await getLvaAnalytics(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function listLvaModelRunsHandler(req, res) {
  try {
    const data = await listLvaModelRuns(req.query || {});
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function getLvaModelRunHandler(req, res) {
  try {
    const data = await getLvaModelRun(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, error: '找不到 LVA model run', requestId: req.requestId });
    }
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function postLvaModelRunHandler(req, res) {
  try {
    const data = await createLvaModelRun(req.body?.filters || req.query || {}, {
      user: req.user,
    });
    return res.status(201).json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

async function postAnalyticsRebuild(req, res) {
  try {
    const body = req.body || {};
    const opts = {
      scope: body.scope || 'global',
      semesterId: body.semesterId,
      studentIds: body.studentIds,
      cutoffAt: body.cutoffAt,
      batchSize: body.batchSize,
      async: body.async,
      confirm: body.confirm,
      requestId: req.requestId,
      user: req.user,
      source: 'dashboard',
    };

    if (shouldRunAsync(opts)) {
      const started = await startAnalyticsRebuildJob(opts);
      if (started.alreadyRunning) {
        return res.status(409).json({
          success: false,
          error: '已有 analytic 重建任務執行中，請稍後再試或至操作紀錄查看進度。',
          data: { operationRunId: started.run?.id || null },
          requestId: req.requestId,
        });
      }
      return res.status(202).json({
        success: true,
        async: true,
        message: 'analytic 重建已於背景啟動，請至操作紀錄查看進度。',
        data: {
          operationRunId: started.run?.id || null,
          operationType: 'REBUILD_ANALYTICS',
        },
        requestId: req.requestId,
      });
    }

    const data = await runAnalyticsRebuildSync(opts);
    return res.json({ success: true, data, requestId: req.requestId });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message, requestId: req.requestId });
  }
}

module.exports = {
  requireStudentScope,
  getTimeline,
  getAnalyticsStudents,
  getAnalyticsExams,
  getResearchExport,
  getQualityAssertions,
  getAnalyticsSummary: getAnalyticsSummaryHandler,
  getLvaAnalytics: getLvaAnalyticsHandler,
  listLvaModelRuns: listLvaModelRunsHandler,
  getLvaModelRun: getLvaModelRunHandler,
  postLvaModelRun: postLvaModelRunHandler,
  postAnalyticsRebuild,
};
