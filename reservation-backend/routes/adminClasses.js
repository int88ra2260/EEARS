// routes/adminClasses.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, adminOrExecutiveMiddleware, teacherMiddleware } = require('../middlewares/auth');
const {
  importClassRoster,
  previewClassRosterPdf,
  importClassRosterPdf,
  getClassOverview,
  getClassDetail,
  exportClassOverview,
  exportClassDetail,
  downloadSampleFile,
  deleteClassRecord
} = require('../controllers/adminClassesController');
const { getBestepOverview, exportClassBestepOverview } = require('../controllers/bestepClassController');

// 設定 multer 用於檔案上傳
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'class-roster-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadExcel = multer({
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

const uploadPdf = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('只允許上傳 PDF 檔案 (.pdf)'), false);
    }
  }
});

// 所有路由都需要認證
router.use(authMiddleware);

/**
 * 匯入班級名單（僅管理員）
 * POST /api/admin/classes/roster/import?semester=114-1
 */
router.post('/roster/import', adminOrExecutiveMiddleware, uploadExcel.single('file'), importClassRoster);

/**
 * PDF 預覽／匯入（選課系統修課名單）
 */
router.post('/roster/import-pdf/preview', adminOrExecutiveMiddleware, uploadPdf.single('file'), previewClassRosterPdf);
router.post('/roster/import-pdf', adminOrExecutiveMiddleware, uploadPdf.single('file'), importClassRosterPdf);

/**
 * 取得班級總覽（管理員和老師都可以，但老師只能看到自己的班級）
 * GET /api/admin/classes/overview?semester=114-1&q=&studentId=&teacherName=&sortBy=coverage&sortOrder=desc&page=1&pageSize=20
 */
router.get('/overview', teacherMiddleware, getClassOverview);

/**
 * 刪除班級（僅管理員）
 * DELETE /api/admin/classes/:classId
 */
router.delete('/:classId', adminOrExecutiveMiddleware, deleteClassRecord);

/**
 * 取得班級明細（管理員和老師都可以，但老師只能看到自己的班級）
 * GET /api/admin/classes/:classId/overview?semester=114-1&activityType=All&q=&sortBy=studentId&sortOrder=asc&page=1&pageSize=50
 */
router.get('/:classId/overview', teacherMiddleware, getClassDetail);

/**
 * 取得班級 BESTEP 概況
 * GET /api/admin/classes/:classId/bestep-overview?semester=114-1&examType=all&page=1&pageSize=50&search=
 */
router.get('/:classId/bestep-overview', teacherMiddleware, getBestepOverview);

/**
 * 匯出班級 BESTEP 概況 Excel（管理員和老師都可以，但老師只能匯出自己的班級）
 * GET /api/admin/classes/:classId/bestep-overview/export?semester=114-1&examType=all&search=
 */
router.get('/:classId/bestep-overview/export', teacherMiddleware, exportClassBestepOverview);

/**
 * 匯出班級總覽 Excel（管理員和老師都可以，但老師只能匯出自己的班級）
 * GET /api/admin/classes/overview/export?semester=114-1&activityType=All
 */
router.get('/overview/export', teacherMiddleware, exportClassOverview);

/**
 * 匯出班級明細 Excel（管理員和老師都可以，但老師只能匯出自己的班級）
 * GET /api/admin/classes/:classId/overview/export?semester=114-1&activityType=All
 */
router.get('/:classId/overview/export', teacherMiddleware, exportClassDetail);

/**
 * 下載範例檔案（僅管理員）
 * GET /api/admin/classes/sample
 */
router.get('/sample', adminOrExecutiveMiddleware, downloadSampleFile);

// 錯誤處理中間件
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '檔案大小超過限制 (10MB)' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: '只能上傳一個檔案' });
    }
  }
  
  if (error.message.includes('只允許上傳 Excel 檔案')) {
    return res.status(400).json({ error: error.message });
  }
  
  next(error);
});

module.exports = router;
