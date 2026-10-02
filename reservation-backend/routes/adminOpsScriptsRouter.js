'use strict';

const express = require('express');
const { authMiddleware, requireAdmin } = require('../middlewares/auth');
const {
  getBackupHealthSnapshot,
  getBackupJobStatus,
  startBackupJob,
  getMigrationStatus,
  getMigrateJobStatus,
  startMigrateJob,
} = require('../services/opsScriptsService');
const { getGitHubOpsStatus } = require('../services/githubOpsStatusService');

const router = express.Router();

router.use(authMiddleware, requireAdmin);

/** GET /api/admin/ops-scripts/github */
router.get('/github', async (req, res) => {
  try {
    const data = await getGitHubOpsStatus({ refresh: req.query.refresh === '1' });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: 'GITHUB_STATUS_FAILED',
      error: err.message || '無法讀取 GitHub 狀態',
      requestId: req.requestId,
    });
  }
});

/** GET /api/admin/ops-scripts/backup/health */
router.get('/backup/health', (req, res) => {
  res.json({
    success: true,
    data: {
      health: getBackupHealthSnapshot(),
      job: getBackupJobStatus(),
    },
  });
});

/** GET /api/admin/ops-scripts/backup/job */
router.get('/backup/job', (req, res) => {
  res.json({
    success: true,
    data: getBackupJobStatus(),
  });
});

/** GET /api/admin/ops-scripts/migrations */
router.get('/migrations', async (req, res) => {
  try {
    const data = await getMigrationStatus();
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: 'MIGRATE_STATUS_FAILED',
      error: err.message || '無法讀取 migration 狀態',
      requestId: req.requestId,
    });
  }
});

/** GET /api/admin/ops-scripts/migrations/job */
router.get('/migrations/job', (req, res) => {
  res.json({ success: true, data: getMigrateJobStatus() });
});

/** POST /api/admin/ops-scripts/migrations/run */
router.post('/migrations/run', async (req, res) => {
  try {
    const job = await startMigrateJob({ user: req.user, requestId: req.requestId });
    const alreadyDone = job.status === 'success' && job.pending.length === 0 && !job.output;
    return res.status(alreadyDone ? 200 : 202).json({
      success: true,
      data: job,
      message: alreadyDone ? '沒有尚未執行的 migration' : '已開始套用 migration',
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'MIGRATE_RUN_FAILED',
      error: err.message || '無法啟動 migration',
      requestId: req.requestId,
    });
  }
});

/** POST /api/admin/ops-scripts/backup/run */
router.post('/backup/run', (req, res) => {
  try {
    const job = startBackupJob({ user: req.user, requestId: req.requestId });
    return res.status(202).json({
      success: true,
      data: job,
      message: '已開始執行備份作業',
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      code: err.code || 'BACKUP_RUN_FAILED',
      error: err.message || '無法啟動備份',
      requestId: req.requestId,
    });
  }
});

module.exports = router;
