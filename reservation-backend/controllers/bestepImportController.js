// controllers/bestepImportController.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { importAttendanceData, importScoreData, generateErrorReport } = require('../services/bestepImportService');
const auditLogService = require('../services/auditLogService');
const { runSync } = require('../services/learningJourney/syncService');
const { BestepExamScore } = require('../models');
const { rebuildAnalyticsInBatches } = require('../services/learningJourney/analytics/analyticRebuildService');

function scheduleBestepScoreAnalyticsPromote(semester, importBatchId) {
  setImmediate(async () => {
    try {
      const syncResult = await runSync({
        semesterId: semester,
        sections: ['bestep_scores'],
        dryRun: false,
      });
      const rows = await BestepExamScore.findAll({
        where: importBatchId
          ? { semester, importBatchId }
          : { semester },
        attributes: ['studentId'],
      });
      const studentIds = [...new Set(rows.map((r) => String(r.studentId || '').trim().toUpperCase()).filter(Boolean))];
      let rebuildResult = null;
      if (studentIds.length) {
        rebuildResult = await rebuildAnalyticsInBatches({
          scope: 'manual',
          studentIds,
          batchSize: 50,
          dryRun: false,
        });
      }
      console.log('[bestep] score→analytics promote done', {
        semester,
        importBatchId,
        sync: syncResult?.results?.bestep_scores || null,
        studentCount: studentIds.length,
        snapshotVersion: rebuildResult?.snapshotVersion || null,
      });
    } catch (err) {
      console.error('[bestep] score→analytics promote failed:', err && err.message ? err.message : err);
    }
  });
}

// 設定 multer 用於檔案上傳
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/bestep');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bestep-import-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 限制
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允許上傳 Excel 檔案 (.xlsx, .xls)'), false);
    }
  }
});

/**
 * 匯入出席資料
 * POST /api/admin/bestep/attendance/import
 */
async function importAttendance(req, res, next) {
  try {
    const { semester, examType, examDate } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: '請上傳檔案' });
    }

    if (!semester) {
      return res.status(400).json({ error: '請指定學期' });
    }

    if (examType && !['L', 'R', 'S', 'W', 'LR', 'SW'].includes(String(examType).toUpperCase())) {
      return res.status(400).json({ error: '考試類型格式錯誤（可為 L/R/S/W/LR/SW，或留空由檔案應考項目判斷）' });
    }

    if (!examDate) {
      return res.status(400).json({ error: '請指定考試日期' });
    }

    // 驗證日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(examDate)) {
      return res.status(400).json({ error: '考試日期格式錯誤（應為 YYYY-MM-DD）' });
    }

    const normalizedExamType = examType ? String(examType).toUpperCase() : null;
    const result = await importAttendanceData(file.path, semester, normalizedExamType, examDate);

    // 生成錯誤報表（如有錯誤）
    let errorFileUrl = null;
    if (result.errors.length > 0) {
      const errorReportPath = path.join(__dirname, '../uploads/bestep/errors', `error-report-${Date.now()}.xlsx`);
      const errorReportDir = path.dirname(errorReportPath);
      if (!fs.existsSync(errorReportDir)) {
        fs.mkdirSync(errorReportDir, { recursive: true });
      }
      await generateErrorReport(result.errors, errorReportPath);
      errorFileUrl = `/api/admin/bestep/attendance/import/errors/${path.basename(errorReportPath)}`;
    }

    // 刪除上傳的檔案
    fs.unlinkSync(file.path);

    // 稽核：BESTEP 出席匯入（摘要）
    auditLogService.logAuditAsync({
      module: 'bestep',
      action: 'import_attendance',
      entityType: 'BestepAttendanceImport',
      entityId: `${semester}:${examType || ''}:${examDate}`,
      targetSummary: `BESTEP attendance import semester=${semester} examType=${examType || ''} examDate=${examDate}`,
      afterData: {
        importBatchId: result.importBatchId,
        sourceFile: result.sourceFile || file.originalname || null,
        semester,
        examType: examType || null,
        examDate,
        imported: result.imported,
        skipped: result.skipped,
        errorCount: result.errors.length,
        errorFileUrl,
      },
      req,
    });

    res.json({
      success: true,
      semester,
      examType,
      examDate,
      importBatchId: result.importBatchId,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
      errorFileUrl
    });
  } catch (error) {
    // 稽核：匯入失敗摘要（避免寫入原始檔內容）
    auditLogService.logAuditAsync({
      module: 'bestep',
      action: 'import_attendance',
      entityType: 'BestepAttendanceImport',
      entityId: `${req.body?.semester || 'unknown'}:${req.body?.examType || 'unknown'}:${req.body?.examDate || 'unknown'}`,
      targetSummary: 'import_attendance_failed',
      beforeData: null,
      afterData: null,
      status: 'failed',
      errorMessage: error && error.message ? error.message : String(error),
      req,
    });

    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error('匯入出席資料錯誤:', error);
    res.status(500).json({ error: error.message || '匯入失敗' });
  }
}

/**
 * 匯入成績資料
 * POST /api/admin/bestep/scores/import
 */
async function importScores(req, res, next) {
  try {
    const { semester } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: '請上傳檔案' });
    }

    if (!semester) {
      return res.status(400).json({ error: '請指定學期' });
    }

    const result = await importScoreData(file.path, semester);

    // 生成錯誤報表（如有錯誤）
    let errorFileUrl = null;
    if (result.errors.length > 0) {
      const errorReportPath = path.join(__dirname, '../uploads/bestep/errors', `error-report-${Date.now()}.xlsx`);
      const errorReportDir = path.dirname(errorReportPath);
      if (!fs.existsSync(errorReportDir)) {
        fs.mkdirSync(errorReportDir, { recursive: true });
      }
      await generateErrorReport(result.errors, errorReportPath);
      errorFileUrl = `/api/admin/bestep/scores/import/errors/${path.basename(errorReportPath)}`;
    }

    // 刪除上傳的檔案
    fs.unlinkSync(file.path);

    auditLogService.logAuditAsync({
      module: 'bestep',
      action: 'import_scores',
      entityType: 'BestepScoreImport',
      entityId: `${semester}:${result.importBatchId || Date.now()}`,
      targetSummary: `BESTEP scores import semester=${semester}`,
      afterData: {
        importBatchId: result.importBatchId,
        sourceFile: result.sourceFile || file.originalname || null,
        semester,
        imported: result.imported,
        skipped: result.skipped,
        errorCount: result.errors.length,
        errorFileUrl,
        analyticsPromoteScheduled: true,
      },
      req,
    });

    // 成績寫入 bestep_exam_scores 後，自動同步 exam_attempts 並重建學習分析投影
    // （避免只進培力表、學習分析頁看不到的落差）
    if (Number(result.imported) > 0) {
      scheduleBestepScoreAnalyticsPromote(semester, result.importBatchId);
    }

    res.json({
      success: true,
      semester,
      importBatchId: result.importBatchId,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
      errorFileUrl,
      analyticsPromoteScheduled: Number(result.imported) > 0,
      analyticsPromoteHint:
        '已排程：BESTEP → exam_attempts sync + 學習分析 rebuild。若需補寫 et_exam_attempts，可另跑 npm run lj:promote-bestep -- --semesterId=' +
        semester +
        ' --apply --skip-sync',
    });
  } catch (error) {
    auditLogService.logAuditAsync({
      module: 'bestep',
      action: 'import_scores',
      entityType: 'BestepScoreImport',
      entityId: `${req.body?.semester || 'unknown'}`,
      targetSummary: 'BESTEP scores import failed',
      status: 'failed',
      errorMessage: error && error.message ? error.message : String(error),
      req,
    });
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error('匯入成績資料錯誤:', error);
    res.status(500).json({ error: error.message || '匯入失敗' });
  }
}

module.exports = {
  importAttendance,
  importScores,
  upload
};
