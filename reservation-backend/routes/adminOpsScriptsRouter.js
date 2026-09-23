'use strict';

const express = require('express');
const { authMiddleware, requireAdmin } = require('../middlewares/auth');
const {
  getBackupHealthSnapshot,
  getBackupJobStatus,
  startBackupJob,
} = require('../services/opsScriptsService');

const router = express.Router();

router.use(authMiddleware, requireAdmin);

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
