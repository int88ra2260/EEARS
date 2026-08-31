// routes/englishTestRegistrationRouter.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { EnglishTestRegistration, ClassMembership } = require('../models');
const englishTestRegistrationService = require('../services/englishTestRegistrationService');
const englishTestStudentIdCardRosterService = require('../services/englishTestStudentIdCardRosterService');
const {
  hasB2ScoresFilled,
  inferStudentRequestedExemptionLabel,
  EXEMPTION_VERIFIED_CODES,
  pickLatestRegistrationPerStudent
} = require('../utils/exemptionUtils');
const { authMiddleware, englishTestDomainMiddleware, requirePermission, P } = require('../middlewares/auth');
const {
  publicEnglishTestLookupRateLimit,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  requireLookupMinimumFields,
  genericLookupResponse,
  publicLookupAudit,
  createSimpleRateLimit,
} = require('../middlewares/publicAccessGuard');
const englishTestEmailVerificationService = require('../services/englishTestEmailVerificationService');

const publicEmailCodeSendRateLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: '驗證碼寄送次數過多，請稍後再試',
  keyFn: (req, ip) => {
    const email = englishTestEmailVerificationService.normalizeEmail(req.body?.email);
    return email ? `et-otp-send:${email}` : `et-otp-send-ip:${ip}`;
  },
});

const publicEmailCodeVerifyRateLimit = createSimpleRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: '驗證碼嘗試次數過多，請稍後再試',
  keyFn: (req, ip) => {
    const email = englishTestEmailVerificationService.normalizeEmail(req.body?.email);
    return email ? `et-otp-verify:${email}` : `et-otp-verify-ip:${ip}`;
  },
});

/** 培力英檢後台：可檢視清單/單筆（不含審核動作） */
const englishRegViewAuth = [authMiddleware, englishTestDomainMiddleware, requirePermission(P.CAN_VIEW_ENGLISH_TESTS)];
/** 培力英檢後台：審核／維護報名 */
const englishRegReviewAuth = [authMiddleware, englishTestDomainMiddleware, requirePermission(P.CAN_REVIEW_ENGLISH_TEST_REGISTRATIONS)];
/** 儀表板用聚合指標（工讀生可取得待審筆數，不含完整個資清單） */
const englishRegMetricsAuth = [authMiddleware, requirePermission(P.CAN_VIEW_ENGLISH_TEST_METRICS)];
/** 匯出 Excel／證件照壓縮檔 */
const englishRegExportAuth = [authMiddleware, englishTestDomainMiddleware, requirePermission(P.CAN_EXPORT_ENGLISH_TEST_DATA)];
/** 報名表單 schema 維護 */
const englishRegFormManageAuth = [authMiddleware, englishTestDomainMiddleware, requirePermission(P.CAN_MANAGE_ENGLISH_TESTS)];
const { Op, Sequelize, QueryTypes } = require('sequelize');
const ExcelJS = require('exceljs');
const emailLogService = require('../services/emailLogService');
const logger = require('../utils/logger');
const auditLogService = require('../services/auditLogService');
const {
  maskEnglishTestRegistrationForAdminApi,
  maskEnglishTestRegistrationListForAdminApi,
} = require('../utils/englishTestRegistrationApiMask');
const { isIndividualRegistrationEnabled } = require('../services/registrationSettingsService');
const englishTestFormSchemaService = require('../services/englishTestFormSchemaService');

function parseExtraAnswersField(raw) {
  if (raw == null || raw === '') return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 匯出稽核（metadata 經 sanitizeForAudit，不含完整 idNumber／email） */
function logEnglishTestExportAudit(req, { action, exportType, rowCount, filters }) {
  auditLogService.logAuditAsync({
    module: 'english_test',
    action,
    entityType: 'EnglishTestRegistrationExport',
    entityId: `${exportType}:${req.requestId || Date.now()}`.slice(0, 64),
    targetSummary: `export=${exportType} count=${rowCount}`,
    afterData: {
      exportType,
      rowCount,
      filters: filters || {},
      requestId: req.requestId || null,
    },
    req,
  });
}

/**
 * 重新排序「報名成功」狀態的序號（按學期分組）
 * @param {string} semester - 學期（可選），如果提供則只處理該學期，否則處理所有學期
 * 排序依據：approvedAt ASC（無則 createdAt ASC），再按 id ASC
 */
async function reorderSuccessSequences(semester = null) {
  try {
    const whereClause = { status: 'success' };
    if (semester) {
      whereClause.semester = semester;
    }

    // 查詢所有狀態為 'success' 的記錄（可選學期篩選）
    const allSuccessRegistrations = await EnglishTestRegistration.findAll({
      where: whereClause,
      order: [
        ['semester', 'ASC'],
        [Sequelize.literal('COALESCE("approvedAt", "createdAt")'), 'ASC'],
        ['id', 'ASC']
      ]
    });

    // 按學期分組
    const registrationsBySemester = {};
    allSuccessRegistrations.forEach(reg => {
      const sem = reg.semester || 'unknown';
      if (!registrationsBySemester[sem]) {
        registrationsBySemester[sem] = [];
      }
      registrationsBySemester[sem].push(reg);
    });

    // 為每個學期的記錄分配序號（從1開始）
    let totalUpdated = 0;
    for (const [sem, registrations] of Object.entries(registrationsBySemester)) {
      await Promise.all(registrations.map((reg, index) => (
        reg.update({ successSequence: index + 1 })
      )));
      totalUpdated += registrations.length;
      logger.simple.success(`已重新排序學期 ${sem} 的 ${registrations.length} 筆報名成功記錄`);
    }

    return totalUpdated;
  } catch (error) {
    logger.error('重新排序失敗', error);
    throw error;
  }
}

// 動態載入 archiver（如果未安裝會在執行時報錯）
let archiver;
try {
  archiver = require('archiver');
} catch (e) {
  logger.warn('archiver 套件未安裝，證件照匯出功能將無法使用。請執行: npm install archiver');
}

// 檔案上傳設定（與 server.js 中的靜態服務路徑對應）
const baseUploadDir = path.join(__dirname, '../uploads/english-test');
const idPhotoDir = path.join(baseUploadDir, 'id-photos'); // 證件照資料夾
const certificateDir = path.join(baseUploadDir, 'certificates'); // 成績證明資料夾（B2 證書）
const disabilityCertDir = path.join(baseUploadDir, 'disability-certs'); // 障礙證明資料夾
const studentRosterDir = path.join(baseUploadDir, 'student-roster'); // 學名單比對用 Excel 檔

// 確保資料夾存在
[baseUploadDir, idPhotoDir, certificateDir, disabilityCertDir, studentRosterDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 學名單比對 Excel 上傳（admin 使用）
const rosterExcelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, studentRosterDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `english-test-roster-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const rosterExcelUpload = multer({
  storage: rosterExcelStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedExt = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExt.includes(ext)) return cb(null, true);
    return cb(new Error('只允許上傳 Excel 檔案 (.xlsx, .xls)'), false);
  },
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 根據檔案類型決定儲存位置
    if (file.fieldname === 'idPhoto') {
      // 證件照
      cb(null, idPhotoDir);
    } else if (file.fieldname === 'b2CertificateFile') {
      // 成績證明（B2 證書）
      cb(null, certificateDir);
    } else if (file.fieldname === 'disabilityCertFront' || file.fieldname === 'disabilityCertBack') {
      // 障礙證明（正面和反面）
      cb(null, disabilityCertDir);
    } else {
      cb(null, baseUploadDir);
    }
  },
  filename: (req, file, cb) => {
    // 從請求中取得學號、身分證字號和姓名（FormData 中的值）
    // 注意：在 multer 處理時，req.body 可能還未完全解析，所以使用 req.body 的值
    const studentId = (req.body && req.body.studentId) || '';
    const idNumber = (req.body && (req.body.idNumber || req.body.nationalId)) || '';
    const name = (req.body && (req.body.name || req.body.studentNameZh)) || '';
    
    // 清理檔名中的特殊字符（移除可能導致檔案系統問題的字符）
    const cleanStudentId = String(studentId).replace(/[^A-Z0-9]/g, '');
    const cleanIdNumber = String(idNumber).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanName = String(name).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    
    // 如果沒有學號或姓名，使用時間戳作為備用
    if (!cleanStudentId || !cleanName) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    } else {
      // 格式：學號-姓名-檔案類型.副檔名 或 學號-姓名(序號)-檔案類型.副檔名（多檔案時）
      let fileType;
      if (file.fieldname === 'idPhoto') {
        fileType = '證件照';
      } else if (file.fieldname === 'b2CertificateFile' || file.fieldname === 'b2CertificateFiles') {
        fileType = 'B2證書';
      } else if (file.fieldname === 'disabilityCertFront') {
        fileType = '障礙證明正面';
      } else if (file.fieldname === 'disabilityCertBack') {
        fileType = '障礙證明反面';
      } else {
        fileType = '其他';
      }
      const ext = path.extname(file.originalname);
      
      // 如果是 b2CertificateFiles（多檔案），需要加上序號
      // 注意：multer 會為每個檔案單獨調用 filename，所以我們需要從 req 中追蹤已處理的檔案數量
      if (file.fieldname === 'b2CertificateFile' || file.fieldname === 'b2CertificateFiles') {
        // 初始化計數器（如果還沒有）
        if (!req.b2CertificateFileCount) {
          req.b2CertificateFileCount = 0;
        }
        req.b2CertificateFileCount++;
        
        // 多檔案情況：學號-姓名(1), 學號-姓名(2)...
        cb(null, `${cleanStudentId}-${cleanName}(${req.b2CertificateFileCount})-${fileType}${ext}`);
      } else {
        cb(null, `${cleanStudentId}-${cleanName}-${fileType}${ext}`);
      }
    }
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只允許上傳 JPG、PNG 或 PDF 檔案'));
    }
  }
});

// 更新用的 storage（使用臨時檔名，避免與現有檔案衝突）
const updateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 根據檔案類型決定儲存位置
    if (file.fieldname === 'idPhoto') {
      cb(null, idPhotoDir);
    } else if (file.fieldname === 'b2CertificateFile') {
      cb(null, certificateDir);
    } else if (file.fieldname === 'disabilityCertFront' || file.fieldname === 'disabilityCertBack') {
      cb(null, disabilityCertDir);
    } else {
      cb(null, baseUploadDir);
    }
  },
  filename: (req, file, cb) => {
    // 使用臨時檔名（時間戳 + 隨機數），避免與現有檔案衝突
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `temp-${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// 更新用的 upload（使用臨時檔名）
const updateUpload = multer({
  storage: updateStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只允許上傳 JPG、PNG 或 PDF 檔案'));
    }
  }
});

// API: 更新報名資料（支援檔案上傳和覆蓋）
router.put('/english-test/registrations/update',
  publicEnglishTestLookupRateLimit,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  requireLookupMinimumFields({ requireStudentId: true, requireName: true, requireEmail: true }),
  updateUpload.fields([
    { name: 'b2CertificateFile', maxCount: 1 },
    { name: 'disabilityCertFront', maxCount: 1 },
    { name: 'disabilityCertBack', maxCount: 1 },
    { name: 'idPhoto', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      logger.debug('收到更新報名請求', { body: req.body, files: req.files });
      
      const formData = req.body;
      const files = req.files;
      const registrationId = formData.registrationId;

      if (!registrationId || !formData.idNumber) {
        return res.status(400).json({ success: false, message: 'Invalid query.' });
      }

      // 查詢現有報名資料
      const registration = await EnglishTestRegistration.findByPk(registrationId);
      if (!registration) {
        publicLookupAudit(req, {
          action: 'english_test_registration_update_public',
          entityType: 'EnglishTestRegistration',
          entityId: registrationId,
          found: false,
          payload: { studentId: formData.studentId, name: formData.name, email: formData.email },
        });
        return genericLookupResponse(res, {
          found: false,
          message: 'If the registration matches the provided information, your request has been accepted for processing.',
        });
      }

      // 已通過、報名成功、報名失敗不允許學生自行修改
      if (['approved', 'success', 'failed'].includes(registration.status)) {
        const statusMessages = {
          'approved': '此報名已通過審核，無法進行修改。若是想要修改報考項目或是補照片請聯繫全英語卓越教學中心',
          'success': '此報名已成功，無法進行修改。若是想要修改報考項目或是補照片請聯繫全英語卓越教學中心',
          'failed': '此報名已失敗，無法進行修改。如有疑問請聯繫全英語卓越教學中心'
        };
        return res.status(403).json({ 
          error: statusMessages[registration.status] || '此狀態無法進行修改',
          code: 'STATUS_CANNOT_EDIT',
          status: registration.status
        });
      }

      // 驗證三個欄位都必須正確（安全檢查：保護包含地址等私人資訊）
      const idNumberMatch = registration.idNumber.toUpperCase() === formData.idNumber.trim().toUpperCase();
      const nameMatch = registration.name.trim() === formData.name.trim();
      const studentIdMatch = registration.studentId.trim() === formData.studentId.trim();

      if (!idNumberMatch || !nameMatch || !studentIdMatch) {
        publicLookupAudit(req, {
          action: 'english_test_registration_update_public',
          entityType: 'EnglishTestRegistration',
          entityId: registrationId,
          found: false,
          payload: { studentId: formData.studentId, name: formData.name, email: formData.email },
        });
        return genericLookupResponse(res, {
          found: false,
          message: 'If the registration matches the provided information, your request has been accepted for processing.',
        });
      }

      try {
        englishTestRegistrationService.assertStudentMayEditRegistration(registration);
      } catch (semErr) {
        return res.status(semErr.status || 403).json({
          success: false,
          code: semErr.code || 'REGISTRATION_SEMESTER_MISMATCH',
          error: semErr.message,
        });
      }

      // email 變更時須重新通過信箱驗證；未變更則免驗
      if (englishTestEmailVerificationService.requiresEmailVerification({
        submittedEmail: formData.email,
        previousEmail: registration.email,
        isUpdate: true,
      })) {
        try {
          englishTestEmailVerificationService.assertEmailVerifiedToken({
            token: formData.emailVerificationToken,
            email: formData.email,
          });
        } catch (verifyErr) {
          return res.status(verifyErr.status || 400).json({
            success: false,
            code: verifyErr.code || 'EMAIL_VERIFICATION_REQUIRED',
            error: verifyErr.message || '請先完成信箱驗證',
          });
        }
      }

      // 處理檔案路徑（如果上傳了新檔案，使用相同檔名覆蓋舊檔案）
      const filePaths = {};
      const baseUploadPath = path.join(__dirname, '../uploads');
      
      // 取得身分證字號和姓名用於檔名
      const idNumber = formData.idNumber || registration.idNumber || '';
      const name = formData.name || registration.name || '';
      const cleanIdNumber = String(idNumber).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanName = String(name).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
      
      if (files) {
        // 證件照：如果上傳了新檔案，使用相同檔名覆蓋
        if (files.idPhoto && files.idPhoto[0]) {
          if (registration.idPhoto && cleanIdNumber && cleanName) {
            // 刪除舊檔案
            const oldFilePath = path.join(baseUploadPath, registration.idPhoto);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
            // 使用相同的檔名格式（身分證字號-姓名-證件照）
            const oldExt = path.extname(registration.idPhoto);
            const newFileName = `${cleanIdNumber}-${cleanName}-證件照${oldExt}`;
            const newFilePath = path.join(idPhotoDir, newFileName);
            
            // 將臨時檔案移動到正確位置（覆蓋舊檔案）
            if (fs.existsSync(files.idPhoto[0].path)) {
              // 確保目標目錄存在
              if (!fs.existsSync(idPhotoDir)) {
                fs.mkdirSync(idPhotoDir, { recursive: true });
              }
              // 如果目標檔案已存在，先刪除
              if (fs.existsSync(newFilePath)) {
                fs.unlinkSync(newFilePath);
              }
              // 移動臨時檔案到正確位置
              fs.renameSync(files.idPhoto[0].path, newFilePath);
            }
            filePaths.idPhoto = path.relative(baseUploadPath, newFilePath).replace(/\\/g, '/');
          } else {
            // 沒有舊檔案或無法取得檔名資訊，使用新檔名
            const relativePath = path.relative(baseUploadPath, files.idPhoto[0].path);
            filePaths.idPhoto = relativePath.replace(/\\/g, '/');
          }
        }

        // B2 證書：如果上傳了新檔案，使用相同檔名覆蓋
        if (files.b2CertificateFile && files.b2CertificateFile[0]) {
          if (registration.b2CertificateFile && cleanIdNumber && cleanName) {
            const oldFilePath = path.join(baseUploadPath, registration.b2CertificateFile);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
            const oldExt = path.extname(registration.b2CertificateFile);
            const newFileName = `${cleanIdNumber}-${cleanName}-B2證書${oldExt}`;
            const newFilePath = path.join(certificateDir, newFileName);
            
            if (fs.existsSync(files.b2CertificateFile[0].path)) {
              if (!fs.existsSync(certificateDir)) {
                fs.mkdirSync(certificateDir, { recursive: true });
              }
              if (fs.existsSync(newFilePath)) {
                fs.unlinkSync(newFilePath);
              }
              fs.renameSync(files.b2CertificateFile[0].path, newFilePath);
            }
            filePaths.b2CertificateFile = path.relative(baseUploadPath, newFilePath).replace(/\\/g, '/');
          } else {
            const relativePath = path.relative(baseUploadPath, files.b2CertificateFile[0].path);
            filePaths.b2CertificateFile = relativePath.replace(/\\/g, '/');
          }
        }

        // 障礙證明正面：如果上傳了新檔案，使用相同檔名覆蓋
        if (files.disabilityCertFront && files.disabilityCertFront[0]) {
          if (registration.disabilityCertFront && cleanIdNumber && cleanName) {
            const oldFilePath = path.join(baseUploadPath, registration.disabilityCertFront);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
            const oldExt = path.extname(registration.disabilityCertFront);
            const newFileName = `${cleanIdNumber}-${cleanName}-障礙證明正面${oldExt}`;
            const newFilePath = path.join(disabilityCertDir, newFileName);
            
            if (fs.existsSync(files.disabilityCertFront[0].path)) {
              if (!fs.existsSync(disabilityCertDir)) {
                fs.mkdirSync(disabilityCertDir, { recursive: true });
              }
              if (fs.existsSync(newFilePath)) {
                fs.unlinkSync(newFilePath);
              }
              fs.renameSync(files.disabilityCertFront[0].path, newFilePath);
            }
            filePaths.disabilityCertFront = path.relative(baseUploadPath, newFilePath).replace(/\\/g, '/');
          } else {
            const relativePath = path.relative(baseUploadPath, files.disabilityCertFront[0].path);
            filePaths.disabilityCertFront = relativePath.replace(/\\/g, '/');
          }
        }

        // 障礙證明反面：如果上傳了新檔案，使用相同檔名覆蓋
        if (files.disabilityCertBack && files.disabilityCertBack[0]) {
          if (registration.disabilityCertBack && cleanIdNumber && cleanName) {
            const oldFilePath = path.join(baseUploadPath, registration.disabilityCertBack);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
            const oldExt = path.extname(registration.disabilityCertBack);
            const newFileName = `${cleanIdNumber}-${cleanName}-障礙證明反面${oldExt}`;
            const newFilePath = path.join(disabilityCertDir, newFileName);
            
            if (fs.existsSync(files.disabilityCertBack[0].path)) {
              if (!fs.existsSync(disabilityCertDir)) {
                fs.mkdirSync(disabilityCertDir, { recursive: true });
              }
              if (fs.existsSync(newFilePath)) {
                fs.unlinkSync(newFilePath);
              }
              fs.renameSync(files.disabilityCertBack[0].path, newFilePath);
            }
            filePaths.disabilityCertBack = path.relative(baseUploadPath, newFilePath).replace(/\\/g, '/');
          } else {
            const relativePath = path.relative(baseUploadPath, files.disabilityCertBack[0].path);
            filePaths.disabilityCertBack = relativePath.replace(/\\/g, '/');
          }
        }
      }

      // 處理 JSON 欄位（安全解析）
      let passedExamTypes = [];
      let disabilityTypes = [];
      let examAssistanceOptions = [];
      
      try {
        if (formData.passedExamTypes && formData.passedExamTypes.trim() !== '') {
          passedExamTypes = JSON.parse(formData.passedExamTypes);
        }
      } catch (e) {
        logger.warn('解析 passedExamTypes 失敗', e);
      }
      
      try {
        if (formData.disabilityTypes && formData.disabilityTypes.trim() !== '') {
          disabilityTypes = JSON.parse(formData.disabilityTypes);
        }
      } catch (e) {
        logger.warn('解析 disabilityTypes 失敗', e);
      }
      
      try {
        if (formData.examAssistanceOptions && formData.examAssistanceOptions.trim() !== '') {
          examAssistanceOptions = JSON.parse(formData.examAssistanceOptions);
        }
      } catch (e) {
        logger.warn('解析 examAssistanceOptions 失敗', e);
      }

      // 處理 examAssistanceOther
      let examAssistanceOther = null;
      if (formData.examAssistanceOther) {
        examAssistanceOther = formData.examAssistanceOther;
      }

      // 更新報名記錄
      const updateData = {
        email: formData.email,
        studentNameZh: formData.studentNameZh || formData.name,
        lastNameEn: formData.lastNameEn || '',
        firstNameEn: formData.firstNameEn || '',
        birthDate: formData.birthDate,
        phone: formData.phone || '',
        postalCode: formData.postalCode || '',
        city: formData.city || '',
        district: formData.district || '',
        address: formData.address || '',
        degreeLevel: formData.degreeLevel || '',
        grade: formData.grade || '',
        college: formData.college || '',
        department: formData.department || '',
        isLowIncome: formData.isLowIncome || '否',
        hasDisabilityCard: formData.hasDisabilityCard || '否',
        disabilityTypes: disabilityTypes.length > 0 ? disabilityTypes : null,
        examAssistanceOptions: examAssistanceOptions.length > 0 ? examAssistanceOptions : null,
        examAssistanceOther: examAssistanceOther || null,
        agreedToTerms: formData.agreedToTerms === 'true' || formData.agreedToTerms === true,
        infoSource: formData.infoSource || '',
        extraAnswers: parseExtraAnswersField(formData.extraAnswers),
      };

      // 只有在明確提供時才更新英語能力相關欄位（檢視與修正時通常不修改這些欄位）
      if (formData.examType !== undefined) {
        updateData.examType = formData.examType || null;
      }
      if (formData.hasTakenBESTEP !== undefined) {
        updateData.hasTakenBESTEP = formData.hasTakenBESTEP || '否';
      }
      if (formData.hasCEFRB2 !== undefined) {
        updateData.hasCEFRB2 = formData.hasCEFRB2 || '否';
      }
      if (formData.passedExamTypes !== undefined) {
        updateData.passedExamTypes = passedExamTypes.length > 0 ? passedExamTypes : null;
      }
      if (formData.passedExamOther !== undefined) {
        updateData.passedExamOther = formData.passedExamOther || null;
      }
      if (formData.b2SkillType !== undefined) {
        updateData.b2SkillType = formData.b2SkillType || null;
      }
      // Q3: 各項成績（整合原 Q3 和 Q4）
      if (formData.listeningExamType !== undefined) {
        updateData.listeningExamType = formData.listeningExamType || null;
      }
      if (formData.listeningScore !== undefined) {
        updateData.listeningScore = formData.listeningScore || null;
      }
      if (formData.readingExamType !== undefined) {
        updateData.readingExamType = formData.readingExamType || null;
      }
      if (formData.readingScore !== undefined) {
        updateData.readingScore = formData.readingScore || null;
      }
      if (formData.speakingExamType !== undefined) {
        updateData.speakingExamType = formData.speakingExamType || null;
      }
      if (formData.speakingScore !== undefined) {
        updateData.speakingScore = formData.speakingScore || null;
      }
      if (formData.writingExamType !== undefined) {
        updateData.writingExamType = formData.writingExamType || null;
      }
      if (formData.writingScore !== undefined) {
        updateData.writingScore = formData.writingScore || null;
      }

      // 如果有新檔案，更新檔案路徑
      if (filePaths.idPhoto) updateData.idPhoto = filePaths.idPhoto;
      if (filePaths.b2CertificateFile) updateData.b2CertificateFile = filePaths.b2CertificateFile;
      if (filePaths.disabilityCertFront) updateData.disabilityCertFront = filePaths.disabilityCertFront;
      if (filePaths.disabilityCertBack) updateData.disabilityCertBack = filePaths.disabilityCertBack;

      // 學生從「請修正」修改後，狀態改回「審核中」，並寄送審核中信
      const wasRevision = registration.status === 'revision';
      if (wasRevision) {
        updateData.status = 'pending';
      }

      const { getActiveRegistrationSemester } = require('../utils/englishTestRegistrationSemester');
      if (englishTestRegistrationService.isBlankSemester(registration.semester)) {
        updateData.semester = getActiveRegistrationSemester();
      }

      await registration.update(updateData);

      logger.info(`報名資料更新成功，ID: ${registration.id}`);

      // 發送通知郵件到中心信箱（非同步，不阻塞回應）
      try {
        const updatedRegistration = await EnglishTestRegistration.findByPk(registration.id);
        
        await emailLogService.sendEmailWithLog(
          'englishTestRegistrationUpdated',
          {
          studentId: updatedRegistration.studentId,
          studentName: updatedRegistration.name,
          name: updatedRegistration.name,
          email: updatedRegistration.email,
          phone: updatedRegistration.phone || '',
          registrationId: updatedRegistration.id,
          updatedAt: updatedRegistration.updatedAt || new Date()
          },
          {
            requestId: req.requestId,
            relatedEntityType: 'english_test',
            relatedEntityId: updatedRegistration.id,
          }
        );
        logger.simple.success('已發送報名修改通知郵件到中心信箱');

        // 發送修改完成通知給學生
        const modificationEmailData = {
          studentId: updatedRegistration.studentId,
          studentName: updatedRegistration.name,
          studentNameZh: updatedRegistration.studentNameZh || updatedRegistration.name,
          lastNameEn: updatedRegistration.lastNameEn || '',
          firstNameEn: updatedRegistration.firstNameEn || '',
          name: updatedRegistration.name,
          idNumber: updatedRegistration.idNumber || updatedRegistration.nationalId,
          nationalId: updatedRegistration.nationalId || updatedRegistration.idNumber,
          email: updatedRegistration.email,
          phone: updatedRegistration.phone || '',
          registrationId: updatedRegistration.id,
          updatedAt: updatedRegistration.updatedAt || new Date(),
          examType: updatedRegistration.examType
        };
        await emailLogService.sendEmailWithLog(
          'englishTestRegistrationModificationComplete',
          modificationEmailData,
          {
            requestId: req.requestId,
            relatedEntityType: 'english_test',
            relatedEntityId: updatedRegistration.id,
          }
        );
        logger.simple.success('已發送修改完成通知信給學生');
      } catch (emailError) {
        logger.error('發送報名修改通知郵件失敗', emailError);
      }

      publicLookupAudit(req, {
        action: 'english_test_registration_update_public',
        entityType: 'EnglishTestRegistration',
        entityId: registration.id,
        found: true,
        payload: { studentId: formData.studentId, name: formData.name, email: formData.email },
      });
      return genericLookupResponse(res, {
        found: true,
        message: 'If the registration matches the provided information, your request has been accepted for processing.',
        data: { registrationId: registration.id },
      });
    } catch (error) {
      logger.error('更新報名資料錯誤', error);
      
      // 處理各種 Sequelize 錯誤
      if (error.name === 'SequelizeValidationError') {
        const errors = error.errors.map(e => `${e.path}: ${e.message}`).join(', ');
        return res.status(400).json({ 
          error: '資料驗證失敗',
          details: errors
        });
      }
      
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// —— 培力英檢報名表單 schema（公開讀取 + 後台維護）——
router.get('/english-test/form-schema', async (req, res) => {
  try {
    const data = await englishTestFormSchemaService.getPublishedSchema();
    return res.json({
      success: true,
      data: {
        version: data.version,
        updatedAt: data.updatedAt,
        schema: data.schema,
        meta: englishTestFormSchemaService.extractOptionsMap(data.schema),
      },
    });
  } catch (error) {
    logger.error('讀取培力報名表單 schema 失敗', error);
    return res.status(500).json({ success: false, error: '無法載入報名表單設定' });
  }
});

router.get('/english-test/admin/form-schema', ...englishRegViewAuth, async (req, res) => {
  try {
    const data = await englishTestFormSchemaService.getPublishedSchema();
    return res.json({
      success: true,
      data: {
        id: data.id,
        version: data.version,
        status: data.status,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
        changeSummary: data.changeSummary,
        schema: data.schema,
        systemPartsBackfilled: Boolean(data.systemPartsBackfilled),
        allowedQuestionTypes: englishTestFormSchemaService.ALLOWED_QUESTION_TYPES,
      },
    });
  } catch (error) {
    logger.error('管理端讀取培力報名表單 schema 失敗', error);
    return res.status(500).json({ success: false, error: '無法載入報名表單設定' });
  }
});

router.put('/english-test/admin/form-schema', ...englishRegFormManageAuth, async (req, res) => {
  try {
    const schemaJson = req.body?.schema || req.body?.schemaJson || req.body;
    if (!schemaJson || typeof schemaJson !== 'object') {
      return res.status(400).json({ success: false, code: 'INVALID_SCHEMA', error: '缺少 schema' });
    }

    const saved = await englishTestFormSchemaService.savePublishedSchema(schemaJson, {
      userId: req.user?.id || null,
      changeSummary: req.body?.changeSummary || null,
    });

    auditLogService.logAuditAsync({
      module: 'english_test',
      action: 'form_schema.update',
      entityType: 'EnglishTestFormSchema',
      entityId: String(saved.id),
      targetSummary: `v${saved.version} questions=${saved.schema?.questions?.length || 0}`,
      afterData: {
        version: saved.version,
        questionCount: saved.schema?.questions?.length || 0,
        changeSummary: saved.changeSummary,
      },
      req,
    });

    return res.json({ success: true, data: saved });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      logger.error('儲存培力報名表單 schema 失敗', error);
    }
    return res.status(status).json({
      success: false,
      code: error.code || 'FORM_SCHEMA_SAVE_FAILED',
      error: error.message || '儲存失敗',
    });
  }
});

router.post('/english-test/admin/form-schema/reset', ...englishRegFormManageAuth, async (req, res) => {
  try {
    const saved = await englishTestFormSchemaService.savePublishedSchema(
      englishTestFormSchemaService.buildDefaultEnglishTestFormSchema(),
      {
        userId: req.user?.id || null,
        changeSummary: '重設為系統預設題目',
      }
    );
    auditLogService.logAuditAsync({
      module: 'english_test',
      action: 'form_schema.reset',
      entityType: 'EnglishTestFormSchema',
      entityId: String(saved.id),
      targetSummary: `reset to default v${saved.version}`,
      req,
    });
    return res.json({ success: true, data: saved });
  } catch (error) {
    logger.error('重設培力報名表單 schema 失敗', error);
    return res.status(error.status || 500).json({
      success: false,
      code: error.code || 'FORM_SCHEMA_RESET_FAILED',
      error: error.message || '重設失敗',
    });
  }
});

// API: 寄送報名信箱驗證碼
router.post(
  '/english-test/email-verification/send',
  publicEmailCodeSendRateLimit,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  async (req, res) => {
    try {
      const email = req.body?.email;
      const studentId = req.body?.studentId || null;
      const { code, expiresInSec, email: normalizedEmail } =
        await englishTestEmailVerificationService.createAndSendCode({ email, studentId });

      try {
        await emailLogService.sendEmailWithLog(
          'englishTestEmailVerification',
          {
            email: normalizedEmail,
            code,
            expiresInMinutes: Math.floor(expiresInSec / 60),
          },
          {
            requestId: req.requestId || `et-otp:${Date.now()}`,
            relatedEntityType: 'EnglishTestEmailVerification',
            relatedEntityId: normalizedEmail,
          }
        );
      } catch (mailErr) {
        logger.error('寄送信箱驗證碼郵件失敗', mailErr);
        // 寄信失敗則作廢剛建立的碼，讓學生可立刻重試
        try {
          await englishTestEmailVerificationService.invalidateActiveCodes(normalizedEmail);
        } catch (_) { /* ignore */ }
        return res.status(503).json({
          success: false,
          code: 'EMAIL_SEND_FAILED',
          error: '驗證碼寄送失敗，請稍後再試或確認信箱是否正確',
        });
      }

      return res.json({
        success: true,
        message: '驗證碼已寄至您的信箱，請於 10 分鐘內完成驗證',
        expiresInSec,
      });
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) logger.error('寄送信箱驗證碼失敗', error);
      return res.status(status).json({
        success: false,
        code: error.code || 'EMAIL_VERIFICATION_SEND_FAILED',
        error: error.message || '寄送驗證碼失敗，請稍後再試',
        retryAfterSec: error.retryAfterSec || undefined,
      });
    }
  }
);

// API: 驗證報名信箱驗證碼，回傳短效 token
router.post(
  '/english-test/email-verification/verify',
  publicEmailCodeVerifyRateLimit,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  async (req, res) => {
    try {
      const result = await englishTestEmailVerificationService.verifyCode({
        email: req.body?.email,
        code: req.body?.code,
      });
      return res.json({
        success: true,
        message: '信箱驗證成功',
        email: result.email,
        emailVerificationToken: result.emailVerificationToken,
        expiresInSec: result.expiresInSec,
      });
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) logger.error('驗證信箱驗證碼失敗', error);
      return res.status(status).json({
        success: false,
        code: error.code || 'EMAIL_VERIFICATION_FAILED',
        error: error.message || '驗證失敗，請稍後再試',
      });
    }
  }
);

// API: 提交報名（支援檔案上傳）
router.post('/english-test/register', 
  upload.fields([
    { name: 'b2CertificateFile', maxCount: 10 }, // 支援多檔案（最多10個）
    { name: 'b2CertificateFiles', maxCount: 10 }, // 支援多檔案（新欄位名稱）
    { name: 'disabilityCertFront', maxCount: 1 },
    { name: 'disabilityCertBack', maxCount: 1 },
    { name: 'idPhoto', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const registrationOpen = await isIndividualRegistrationEnabled();
      if (!registrationOpen) {
        return res.status(403).json({
          error: '培力英檢個人報名目前未開放',
          code: 'ENGLISH_TEST_REGISTRATION_CLOSED',
        });
      }

      logger.debug('收到報名請求', { body: req.body, files: req.files });

      const formData = req.body;
      const files = req.files;

      // 處理 FormData 中同名欄位變成陣列的問題（例如成績欄位）
      // 如果欄位是陣列，取第一個非空值或空字串
      const normalizeField = (value) => {
        if (Array.isArray(value)) {
          // 過濾空字串，取第一個有效值
          const filtered = value.filter(v => v && v.trim() !== '');
          return filtered.length > 0 ? filtered[0] : '';
        }
        return value || '';
      };

      // 標準化成績相關欄位
      formData.listeningExamType = normalizeField(formData.listeningExamType);
      formData.listeningScore = normalizeField(formData.listeningScore);
      formData.readingExamType = normalizeField(formData.readingExamType);
      formData.readingScore = normalizeField(formData.readingScore);
      formData.speakingExamType = normalizeField(formData.speakingExamType);
      formData.speakingScore = normalizeField(formData.speakingScore);
      formData.writingExamType = normalizeField(formData.writingExamType);
      formData.writingScore = normalizeField(formData.writingScore);

      // 驗證必要欄位
      if (!formData.studentId || !formData.name || !formData.idNumber) {
        return res.status(400).json({ error: '缺少必要欄位：學號、姓名、身分證字號' });
      }

      // 比對學號/身分證是否屬於同一位學生（由 admin 上傳學名單 Excel 決定）
      const rosterMismatch = await englishTestStudentIdCardRosterService.checkStudentIdIdNumberMatch({
        studentId: formData.studentId,
        idNumber: formData.idNumber,
      });
      if (!rosterMismatch.matched) {
        return res.status(409).json({
          success: false,
          code: rosterMismatch.code,
          error: rosterMismatch.message,
          message: rosterMismatch.message,
        });
      }

      // 有填寫 email 的首次報名須通過信箱驗證碼
      if (englishTestEmailVerificationService.requiresEmailVerification({
        submittedEmail: formData.email,
        isUpdate: false,
      })) {
        try {
          englishTestEmailVerificationService.assertEmailVerifiedToken({
            token: formData.emailVerificationToken,
            email: formData.email,
          });
        } catch (verifyErr) {
          return res.status(verifyErr.status || 400).json({
            success: false,
            code: verifyErr.code || 'EMAIL_VERIFICATION_REQUIRED',
            error: verifyErr.message || '請先完成信箱驗證',
          });
        }
      }

      // 處理檔案路徑（儲存相對路徑，方便前端訪問）
      // 路徑格式：uploads/english-test/id-photos/檔名 或 uploads/english-test/certificates/檔名
      const filePaths = {};
      const baseUploadPath = path.join(__dirname, '../uploads');
      
      // 取得學號和姓名，用於重新命名檔案
      const studentId = formData.studentId || '';
      const name = formData.name || formData.studentNameZh || '';
      const cleanStudentId = String(studentId).replace(/[^A-Z0-9]/g, '');
      const cleanName = String(name).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
      
      if (files) {
        // 處理 B2 成績證明（支援多檔案）
        // multer 已經根據 filename 函數將檔案命名為 學號-姓名(序號)-B2證書.副檔名
        const b2Files = files.b2CertificateFiles || (files.b2CertificateFile ? [files.b2CertificateFile[0]] : []);
        if (b2Files.length > 0) {
          const b2Paths = b2Files.map(file => {
            const relativePath = path.relative(baseUploadPath, file.path);
            return relativePath.replace(/\\/g, '/');
          });
          // 儲存為 JSON 陣列字串
          filePaths.b2CertificateFile = JSON.stringify(b2Paths);
          logger.debug('B2 證書檔案路徑（多檔案）', b2Paths);
        }
        if (files.disabilityCertFront && files.disabilityCertFront[0]) {
          const relativePath = path.relative(baseUploadPath, files.disabilityCertFront[0].path);
          filePaths.disabilityCertFront = relativePath.replace(/\\/g, '/');
        }
        if (files.disabilityCertBack && files.disabilityCertBack[0]) {
          const relativePath = path.relative(baseUploadPath, files.disabilityCertBack[0].path);
          filePaths.disabilityCertBack = relativePath.replace(/\\/g, '/');
        }
        if (files.idPhoto && files.idPhoto[0]) {
          const relativePath = path.relative(baseUploadPath, files.idPhoto[0].path);
          filePaths.idPhoto = relativePath.replace(/\\/g, '/');
          logger.debug('證件照檔案路徑', filePaths.idPhoto);
        }
      }

      // 處理 JSON 欄位（安全解析）
      let passedExamTypes = [];
      let disabilityTypes = [];
      let examAssistanceOptions = [];
      
      try {
        if (formData.passedExamTypes && formData.passedExamTypes.trim() !== '') {
          passedExamTypes = JSON.parse(formData.passedExamTypes);
        }
      } catch (e) {
        logger.warn('解析 passedExamTypes 失敗', e);
      }
      
      try {
        if (formData.disabilityTypes && formData.disabilityTypes.trim() !== '') {
          disabilityTypes = JSON.parse(formData.disabilityTypes);
        }
      } catch (e) {
        logger.warn('解析 disabilityTypes 失敗', e);
      }
      
      try {
        if (formData.examAssistanceOptions && formData.examAssistanceOptions.trim() !== '') {
          examAssistanceOptions = JSON.parse(formData.examAssistanceOptions);
        }
      } catch (e) {
        logger.warn('解析 examAssistanceOptions 失敗', e);
      }

      // 以 (studentId, semester) 為唯一鍵：改為統一由 Service 做 upsert / 防重複
      const { sequelize } = require('../models');
      const transaction = await sequelize.transaction();
      
      try {
        // 建立或更新報名記錄（Service 會依狀態規則決定是否允許覆蓋）
        logger.debug('準備建立報名記錄', {
          studentId: formData.studentId,
          name: formData.name,
          email: formData.email,
          examType: formData.examType,
          hasIdPhoto: !!filePaths.idPhoto
        });
        
        const { registration } = await englishTestRegistrationService.createOrUpdateRegistration({
          studentId: formData.studentId,
          name: formData.name,
          idNumber: formData.idNumber,
          email: formData.email,
          studentNameZh: formData.studentNameZh || formData.name,
          lastNameEn: formData.lastNameEn || '',
          firstNameEn: formData.firstNameEn || '',
          birthDate: formData.birthDate && formData.birthDate.trim() !== '' ? formData.birthDate : null,
          examType: formData.examType || null,
          hasTakenBESTEP: formData.hasTakenBESTEP || '否',
          hasCEFRB2: formData.hasCEFRB2 || '否',
          passedExamTypes: passedExamTypes.length > 0 ? passedExamTypes : null,
          passedExamOther: formData.passedExamOther || null,
          b2CertificateFile: filePaths.b2CertificateFile ? (typeof filePaths.b2CertificateFile === 'string' ? filePaths.b2CertificateFile : JSON.stringify(filePaths.b2CertificateFile)) : null,
          b2SkillType: formData.b2SkillType || null,
          // Q3: 各項成績（整合原 Q3 和 Q4）- 確保是字串而不是陣列
          listeningExamType: (formData.listeningExamType && formData.listeningExamType.trim() !== '') ? formData.listeningExamType : null,
          listeningScore: (formData.listeningScore && formData.listeningScore.trim() !== '') ? formData.listeningScore : null,
          readingExamType: (formData.readingExamType && formData.readingExamType.trim() !== '') ? formData.readingExamType : null,
          readingScore: (formData.readingScore && formData.readingScore.trim() !== '') ? formData.readingScore : null,
          speakingExamType: (formData.speakingExamType && formData.speakingExamType.trim() !== '') ? formData.speakingExamType : null,
          speakingScore: (formData.speakingScore && formData.speakingScore.trim() !== '') ? formData.speakingScore : null,
          writingExamType: (formData.writingExamType && formData.writingExamType.trim() !== '') ? formData.writingExamType : null,
          writingScore: (formData.writingScore && formData.writingScore.trim() !== '') ? formData.writingScore : null,
          nationalId: formData.nationalId || formData.idNumber,
          phone: formData.phone || '',
          postalCode: formData.postalCode || '',
          city: formData.city || '',
          district: formData.district || '',
          address: formData.address || '',
          degreeLevel: formData.degreeLevel || '',
          grade: formData.grade || '',
          college: formData.college || '',
          department: formData.department || '',
          isLowIncome: formData.isLowIncome || '否',
          hasDisabilityCard: formData.hasDisabilityCard || '否',
          disabilityTypes: disabilityTypes.length > 0 ? disabilityTypes : null,
          disabilityCertFront: filePaths.disabilityCertFront || null,
          disabilityCertBack: filePaths.disabilityCertBack || null,
          examAssistanceOptions: examAssistanceOptions.length > 0 ? examAssistanceOptions : null,
          examAssistanceOther: formData.examAssistanceOther || null,
          idPhoto: filePaths.idPhoto || null,
          agreedToTerms: formData.agreedToTerms === 'true' || formData.agreedToTerms === true || formData.agreedToTerms === 'true',
          infoSource: formData.infoSource || '',
          extraAnswers: parseExtraAnswersField(formData.extraAnswers),
          // 如果 examType 為 'NON'，status 設為 'revision'（不報名），否則為 'pending'（審核中）
          status: (formData.examType === 'NON') ? 'revision' : 'pending',
          // 根據報名時間自動判斷學期（空窗期 fallback 至 getCurrentSemester）
          semester: (() => {
            try {
              const { getActiveRegistrationSemester } = require('../utils/englishTestRegistrationSemester');
              return getActiveRegistrationSemester(new Date());
            } catch (error) {
              console.warn('無法判斷學期，將設為 null:', error);
              return null;
            }
          })()
        }, { transaction, actor: 'student' });

        // 提交事務
        await transaction.commit();

        logger.info(`報名記錄建立成功，ID: ${registration.id}`);

        // 立即回應成功（不等待寄信，提升響應速度）
        res.json({ 
          message: '報名成功',
          registrationId: registration.id 
        });

        // 寄信在背景處理（使用 emailQueue，不阻塞回應）
        const emailQueue = require('../utils/emailQueue');
      const requestId = req.requestId;
        
        // 重新載入完整記錄以確保取得所有欄位（背景處理）
        EnglishTestRegistration.findByPk(registration.id)
          .then(fullRegistration => {
          return emailQueue.enqueue('englishTestRegistrationSuccess', {
              studentId: fullRegistration.studentId,
              studentName: fullRegistration.name,
              studentNameZh: fullRegistration.studentNameZh || fullRegistration.name,
              lastNameEn: fullRegistration.lastNameEn || '',
              firstNameEn: fullRegistration.firstNameEn || '',
              name: fullRegistration.name,
              idNumber: fullRegistration.idNumber || fullRegistration.nationalId,
              nationalId: fullRegistration.nationalId || fullRegistration.idNumber,
              email: fullRegistration.email,
              phone: fullRegistration.phone || '',
              registrationId: fullRegistration.id,
              registrationDate: fullRegistration.createdAt,
              status: fullRegistration.status,
              examType: fullRegistration.examType,
              hasCEFRB2: fullRegistration.hasCEFRB2 || '否',
              listeningExamType: fullRegistration.listeningExamType,
              listeningScore: fullRegistration.listeningScore,
              readingExamType: fullRegistration.readingExamType,
              readingScore: fullRegistration.readingScore,
              speakingExamType: fullRegistration.speakingExamType,
              speakingScore: fullRegistration.speakingScore,
              writingExamType: fullRegistration.writingExamType,
              writingScore: fullRegistration.writingScore
            }, {
              requestId,
              relatedEntityType: 'english_test',
              relatedEntityId: fullRegistration.id,
            });
          })
          .catch(err => {
            logger.error('郵件加入佇列失敗', err);
            // 不影響報名成功
          });
      } catch (createError) {
        // 如果建立失敗，回滾事務
        await transaction.rollback();

        // Phase 1：同學期重複報名的商業規則回應（由 service 統一決定）
        if (createError?.status && typeof createError.status === 'number') {
          return res.status(createError.status).json({
            error: createError.message,
            code: createError.code || 'ENGLISH_TEST_REGISTRATION_ERROR'
          });
        }
        if (createError?.code === 'DUPLICATE_REGISTRATION_NOT_ALLOWED' || createError?.status === 409) {
          return res.status(409).json({
            error: createError.message,
            code: createError.code || 'DUPLICATE_REGISTRATION_NOT_ALLOWED'
          });
        }

        // 重新拋出其他錯誤，讓外層 catch 處理
        throw createError;
      }
    } catch (error) {
      logger.error('提交報名錯誤', error);
      
      // 處理各種 Sequelize 錯誤
      if (error.name === 'SequelizeValidationError') {
        const errors = error.errors.map(e => `${e.path}: ${e.message}`).join(', ');
        logger.error('資料驗證失敗', { errors });
        return res.status(400).json({ 
          error: '資料驗證失敗',
          details: errors,
          fields: error.errors.map(e => ({ field: e.path, message: e.message }))
        });
      }
      
      // 處理唯一約束錯誤（重複報名）
      if (error.name === 'SequelizeUniqueConstraintError') {
        logger.error('唯一約束錯誤（可能重複報名）', error);
        // 檢查是哪個欄位違反唯一約束
        const field = error.errors && error.errors[0] ? error.errors[0].path : 'unknown';
        if (field === 'studentId' || field === 'semester') {
          return res.status(409).json({ 
            error: '您本學期已經報名過了',
            code: 'DUPLICATE_REGISTRATION'
          });
        }
        return res.status(409).json({ 
          error: '資料重複',
          details: error.message
        });
      }
      
      // 處理資料庫連接錯誤
      if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeConnectionRefusedError') {
        logger.error('資料庫連接錯誤', error);
        return res.status(503).json({ 
          error: '資料庫連接失敗，請稍後再試',
          code: 'DATABASE_ERROR'
        });
      }
      
      // 處理其他 Sequelize 錯誤
      if (error.name && error.name.startsWith('Sequelize')) {
        logger.error('Sequelize 錯誤', error);
        return res.status(400).json({ 
          error: '資料處理錯誤',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          code: error.name
        });
      }
      
      // 處理其他錯誤
      res.status(500).json({ 
        error: '伺服器錯誤，請稍後再試',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// Multer 錯誤處理中間件
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    logger.error('Multer 錯誤', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '檔案大小超過限制 (5MB)' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: '檔案數量超過限制' });
    }
    return res.status(400).json({ error: `檔案上傳錯誤: ${error.message}` });
  }
  
  if (error.message && error.message.includes('只允許上傳')) {
    return res.status(400).json({ error: error.message });
  }
  
  next(error);
});

// API: 儀表板用 — 待審核報名筆數（不含清單內容）
router.get('/english-test/registrations/metrics/pending-count', ...englishRegMetricsAuth, async (req, res) => {
  try {
    const count = await EnglishTestRegistration.count({ where: { status: 'pending' } });
    res.json({ count });
  } catch (error) {
    logger.error('pending-count 錯誤', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

async function queryRegistrationGroupStats(columnName) {
  const { sequelize } = require('../models');
  const allowed = new Set(['infoSource', 'department', 'grade']);
  if (!allowed.has(columnName)) {
    throw new Error(`不支援的統計欄位: ${columnName}`);
  }
  const rows = await sequelize.query(
    `SELECT ${columnName} AS label, COUNT(*) AS count
     FROM english_test_registrations
     WHERE ${columnName} IS NOT NULL AND TRIM(${columnName}) != ''
     GROUP BY ${columnName}
     ORDER BY count DESC, label ASC`,
    { type: QueryTypes.SELECT }
  );
  const data = (rows || []).map((r) => ({
    label: r.label,
    count: Number(r.count) || 0,
  }));
  const total = data.reduce((sum, r) => sum + r.count, 0);
  return { data, total };
}

// API: 取得報名表單 Q21（從何得知培力英檢 / infoSource）統計（相容舊前端）
router.get('/english-test/registrations/stats/info-source', ...englishRegViewAuth, async (req, res) => {
  try {
    const result = await queryRegistrationGroupStats('infoSource');
    res.json(result);
  } catch (error) {
    logger.error('Q21 統計錯誤', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// API: 數據分析（Q21 宣傳來源、系所、年級）
router.get('/english-test/registrations/stats/analytics', ...englishRegViewAuth, async (req, res) => {
  try {
    const [infoSource, department, grade] = await Promise.all([
      queryRegistrationGroupStats('infoSource'),
      queryRegistrationGroupStats('department'),
      queryRegistrationGroupStats('grade'),
    ]);
    res.json({ infoSource, department, grade });
  } catch (error) {
    logger.error('英檢數據分析統計錯誤', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// API: 抵免審核列表（有填寫 B2 成績、依學期篩選）
router.get('/english-test/registrations/exemption-review', ...englishRegViewAuth, async (req, res) => {
  try {
    const { semester, page = 1, limit = 50, search = '' } = req.query;
    if (!semester || String(semester).trim() === '') {
      return res.status(400).json({ error: '請指定學期 semester' });
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

    const where = { semester: String(semester).trim() };

    const all = await EnglishTestRegistration.findAll({
      where,
      order: [['updatedAt', 'DESC'], ['id', 'DESC']]
    });

    // 同一學期同一學生可能仍殘留多筆資料（例如歷史重複）。
    // 為避免抵免審核清單顯示與「實際最後一次填寫」不一致，先取每位學生最新一筆。
    const latestPerStudent = Object.values(pickLatestRegistrationPerStudent(all));

    const withB2 = latestPerStudent.filter((r) => hasB2ScoresFilled(r));
    let filtered = withB2;
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      filtered = withB2.filter(
        (r) =>
          (r.studentId && r.studentId.toLowerCase().includes(q)) ||
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.studentNameZh && r.studentNameZh.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const offset = (pageNum - 1) * limitNum;
    const slice = filtered.slice(offset, offset + limitNum);

    const classRows = slice.length
      ? await ClassMembership.findAll({
          where: {
            semester: where.semester,
            studentId: { [Op.in]: slice.map((r) => r.studentId) }
          }
        })
      : [];
    const classByStudent = {};
    classRows.forEach((cm) => {
      if (!classByStudent[cm.studentId]) {
        classByStudent[cm.studentId] = cm.classId;
      }
    });

    const data = maskEnglishTestRegistrationListForAdminApi(
      slice.map((r) => ({
        ...r.toJSON(),
        studentRequestedExemptionLabel: inferStudentRequestedExemptionLabel(r),
        exemptionStatusLabel: mapExemptionReviewStatusToLabel(r.exemption_review_status),
        bestepClassId: classByStudent[r.studentId] || null
      }))
    );

    res.json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  } catch (error) {
    logger.error('抵免審核列表錯誤', error);
    res.status(500).json({ error: error.message || '伺服器錯誤' });
  }
});

function mapExemptionReviewStatusToLabel(status) {
  if (status == null || status === '') return '未審核';
  const m = {
    pending: '審核中',
    approved: '已通過',
    rejected: '已拒絕',
    revision: '退回修正'
  };
  return m[status] || status;
}

// API: 更新抵免審核（Approve / Reject / Revision）
router.put('/english-test/registrations/:id/exemption-review', ...englishRegReviewAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: '無效的報名 ID' });
    }
    const {
      exemption_review_status,
      exemption_verified_type,
      exemption_review_note
    } = req.body || {};

    const allowed = ['pending', 'approved', 'rejected', 'revision'];
    if (!exemption_review_status || !allowed.includes(exemption_review_status)) {
      return res.status(400).json({ error: `exemption_review_status 須為：${allowed.join('/')}` });
    }

    if (exemption_review_status === 'approved') {
      if (!exemption_verified_type || !EXEMPTION_VERIFIED_CODES.includes(exemption_verified_type)) {
        return res.status(400).json({ error: `審核通過時 exemption_verified_type 須為：${EXEMPTION_VERIFIED_CODES.join('/')}` });
      }
    } else {
      if (exemption_verified_type && !EXEMPTION_VERIFIED_CODES.includes(exemption_verified_type)) {
        return res.status(400).json({ error: 'exemption_verified_type 代碼不正確' });
      }
    }

    const reg = await EnglishTestRegistration.findByPk(id);
    if (!reg) {
      return res.status(404).json({ error: '找不到報名資料' });
    }
    if (!hasB2ScoresFilled(reg)) {
      return res.status(400).json({ error: '此筆報名未填寫 B2 成績，無法進行抵免審核' });
    }

    const reviewer =
      (req.user && (req.user.username || req.user.name || req.user.sub)) || 'admin';

    const updatePayload = {
      exemption_review_status,
      exemption_review_note: exemption_review_note != null ? String(exemption_review_note) : null,
      exemption_reviewed_at: new Date(),
      exemption_reviewed_by: reviewer
    };

    if (exemption_review_status === 'approved') {
      updatePayload.exemption_verified_type = exemption_verified_type;
    } else {
      updatePayload.exemption_verified_type = null;
    }

    const before = {
      exemption_review_status: reg.exemption_review_status || null,
      exemption_verified_type: reg.exemption_verified_type || null,
      exemption_review_note: reg.exemption_review_note || null,
    };

    await reg.update(updatePayload);
    const updated = await EnglishTestRegistration.findByPk(id);

    // 稽核：英檢單筆審核（抵免審核）
    auditLogService.logAuditAsync({
      module: 'english_test',
      action: 'exemption_review_single',
      entityType: 'EnglishTestRegistration',
      entityId: updated.id,
      targetSummary: `registrationId=${updated.id}`,
      beforeData: before,
      afterData: {
        exemption_review_status: updated.exemption_review_status || null,
        exemption_verified_type: updated.exemption_verified_type || null,
      },
      changedFields: Object.keys(updatePayload).slice(0, 25),
      req,
    });
    res.json({
      message: '已更新抵免審核',
      data: maskEnglishTestRegistrationForAdminApi(updated),
    });
  } catch (error) {
    logger.error('抵免審核更新錯誤', error);
    res.status(500).json({ error: error.message || '伺服器錯誤' });
  }
});

// API: 取得報名列表（管理員用）
router.get('/english-test/registrations', ...englishRegViewAuth, async (req, res) => {
  try {
    // 舊版參數（保持相容）
    const { page = 1, limit = 20, status, search } = req.query;
    
    // 新版參數（可選，向下相容）
    const {
      dateFrom,           // 日期範圍起始
      dateTo,             // 日期範圍結束
      examTypes,          // 測驗類型（陣列）
      isLowIncome,         // 中低收入戶
      hasDisabilityCard,   // 身心障礙
      semester,            // 學期篩選
      sortBy,              // 排序欄位
      sortOrder            // 排序方向（預設：DESC）
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    // === 舊版邏輯（保持不變） ===
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where[Op.or] = [
        { studentId: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    // === 新版邏輯（向下相容） ===
    // 日期範圍篩選
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        // 結束日期包含整天（23:59:59）
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = endDate;
      }
    }

    // 測驗類型篩選（支援陣列或逗號分隔字串）
    // 特殊處理：'LR' 包含 'LR' 和 'LRSW'，'SW' 包含 'SW' 和 'LRSW'
    if (examTypes) {
      const examArray = Array.isArray(examTypes)
        ? examTypes
        : (typeof examTypes === 'string' ? examTypes.split(',').map(s => s.trim()).filter(Boolean) : [examTypes]);
      if (examArray.length > 0) {
        // 擴展篩選條件：LR 和 SW 需要包含 LRSW
        const expandedArray = [];
        examArray.forEach(type => {
          if (type === 'LR') {
            // 報名聽讀：包含 LR 和 LRSW
            if (!expandedArray.includes('LR')) expandedArray.push('LR');
            if (!expandedArray.includes('LRSW')) expandedArray.push('LRSW');
          } else if (type === 'SW') {
            // 報名說寫：包含 SW 和 LRSW
            if (!expandedArray.includes('SW')) expandedArray.push('SW');
            if (!expandedArray.includes('LRSW')) expandedArray.push('LRSW');
          } else {
            // 其他類型（如 NON, LRSW）直接加入
            if (!expandedArray.includes(type)) expandedArray.push(type);
          }
        });
        where.examType = { [Op.in]: expandedArray };
      }
    }

    // 特殊身分篩選
    if (isLowIncome) {
      where.isLowIncome = isLowIncome;
    }
    if (hasDisabilityCard) {
      where.hasDisabilityCard = hasDisabilityCard;
    }
    
    // 學期篩選
    if (semester) {
      where.semester = semester;
    }

    // 排序（預設：報名時間最新優先，DESC）
    let orderBy;
    if (sortBy && sortOrder) {
      // 新版排序
      const validSortFields = ['id', 'studentId', 'name', 'email', 'college', 'status', 'createdAt', 'updatedAt', 'approvedAt', 'successSequence'];
      const validSortOrder = ['ASC', 'DESC'];
      
      if (validSortFields.includes(sortBy) && validSortOrder.includes(sortOrder.toUpperCase())) {
        if (sortBy === 'status') {
          // 自訂狀態排序：pending -> approved -> revision -> success -> failed
          orderBy = [[Sequelize.literal('CASE WHEN status = \'pending\' THEN 1 WHEN status = \'approved\' THEN 2 WHEN status = \'revision\' THEN 3 WHEN status = \'success\' THEN 4 WHEN status = \'failed\' THEN 5 ELSE 6 END'), sortOrder.toUpperCase()]];
        } else if (sortBy === 'successSequence') {
          // successSequence 排序：NULL 值排在最後
          orderBy = [[Sequelize.literal('COALESCE("successSequence", 2147483647)'), sortOrder.toUpperCase()], ['approvedAt', 'ASC'], ['id', 'ASC']];
        } else {
          orderBy = [[sortBy, sortOrder.toUpperCase()]];
        }
      } else {
        // 無效的排序參數，使用預設
        orderBy = [['createdAt', 'DESC']];
      }
    } else {
      // 預設排序：報名時間最新優先（DESC）
      orderBy = [['createdAt', 'DESC']];
    }

    const { count, rows } = await EnglishTestRegistration.findAndCountAll({
      where,
      order: orderBy,
      limit: parseInt(limit),
      offset: offset
    });

    // 為每筆記錄計算按學期的編號（semesterSequence）
    // 使用 SQL 窗口函數計算每筆記錄在該學期內的序號（按 createdAt ASC, id ASC 排序）
    // 重要：semesterSequence 必須基於該學期的「所有記錄」計算，而不是當前查詢結果
    // 這樣才能確保在不同篩選條件下，同一筆記錄的 semesterSequence 保持一致
    const rowIds = rows.map(row => row.id);
    let semesterSequenceMap = {};
    
    if (rowIds.length > 0) {
      // 取得 sequelize 實例（用於執行原始 SQL 查詢）
      const { sequelize } = require('../models');
      
      // 取得所有記錄的學期資訊（用於計算 semesterSequence）
      const semesters = [...new Set(rows.map(row => row.semester).filter(Boolean))];
      
      // 如果有學期篩選條件，使用該學期；否則使用所有記錄的學期
      const targetSemester = semester || (semesters.length === 1 ? semesters[0] : null);
      
      // 使用 SQL 窗口函數計算序號（基於該學期的所有記錄，不限制於當前查詢結果）
      // 這樣可以確保無論如何篩選，同一筆記錄的 semesterSequence 都一致
      let sequenceQuery = `
        SELECT 
          id,
          ROW_NUMBER() OVER (
            PARTITION BY semester 
            ORDER BY createdAt ASC, id ASC
          ) as semesterSequence
        FROM english_test_registrations
      `;
      
      const replacements = {};
      
      // 如果有學期篩選，只計算該學期的記錄；否則計算所有學期
      if (targetSemester) {
        sequenceQuery += ` WHERE semester = :targetSemester`;
        replacements.targetSemester = targetSemester;
      }
      
      const sequenceResults = await sequelize.query(sequenceQuery, {
        replacements,
        type: QueryTypes.SELECT
      });
      
      // 建立 id -> 序號的映射（只包含當前查詢結果中的記錄）
      sequenceResults.forEach(result => {
        if (rowIds.includes(result.id)) {
          semesterSequenceMap[result.id] = result.semesterSequence;
        }
      });
    }
    
    // 為每筆記錄添加 semesterSequence
    const rowsWithSequence = rows.map(row => {
      const rowData = row.toJSON();
      rowData.semesterSequence = semesterSequenceMap[row.id] || null;
      return rowData;
    });

    // 使用 SQL 聚合查詢計算統計資訊（性能優化：避免載入所有記錄到記憶體）
    const { sequelize } = require('../models');
    
    // 構建 WHERE 條件字串和參數（與現有 where 對象對應）
    const whereConditions = [];
    const replacements = {};

    if (where.status) {
      whereConditions.push(`status = :status`);
      replacements.status = where.status;
    }

    if (where.createdAt) {
      if (where.createdAt[Op.gte]) {
        whereConditions.push(`createdAt >= :dateFrom`);
        replacements.dateFrom = where.createdAt[Op.gte];
      }
      if (where.createdAt[Op.lte]) {
        whereConditions.push(`createdAt <= :dateTo`);
        replacements.dateTo = where.createdAt[Op.lte];
      }
    }

    if (where.examType && where.examType[Op.in]) {
      whereConditions.push(`examType IN (:examTypes)`);
      replacements.examTypes = where.examType[Op.in];
    }

    if (where.isLowIncome) {
      whereConditions.push(`isLowIncome = :isLowIncome`);
      replacements.isLowIncome = where.isLowIncome;
    }

    if (where.hasDisabilityCard) {
      whereConditions.push(`hasDisabilityCard = :hasDisabilityCard`);
      replacements.hasDisabilityCard = where.hasDisabilityCard;
    }
    
    if (where.semester) {
      whereConditions.push(`semester = :semester`);
      replacements.semester = where.semester;
    }

    // 處理搜尋條件（studentId, name, email）
    if (where[Op.or]) {
      const orConditions = [];
      where[Op.or].forEach((condition, index) => {
        if (condition.studentId && condition.studentId[Op.like]) {
          orConditions.push(`studentId LIKE :search${index}`);
          replacements[`search${index}`] = condition.studentId[Op.like];
        } else if (condition.name && condition.name[Op.like]) {
          orConditions.push(`name LIKE :search${index}`);
          replacements[`search${index}`] = condition.name[Op.like];
        } else if (condition.email && condition.email[Op.like]) {
          orConditions.push(`email LIKE :search${index}`);
          replacements[`search${index}`] = condition.email[Op.like];
        }
      });
      if (orConditions.length > 0) {
        whereConditions.push(`(${orConditions.join(' OR ')})`);
      }
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // 統計卡片根據學期篩選條件計算（如果有提供學期參數）
    // 建立統計查詢的 WHERE 條件（只使用學期篩選，不包含其他篩選條件）
    const statsWhereConditions = [];
    const statsReplacements = {};
    
    if (semester) {
      statsWhereConditions.push(`semester = :statsSemester`);
      statsReplacements.statsSemester = semester;
    }
    
    const statsWhereClause = statsWhereConditions.length > 0 
      ? `WHERE ${statsWhereConditions.join(' AND ')}`
      : '';

    const globalStatsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'revision' THEN 1 ELSE 0 END) as revision,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN examType = 'NON' THEN 1 ELSE 0 END) as nonExam,
        SUM(CASE WHEN examType IN ('LRSW', 'LR') THEN 1 ELSE 0 END) as listeningReading,
        SUM(CASE WHEN examType IN ('LRSW', 'SW') THEN 1 ELSE 0 END) as speakingWriting
      FROM english_test_registrations
      ${statsWhereClause}
    `;

    const globalStatsResult = await sequelize.query(globalStatsQuery, {
      type: QueryTypes.SELECT,
      replacements: statsReplacements
    });

    const stats = {
      total: parseInt(globalStatsResult[0]?.total) || 0,
      pending: parseInt(globalStatsResult[0]?.pending) || 0,
      approved: parseInt(globalStatsResult[0]?.approved) || 0,
      revision: parseInt(globalStatsResult[0]?.revision) || 0,
      success: parseInt(globalStatsResult[0]?.success) || 0,
      failed: parseInt(globalStatsResult[0]?.failed) || 0,
      nonExam: parseInt(globalStatsResult[0]?.nonExam) || 0,
      listeningReading: parseInt(globalStatsResult[0]?.listeningReading) || 0,
      speakingWriting: parseInt(globalStatsResult[0]?.speakingWriting) || 0
    };

    // 回應（新增 meta 欄位，不影響舊版）
    const response = {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
      data: maskEnglishTestRegistrationListForAdminApi(rowsWithSequence),
      stats: stats
    };

    // 新增 meta 資訊（僅在請求包含新參數時提供）
    if (dateFrom || dateTo || examTypes || isLowIncome || hasDisabilityCard || semester || sortBy) {
      response.meta = {
        appliedFilters: {
          dateFrom,
          dateTo,
          examTypes: examTypes ? (Array.isArray(examTypes) ? examTypes : [examTypes]) : null,
          isLowIncome,
          hasDisabilityCard,
          semester
        },
        sortInfo: sortBy ? { by: sortBy, order: sortOrder || 'DESC' } : { by: 'createdAt', order: 'DESC' },
        searchResultCount: count
      };
    }

    res.json(response);
  } catch (error) {
    logger.error('取得報名列表錯誤', error);
    console.error('取得報名列表錯誤詳情:', error);
    res.status(500).json({ 
      error: '伺服器錯誤',
      message: error.message || '未知錯誤',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API: 英檢學名單 Excel 上傳/覆蓋（admin）
router.post(
  '/english-test/admin/student-roster/upload',
  ...englishRegFormManageAuth,
  rosterExcelUpload.single('file'),
  async (req, res) => {
    let savedPath;
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          code: 'NO_FILE',
          error: '尚未提供上傳檔案',
          message: '尚未提供上傳檔案',
        });
      }

      savedPath = file.path;
      const buffer = fs.readFileSync(file.path);

      // 覆蓋策略：DB 只保留最新 upload/entries，原始 Excel 檔不保留（以免堆疊檔案）
      const result = await englishTestStudentIdCardRosterService.replaceLatestRosterFromUpload({
        fileNameOriginal: file.originalname,
        storedFileUrl: null,
        buffer,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('學名單 Excel 上傳失敗', error);
      return res.status(400).json({
        success: false,
        code: error.code || 'ROSTER_UPLOAD_FAILED',
        error: error.message || '學名單解析/儲存失敗',
        message: error.message || '學名單解析/儲存失敗',
      });
    } finally {
      if (savedPath && fs.existsSync(savedPath)) {
        try {
          fs.unlinkSync(savedPath);
        } catch {
          // ignore
        }
      }
    }
  }
);

// API: 英檢學名單內容預覽（admin）
router.get(
  '/english-test/admin/student-roster',
  ...englishRegFormManageAuth,
  async (req, res) => {
    try {
      const { offset, limit } = req.query;
      const data = await englishTestStudentIdCardRosterService.getLatestRosterPreview({
        offset: offset ? Number(offset) : 0,
        limit: limit ? Number(limit) : 30,
      });

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('取得學名單預覽失敗', error);
      return res.status(500).json({
        success: false,
        error: error.message || '伺服器錯誤',
        message: error.message || '伺服器錯誤',
      });
    }
  }
);

// API: 下載英檢學名單 Excel 範例檔（admin）
router.get(
  '/english-test/admin/student-roster/sample-xlsx',
  ...englishRegFormManageAuth,
  async (req, res) => {
    try {
      const workbook = englishTestStudentIdCardRosterService.buildRosterSampleWorkbook();

      const fileName = 'english-test-student-roster-sample.xlsx';
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      logger.error('下載學名單範例檔失敗', error);
      return res.status(500).json({
        success: false,
        error: error.message || '伺服器錯誤',
        message: error.message || '伺服器錯誤',
      });
    }
  }
);

// API: 根據學號、姓名、身分證字號查詢報名資料（公開，用於檢視與修正）
router.post(
  '/english-test/registrations/query',
  publicEnglishTestLookupRateLimit,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  requireLookupMinimumFields({ requireStudentId: true, requireName: true }),
  async (req, res) => {
  try {
    const { studentId, name, idNumber } = req.body;

    // 驗證必要欄位（公開查詢僅需學號／姓名／身分證，與前端身分驗證步驟一致）
    if (!studentId || !name || !idNumber) {
      return res.status(400).json({ success: false, message: 'Invalid query.' });
    }

    const trimmedStudentId = studentId.trim();
    const trimmedName = name.trim();
    const trimmedIdNumber = idNumber.trim().toUpperCase();

    // 比對學號/身分證是否屬於同一位學生（由 admin 上傳學名單 Excel 決定）
    const rosterMismatch = await englishTestStudentIdCardRosterService.checkStudentIdIdNumberMatch({
      studentId: trimmedStudentId,
      idNumber: trimmedIdNumber,
    });
    if (!rosterMismatch.matched) {
      return res.status(409).json({
        success: false,
        code: rosterMismatch.code,
        error: rosterMismatch.message,
        message: rosterMismatch.message,
      });
    }

    const lookup = await englishTestRegistrationService.queryPublicRegistration({
      studentId: trimmedStudentId,
      name: trimmedName,
      idNumber: trimmedIdNumber,
    });

    if (!lookup.found) {
      publicLookupAudit(req, {
        action: 'english_test_registration_query_public',
        entityType: 'EnglishTestRegistration',
        entityId: trimmedStudentId,
        found: false,
        payload: { studentId: trimmedStudentId, name: trimmedName, semester: lookup.semester },
      });
      return genericLookupResponse(res, {
        found: false,
        message: 'Request processed.',
        data: { semester: lookup.semester },
      });
    }

    const { registration, canEdit, statusMessage, semester, legacySemesterInferred } = lookup;

    publicLookupAudit(req, {
      action: 'english_test_registration_query_public',
      entityType: 'EnglishTestRegistration',
      entityId: registration.id,
      found: true,
      payload: { studentId: trimmedStudentId, name: trimmedName, semester },
    });
    return genericLookupResponse(res, {
      found: true,
      message: 'Request processed.',
      data: {
        registration,
        canEdit,
        statusMessage,
        semester,
        isCurrentSemester: true,
        legacySemesterInferred: Boolean(legacySemesterInferred),
      }
    });
  } catch (error) {
    logger.error('查詢報名資料錯誤', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// API: 依報名紀錄查班級 BESTEP 連結（學號＋學期對應 class_memberships）
router.get('/english-test/registrations/:id/class-bestep-link', ...englishRegViewAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: '無效的報名 ID' });
    }
    const registration = await EnglishTestRegistration.findByPk(id);
    if (!registration) {
      return res.status(404).json({ error: '找不到報名資料' });
    }
    const semester = registration.semester;
    if (!semester) {
      return res.json({ classId: null, semester: null });
    }
    const cm = await ClassMembership.findOne({
      where: { studentId: registration.studentId, semester }
    });
    res.json({
      classId: cm ? cm.classId : null,
      semester
    });
  } catch (error) {
    logger.error('class-bestep-link 錯誤', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// API: 取得單一報名資料（管理員用）
router.get('/english-test/registrations/:id', ...englishRegViewAuth, async (req, res) => {
  try {
    const registration = await EnglishTestRegistration.findByPk(req.params.id);
    
    if (!registration) {
      return res.status(404).json({ error: '找不到報名資料' });
    }

    res.json(maskEnglishTestRegistrationForAdminApi(registration));
  } catch (error) {
    logger.error('取得報名資料錯誤', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// API: 管理員新增/更換證件照、成績證明、身心障礙證明（僅限已登入管理後台）
router.put('/english-test/registrations/:id/files', ...englishRegReviewAuth,
  updateUpload.fields([
    { name: 'idPhoto', maxCount: 1 },
    { name: 'b2CertificateFile', maxCount: 1 },
    { name: 'disabilityCertFront', maxCount: 1 },
    { name: 'disabilityCertBack', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const registrationId = req.params.id;
      const files = req.files;

      const registration = await EnglishTestRegistration.findByPk(registrationId);
      if (!registration) {
        return res.status(404).json({ error: '找不到報名資料' });
      }

      const filePaths = {};
      const baseUploadPath = path.join(__dirname, '../uploads');
      const idNumber = registration.idNumber || registration.nationalId || '';
      const name = registration.name || registration.studentNameZh || '';
      const cleanIdNumber = String(idNumber).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanName = String(name).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');

      if (files) {
        if (files.idPhoto && files.idPhoto[0]) {
          if (registration.idPhoto && cleanIdNumber && cleanName) {
            const oldFilePath = path.join(baseUploadPath, registration.idPhoto);
            if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
            const oldExt = path.extname(registration.idPhoto);
            const newFileName = `${cleanIdNumber}-${cleanName}-證件照${oldExt}`;
            const newFilePath = path.join(idPhotoDir, newFileName);
            if (fs.existsSync(files.idPhoto[0].path)) {
              if (!fs.existsSync(idPhotoDir)) fs.mkdirSync(idPhotoDir, { recursive: true });
              if (fs.existsSync(newFilePath)) fs.unlinkSync(newFilePath);
              fs.renameSync(files.idPhoto[0].path, newFilePath);
            }
            filePaths.idPhoto = path.relative(baseUploadPath, newFilePath).replace(/\\/g, '/');
          } else {
            filePaths.idPhoto = path.relative(baseUploadPath, files.idPhoto[0].path).replace(/\\/g, '/');
          }
        }
        if (files.b2CertificateFile && files.b2CertificateFile[0]) {
          if (registration.b2CertificateFile && cleanIdNumber && cleanName) {
            let oldPath = registration.b2CertificateFile;
            try {
              const parsed = typeof oldPath === 'string' ? JSON.parse(oldPath) : oldPath;
              oldPath = Array.isArray(parsed) ? parsed[0] : oldPath;
            } catch (e) { /* single path */ }
            const oldFilePath = path.join(baseUploadPath, oldPath);
            if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
          }
          const ext = path.extname(files.b2CertificateFile[0].originalname);
          const newFileName = `${cleanIdNumber}-${cleanName}-B2證書${ext}`;
          const newFilePath = path.join(certificateDir, newFileName);
          if (fs.existsSync(files.b2CertificateFile[0].path)) {
            if (!fs.existsSync(certificateDir)) fs.mkdirSync(certificateDir, { recursive: true });
            if (fs.existsSync(newFilePath)) fs.unlinkSync(newFilePath);
            fs.renameSync(files.b2CertificateFile[0].path, newFilePath);
          }
          filePaths.b2CertificateFile = path.relative(baseUploadPath, newFilePath).replace(/\\/g, '/');
        }
        if (files.disabilityCertFront && files.disabilityCertFront[0]) {
          if (registration.disabilityCertFront && cleanIdNumber && cleanName) {
            const oldFilePath = path.join(baseUploadPath, registration.disabilityCertFront);
            if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
            const oldExt = path.extname(registration.disabilityCertFront);
            const newFileName = `${cleanIdNumber}-${cleanName}-障礙證明正面${oldExt}`;
            const newFilePath = path.join(disabilityCertDir, newFileName);
            if (fs.existsSync(files.disabilityCertFront[0].path)) {
              if (!fs.existsSync(disabilityCertDir)) fs.mkdirSync(disabilityCertDir, { recursive: true });
              if (fs.existsSync(newFilePath)) fs.unlinkSync(newFilePath);
              fs.renameSync(files.disabilityCertFront[0].path, newFilePath);
            }
            filePaths.disabilityCertFront = path.relative(baseUploadPath, newFilePath).replace(/\\/g, '/');
          } else {
            filePaths.disabilityCertFront = path.relative(baseUploadPath, files.disabilityCertFront[0].path).replace(/\\/g, '/');
          }
        }
        if (files.disabilityCertBack && files.disabilityCertBack[0]) {
          if (registration.disabilityCertBack && cleanIdNumber && cleanName) {
            const oldFilePath = path.join(baseUploadPath, registration.disabilityCertBack);
            if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
            const oldExt = path.extname(registration.disabilityCertBack);
            const newFileName = `${cleanIdNumber}-${cleanName}-障礙證明反面${oldExt}`;
            const newFilePath = path.join(disabilityCertDir, newFileName);
            if (fs.existsSync(files.disabilityCertBack[0].path)) {
              if (!fs.existsSync(disabilityCertDir)) fs.mkdirSync(disabilityCertDir, { recursive: true });
              if (fs.existsSync(newFilePath)) fs.unlinkSync(newFilePath);
              fs.renameSync(files.disabilityCertBack[0].path, newFilePath);
            }
            filePaths.disabilityCertBack = path.relative(baseUploadPath, newFilePath).replace(/\\/g, '/');
          } else {
            filePaths.disabilityCertBack = path.relative(baseUploadPath, files.disabilityCertBack[0].path).replace(/\\/g, '/');
          }
        }
      }

      const updateData = {};
      if (filePaths.idPhoto) updateData.idPhoto = filePaths.idPhoto;
      if (filePaths.b2CertificateFile) updateData.b2CertificateFile = filePaths.b2CertificateFile;
      if (filePaths.disabilityCertFront) updateData.disabilityCertFront = filePaths.disabilityCertFront;
      if (filePaths.disabilityCertBack) updateData.disabilityCertBack = filePaths.disabilityCertBack;

      if (Object.keys(updateData).length > 0) {
        await registration.update(updateData);
        logger.info(`管理員更新報名檔案成功，ID: ${registration.id}`);
      }

      const updatedRegistration = await EnglishTestRegistration.findByPk(registrationId);
      res.json({
        message: '檔案更新成功',
        registration: maskEnglishTestRegistrationForAdminApi(updatedRegistration),
      });
    } catch (error) {
      logger.error('管理員更新報名檔案錯誤', error);
      res.status(500).json({
        error: '伺服器錯誤，請稍後再試',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// API: 批量更新報名狀態（新增）
router.post('/english-test/registrations/bulk-update', ...englishRegReviewAuth, async (req, res) => {
  try {
    const { ids, status, rejectionReasons, rejectionOther } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '請提供要更新的報名 ID 列表' });
    }

    if (!status) {
      return res.status(400).json({ error: '請提供狀態' });
    }

    // 驗證拒絕原因（如果狀態為 revision 請修正 或 failed 報名失敗）
    if (status === 'revision' || status === 'failed') {
      const reasons = Array.isArray(rejectionReasons) ? rejectionReasons : [];
      if (reasons.length === 0) {
        return res.status(400).json({ 
          error: status === 'revision' 
            ? '切換至「請修正」狀態時，必須至少選擇一個拒絕原因'
            : '切換至「報名失敗」狀態時，必須至少選擇一個原因'
        });
      }
      if (reasons.includes('其他') && (!rejectionOther || rejectionOther.trim() === '')) {
        return res.status(400).json({ 
          error: '選擇「其他」原因時，必須填寫說明' 
        });
      }
    }

    // 記錄變更前的狀態，用於判斷是否需要重新排序
    const registrationsBeforeUpdate = await EnglishTestRegistration.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'status', 'semester']
    });
    const hadSuccessStatus = registrationsBeforeUpdate.some(reg => reg.status === 'success');
    const willBecomeSuccess = status === 'success';
    const willLeaveSuccess = hadSuccessStatus && status !== 'success';

    // 批量更新
    const updateData = {
      status,
      ...(status === 'revision' && {
        rejectionReasons: Array.isArray(rejectionReasons) ? rejectionReasons : [rejectionReasons],
        rejectionOther,
        approvedAt: null,
        successSequence: null
      }),
      ...(status === 'failed' && {
        rejectionReasons: Array.isArray(rejectionReasons) ? rejectionReasons : [rejectionReasons],
        rejectionOther,
        approvedAt: null,
        successSequence: null
      }),
      ...(status === 'approved' && {
        approvedAt: new Date()
        // 已通過狀態不分配序號
      }),
      ...(status === 'pending' && {
        approvedAt: null,
        successSequence: null,
        rejectionReasons: null,
        rejectionOther: null
      }),
      ...(status === 'success' && {
        successSequence: null // 先設為 null，稍後統一分配
      })
    };

    const [updatedCount] = await EnglishTestRegistration.update(updateData, {
      where: {
        id: { [Op.in]: ids }
      }
    });

    // 若變為報名成功，為尚未有序號的資料分配 successSequence
    if (willBecomeSuccess) {
      const registrationsNeedingSequence = await EnglishTestRegistration.findAll({
        where: {
          id: { [Op.in]: ids },
          status: 'success',
          successSequence: { [Op.is]: null }
        },
        order: [
          [Sequelize.literal('COALESCE("approvedAt", "createdAt")'), 'ASC'],
          ['id', 'ASC']
        ]
      });

      if (registrationsNeedingSequence.length > 0) {
        // 按學期分組處理
        const bySemester = {};
        registrationsNeedingSequence.forEach(reg => {
          const sem = reg.semester || 'unknown';
          if (!bySemester[sem]) {
            bySemester[sem] = [];
          }
          bySemester[sem].push(reg);
        });

        // 為每個學期的記錄分配序號
        for (const [sem, regs] of Object.entries(bySemester)) {
          // 取得該學期的最大序號
          const maxSequence = await EnglishTestRegistration.max('successSequence', {
            where: { 
              status: 'success',
              semester: sem
            }
          }) || 0;
          
          // 分配序號
          await Promise.all(regs.map((reg, index) => (
            reg.update({ successSequence: maxSequence + index + 1 })
          )));
          
          // 重新排序該學期的記錄（確保序號連續）
          await reorderSuccessSequences(sem);
        }
      } else {
        // 如果沒有需要分配序號的記錄，但狀態變更可能影響排序，重新排序受影響的學期
        const affectedSemesters = new Set();
        for (const reg of registrationsBeforeUpdate) {
          if (reg?.semester) {
            affectedSemesters.add(reg.semester);
          }
        }
        for (const sem of affectedSemesters) {
          await reorderSuccessSequences(sem);
        }
      }
    } else if (willLeaveSuccess) {
      // 如果從報名成功變為其他狀態，重新排序受影響的學期
      const affectedSemesters = new Set();
      for (const reg of registrationsBeforeUpdate) {
        if (reg?.status === 'success' && reg?.semester) {
          affectedSemesters.add(reg.semester);
        }
      }
      for (const sem of affectedSemesters) {
        await reorderSuccessSequences(sem);
      }
    }

    auditLogService.logAuditAsync({
      module: 'english_test',
      action: 'bulk_update_status',
      entityType: 'EnglishTestRegistration',
      entityId: 'bulk',
      targetSummary: `批量 ${ids.length} 筆 → ${status}，實際更新 ${updatedCount} 筆`,
      afterData: {
        idCount: ids.length,
        status,
        updatedCount,
        sampleIds: ids.slice(0, 50),
        beforeStatuses: registrationsBeforeUpdate.map((r) => ({ id: r.id, status: r.status })),
      },
      req,
    });

    res.json({
      success: true,
      updated: updatedCount,
      failed: ids.length - updatedCount,
      errors: []
    });
  } catch (error) {
    logger.error('批量更新錯誤', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// API: 更新報名狀態
router.put('/english-test/registrations/:id', ...englishRegReviewAuth, async (req, res) => {
  try {
    const { 
      status, 
      notes, 
      rejectionReasons, 
      rejectionOther,
      // 基本聯絡資訊
      email,
      studentNameZh,
      lastNameEn,
      firstNameEn,
      birthDate,
      // 身分與學籍資料
      phone,
      postalCode,
      city,
      district,
      address,
      degreeLevel,
      grade,
      college,
      department,
      // 英語能力與培力資格
      examType,
      hasTakenBESTEP,
      hasCEFRB2,
      passedExamTypes,
      passedExamOther,
      b2SkillType,
      listeningExamType,
      listeningScore,
      readingExamType,
      readingScore,
      speakingExamType,
      speakingScore,
      writingExamType,
      writingScore,
      // 特殊身分與協助需求
      isLowIncome,
      hasDisabilityCard,
      disabilityTypes,
      examAssistanceOptions,
      examAssistanceOther,
      // 照片與同意事項
      infoSource
    } = req.body;
    
    const registration = await EnglishTestRegistration.findByPk(req.params.id);
    
    if (!registration) {
      return res.status(404).json({ error: '找不到報名資料' });
    }

    // 如果狀態切換為 revision（請修正）或 failed（報名失敗），必須填寫原因
    if (status === 'revision' || status === 'failed') {
      const reasons = Array.isArray(rejectionReasons) ? rejectionReasons : (rejectionReasons ? [rejectionReasons] : []);
      if (reasons.length === 0 || (reasons.length === 1 && reasons[0] === '其他' && !rejectionOther)) {
        return res.status(400).json({ 
          error: status === 'revision' ? '切換至「請修正」狀態時，必須至少選擇一個拒絕原因' : '切換至「報名失敗」狀態時，必須至少選擇一個原因',
          code: 'REJECTION_REASONS_REQUIRED'
        });
      }
      if (reasons.includes('其他') && (!rejectionOther || rejectionOther.trim() === '')) {
        return res.status(400).json({ 
          error: '選擇「其他」原因時，必須填寫說明',
          code: 'REJECTION_OTHER_REQUIRED'
        });
      }
    }

    // 更新資料（支援所有可編輯欄位）
    const updateData = {};
    
    // 狀態相關欄位
    if (status !== undefined) {
      updateData.status = status;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    // 基本聯絡資訊
    if (email !== undefined) updateData.email = email;
    if (studentNameZh !== undefined) updateData.studentNameZh = studentNameZh;
    if (lastNameEn !== undefined) updateData.lastNameEn = lastNameEn;
    if (firstNameEn !== undefined) updateData.firstNameEn = firstNameEn;
    if (birthDate !== undefined) updateData.birthDate = birthDate || null;
    
    // 身分與學籍資料
    if (phone !== undefined) updateData.phone = phone;
    if (postalCode !== undefined) updateData.postalCode = postalCode;
    if (city !== undefined) updateData.city = city;
    if (district !== undefined) updateData.district = district;
    if (address !== undefined) updateData.address = address;
    if (degreeLevel !== undefined) updateData.degreeLevel = degreeLevel;
    if (grade !== undefined) updateData.grade = grade;
    if (college !== undefined) updateData.college = college;
    if (department !== undefined) updateData.department = department;
    
    // 英語能力與培力資格
    if (examType !== undefined) updateData.examType = examType || null;
    if (hasTakenBESTEP !== undefined) updateData.hasTakenBESTEP = hasTakenBESTEP || '否';
    if (hasCEFRB2 !== undefined) updateData.hasCEFRB2 = hasCEFRB2;
    if (passedExamTypes !== undefined) {
      // 處理陣列或字串格式
      if (Array.isArray(passedExamTypes)) {
        updateData.passedExamTypes = passedExamTypes.length > 0 ? passedExamTypes : null;
      } else if (typeof passedExamTypes === 'string') {
        try {
          const parsed = JSON.parse(passedExamTypes);
          updateData.passedExamTypes = Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
        } catch (e) {
          // 如果不是 JSON，當作逗號分隔的字串處理
          const arr = passedExamTypes.split(',').map(s => s.trim()).filter(s => s);
          updateData.passedExamTypes = arr.length > 0 ? arr : null;
        }
      } else {
        updateData.passedExamTypes = null;
      }
    }
    if (passedExamOther !== undefined) updateData.passedExamOther = passedExamOther || null;
    if (b2SkillType !== undefined) updateData.b2SkillType = b2SkillType || null;
    if (listeningExamType !== undefined) updateData.listeningExamType = listeningExamType || null;
    if (listeningScore !== undefined) updateData.listeningScore = listeningScore || null;
    if (readingExamType !== undefined) updateData.readingExamType = readingExamType || null;
    if (readingScore !== undefined) updateData.readingScore = readingScore || null;
    if (speakingExamType !== undefined) updateData.speakingExamType = speakingExamType || null;
    if (speakingScore !== undefined) updateData.speakingScore = speakingScore || null;
    if (writingExamType !== undefined) updateData.writingExamType = writingExamType || null;
    if (writingScore !== undefined) updateData.writingScore = writingScore || null;
    
    // 特殊身分與協助需求
    if (isLowIncome !== undefined) updateData.isLowIncome = isLowIncome;
    if (hasDisabilityCard !== undefined) updateData.hasDisabilityCard = hasDisabilityCard;
    if (disabilityTypes !== undefined) {
      // 處理陣列或字串格式
      if (Array.isArray(disabilityTypes)) {
        updateData.disabilityTypes = disabilityTypes.length > 0 ? disabilityTypes : null;
      } else if (typeof disabilityTypes === 'string') {
        try {
          const parsed = JSON.parse(disabilityTypes);
          updateData.disabilityTypes = Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
        } catch (e) {
          // 如果不是 JSON，當作逗號分隔的字串處理
          const arr = disabilityTypes.split(',').map(s => s.trim()).filter(s => s);
          updateData.disabilityTypes = arr.length > 0 ? arr : null;
        }
      } else {
        updateData.disabilityTypes = null;
      }
    }
    if (examAssistanceOptions !== undefined) {
      // 處理陣列或字串格式
      if (Array.isArray(examAssistanceOptions)) {
        updateData.examAssistanceOptions = examAssistanceOptions.length > 0 ? examAssistanceOptions : null;
      } else if (typeof examAssistanceOptions === 'string') {
        try {
          const parsed = JSON.parse(examAssistanceOptions);
          updateData.examAssistanceOptions = Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
        } catch (e) {
          // 如果不是 JSON，當作逗號分隔的字串處理
          const arr = examAssistanceOptions.split(',').map(s => s.trim()).filter(s => s);
          updateData.examAssistanceOptions = arr.length > 0 ? arr : null;
        }
      } else {
        updateData.examAssistanceOptions = null;
      }
    }
    if (examAssistanceOther !== undefined) updateData.examAssistanceOther = examAssistanceOther || null;
    
    // 照片與同意事項
    if (infoSource !== undefined) updateData.infoSource = infoSource;

    // 記錄變更前的狀態（只有在明確提供 status 時才處理狀態相關邏輯）
    const previousStatus = registration.status;
    const newStatus = status !== undefined ? status : registration.status;
    const willBecomeSuccess = newStatus === 'success' && previousStatus !== 'success';
    const willLeaveSuccess = previousStatus === 'success' && newStatus !== 'success';

    // 處理 approvedAt 欄位（用於排序報名成功的順序）- 只有在狀態變更時才處理
    if (status !== undefined) {
      if (status === 'approved') {
        // 如果狀態變為「已通過」或已經是「已通過」但 approvedAt 為 null（舊資料），記錄通過時間
        if (registration.status !== 'approved' || !registration.approvedAt) {
          updateData.approvedAt = new Date();
        }
        // 已通過狀態不分配序號
      } else if (status === 'success') {
        // 如果狀態變為「報名成功」，更新 approvedAt 為當前時間（表示變成success的時間）
        // 這樣可以確保排序是按照「設置為success的時間順序」，而不是按照原本的 approvedAt 或 createdAt
        if (previousStatus !== 'success') {
          // 只有當從其他狀態變為success時，才更新 approvedAt
          // 這樣可以確保排序是按照「設置為success的時間順序」
          updateData.approvedAt = new Date();
        } else if (!registration.approvedAt) {
          // 如果已經是success但沒有 approvedAt（舊資料），設置為當前時間
          updateData.approvedAt = new Date();
        }
        // 如果變為報名成功且尚未有序號，分配序號（按學期）
        if (previousStatus !== 'success' || !registration.successSequence) {
          const registrationSemester = registration.semester || null;
          const whereClause = { status: 'success' };
          if (registrationSemester) {
            whereClause.semester = registrationSemester;
          }
          
          const maxSequence = await EnglishTestRegistration.max('successSequence', {
            where: whereClause
          }) || 0;
          updateData.successSequence = maxSequence + 1;
        }
      } else if (status !== 'approved' && status !== 'success' && registration.status === 'approved') {
        // 如果從「已通過」變為其他狀態（非success），清除通過時間
        updateData.approvedAt = null;
      } else if (status !== 'success' && previousStatus === 'success') {
        // 如果從報名成功變為其他狀態，清除序號（但保留 approvedAt 用於歷史記錄）
        updateData.successSequence = null;
      }

      // 當狀態為 revision（請修正）或 failed（報名失敗）時更新原因
      if (status === 'revision' || status === 'failed') {
        const reasons = Array.isArray(rejectionReasons) ? rejectionReasons : (rejectionReasons ? [rejectionReasons] : []);
        updateData.rejectionReasons = reasons.length > 0 ? reasons : null;
        updateData.rejectionOther = rejectionOther || null;
      } else if (status !== 'revision' && status !== 'failed' && (rejectionReasons !== undefined || rejectionOther !== undefined)) {
        // 如果狀態不是 revision 或 failed，但提供了 rejectionReasons 或 rejectionOther，清除它們
        updateData.rejectionReasons = null;
        updateData.rejectionOther = null;
      }
    }

    // 檢查是否有任何欄位需要更新
    if (Object.keys(updateData).length === 0) {
      logger.warn(`沒有提供任何更新欄位，ID: ${registration.id}`);
      // 仍然返回成功，但記錄警告
    } else {
      await registration.update(updateData);
      logger.info(`報名資料更新成功，ID: ${registration.id}，更新欄位: ${Object.keys(updateData).join(', ')}`);

      // 稽核：英檢單筆狀態修改（含成功/失敗/請修正等切換）
      auditLogService.logAuditAsync({
        module: 'english_test',
        action: 'update_status_single',
        entityType: 'EnglishTestRegistration',
        entityId: registration.id,
        targetSummary: `registrationId=${registration.id}`,
        beforeData: {
          status: previousStatus,
        },
        afterData: {
          status: newStatus,
          notesProvided: updateData.notes !== undefined,
          rejectionReasonsProvided: updateData.rejectionReasons !== undefined,
          rejectionOtherProvided: updateData.rejectionOther !== undefined,
        },
        changedFields: Object.keys(updateData).slice(0, 25),
        req,
      });
    }

    // 如果變為報名成功或從報名成功變為其他狀態，重新排序該學期的報名成功記錄
    if (willBecomeSuccess || willLeaveSuccess) {
      const registrationSemester = registration.semester || null;
      await reorderSuccessSequences(registrationSemester);
    }

    // 重新載入完整記錄以取得所有欄位
    const updatedRegistration = await EnglishTestRegistration.findByPk(req.params.id);

    // 發送狀態更新通知郵件（非同步，不阻塞回應）
    try {
      // 準備郵件資料
      const emailData = {
        studentId: updatedRegistration.studentId,
        studentName: updatedRegistration.name,
        studentNameZh: updatedRegistration.studentNameZh || updatedRegistration.name,
        lastNameEn: updatedRegistration.lastNameEn || '',
        firstNameEn: updatedRegistration.firstNameEn || '',
        name: updatedRegistration.name,
        idNumber: updatedRegistration.idNumber || updatedRegistration.nationalId,
        nationalId: updatedRegistration.nationalId || updatedRegistration.idNumber,
        email: updatedRegistration.email,
        phone: updatedRegistration.phone || '',
        registrationId: updatedRegistration.id,
        registrationDate: updatedRegistration.createdAt,
        status: updatedRegistration.status,
        examType: updatedRegistration.examType,
        hasCEFRB2: updatedRegistration.hasCEFRB2 || '否',
        listeningExamType: updatedRegistration.listeningExamType,
        listeningScore: updatedRegistration.listeningScore,
        readingExamType: updatedRegistration.readingExamType,
        readingScore: updatedRegistration.readingScore,
        speakingExamType: updatedRegistration.speakingExamType,
        speakingScore: updatedRegistration.speakingScore,
        writingExamType: updatedRegistration.writingExamType,
        writingScore: updatedRegistration.writingScore,
        rejectionReasons: updatedRegistration.rejectionReasons,
        rejectionOther: updatedRegistration.rejectionOther
      };

      // 根據狀態發送不同的郵件（請修正／報名失敗時寄出，內含原因）
      if (status === 'revision') {
        await emailLogService.sendEmailWithLog(
          'englishTestRegistrationRejected',
          emailData,
          {
            requestId: req.requestId,
            relatedEntityType: 'english_test',
            relatedEntityId: updatedRegistration.id,
          }
        );
      }
      if (status === 'failed') {
        await emailLogService.sendEmailWithLog(
          'englishTestRegistrationFinalFailure',
          emailData,
          {
            requestId: req.requestId,
            relatedEntityType: 'english_test',
            relatedEntityId: updatedRegistration.id,
          }
        );
      }
      // pending / approved / success 不在此處發信（報名成功由按鈕觸發）
    } catch (emailError) {
      // 郵件發送失敗不影響狀態更新，僅記錄錯誤
      logger.error('發送狀態更新通知郵件失敗', emailError);
    }

    res.json({
      message: '更新成功',
      registration: maskEnglishTestRegistrationForAdminApi(updatedRegistration),
    });
  } catch (error) {
    logger.error('更新報名狀態錯誤', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// API: 一鍵發送報名成功/報名失敗/團體推廣信
router.post('/english-test/registrations/send-status-emails', ...englishRegReviewAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['success', 'failed', 'group_promo'].includes(status)) {
      return res.status(400).json({ error: '請提供 status：success、failed 或 group_promo' });
    }

    let list;
    let template;
    if (status === 'group_promo') {
      list = await EnglishTestRegistration.findAll({
        where: {
          status: 'success',
          examType: 'LRSW'
        }
      });
      template = 'englishTestRegistrationGroupPromo';
    } else {
      list = await EnglishTestRegistration.findAll({
        where: { status }
      });
      template = status === 'success' ? 'englishTestRegistrationFinalSuccess' : 'englishTestRegistrationFinalFailure';
    }

    if (list.length === 0) {
      const noMsg = status === 'success' ? '沒有報名成功狀態的報名者'
        : status === 'failed' ? '沒有報名失敗狀態的報名者'
          : '沒有符合條件者（報名成功且四項皆報考）';
      return res.json({
        message: noMsg,
        sent: 0,
        failed: 0
      });
    }

    const registrationShortLink = process.env.BESTEP_GROUP_REGISTRATION_LINK || 'http://emieears-siwan.nsysu.edu.tw/register/english-test/group';
    let sent = 0;
    let failed = 0;

    for (const reg of list) {
      try {
        const emailData = {
          studentId: reg.studentId,
          studentName: reg.name,
          studentNameZh: reg.studentNameZh || reg.name,
          lastNameEn: reg.lastNameEn || '',
          firstNameEn: reg.firstNameEn || '',
          name: reg.name,
          idNumber: reg.idNumber || reg.nationalId,
          nationalId: reg.nationalId || reg.idNumber,
          email: reg.email,
          phone: reg.phone || '',
          registrationId: reg.id,
          registrationDate: reg.createdAt,
          status: reg.status,
          examType: reg.examType,
          registrationShortLink,
          rejectionReasons: reg.rejectionReasons,
          rejectionOther: reg.rejectionOther
        };
        await emailLogService.sendEmailWithLog(template, emailData, {
          requestId: req.requestId,
          relatedEntityType: 'english_test',
          relatedEntityId: reg.id,
        });
        sent++;
      } catch (err) {
        logger.error(`發送郵件失敗 (ID: ${reg.id}, Email: ${reg.email})`, err);
        failed++;
      }
    }

    const msg = status === 'success' ? `已對 ${sent} 位報名成功者發信`
      : status === 'failed' ? `已對 ${sent} 位報名失敗者發信`
        : `已對 ${sent} 位符合條件者發送團體推廣信`;

    // 稽核：補寄/批次發送通知（成功/失敗/團推）
    auditLogService.logAuditAsync({
      module: 'english_test',
      action: 'send_status_emails',
      entityType: 'EnglishTestEmailBatch',
      entityId: `send-status-emails:${status}`,
      targetSummary: `status=${status}`,
      afterData: {
        template,
        sent,
        failed,
        total: list.length,
      },
      req,
    });

    res.json({
      message: msg,
      sent,
      failed,
      total: list.length
    });
  } catch (error) {
    logger.error('一鍵發信錯誤', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// API: 刪除報名
router.delete('/english-test/registrations/:id', ...englishRegReviewAuth, async (req, res) => {
  try {
    const registration = await EnglishTestRegistration.findByPk(req.params.id);
    
    if (!registration) {
      return res.status(404).json({ error: '找不到報名資料' });
    }

    // 刪除相關檔案
    const files = [
      { path: registration.b2CertificateFile, type: 'B2證書' },
      { path: registration.disabilityCertFront, type: '障礙證明正面' },
      { path: registration.disabilityCertBack, type: '障礙證明反面' },
      { path: registration.idPhoto, type: '證件照' }
    ].filter(f => f.path); // 過濾掉空值

    const baseUploadPath = path.join(__dirname, '../uploads');
    let deletedCount = 0;
    let errorCount = 0;

    files.forEach(({ path: filePath, type }) => {
      try {
        // 處理相對路徑和絕對路徑
        // 路徑格式可能是：uploads/english-test/id-photos/檔名 或絕對路徑
        let fullPath;
        if (path.isAbsolute(filePath)) {
          fullPath = filePath;
        } else {
          // 相對路徑從 uploads 開始（路徑格式：uploads/english-test/id-photos/檔名）
          // 如果路徑已經包含 uploads，直接使用；否則加上 uploads 前綴
          if (filePath.startsWith('uploads/')) {
            fullPath = path.join(__dirname, '../', filePath);
          } else {
            fullPath = path.join(baseUploadPath, filePath);
          }
        }
        
        // 標準化路徑（處理 Windows 和 Unix 路徑差異）
        fullPath = path.normalize(fullPath);
        
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          deletedCount++;
          logger.debug(`已刪除檔案 (${type}): ${fullPath}`);
        } else {
          logger.warn(`檔案不存在，跳過刪除 (${type}): ${fullPath}`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`刪除檔案失敗 (${type}): ${filePath}`, error);
        // 不中斷刪除流程，繼續刪除其他檔案
      }
    });

    if (errorCount > 0) {
      logger.warn(`刪除檔案時發生 ${errorCount} 個錯誤，但繼續刪除報名記錄`);
    }
    
    logger.info(`已刪除 ${deletedCount} 個檔案`);

    await registration.destroy();
    res.json({ message: '刪除成功' });
  } catch (error) {
    logger.error('刪除報名錯誤', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// API: 匯出報名資料為 Excel
router.get('/english-test/registrations/export/excel', ...englishRegExportAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const where = status && status !== 'all' ? { status } : {};

    // 排序邏輯
    let orderBy = [['createdAt', 'DESC']];
    if (status === 'approved') {
      // 已通過狀態：按 approvedAt ASC（無則 createdAt ASC），再按 id ASC
      orderBy = [
        [Sequelize.literal('COALESCE("approvedAt", "createdAt")'), 'ASC'],
        ['id', 'ASC']
      ];
    } else if (status === 'success') {
      // 報名成功狀態：按 successSequence ASC（null 視為最大值），再按 approvedAt ASC
      orderBy = [
        [Sequelize.literal('COALESCE("successSequence", 2147483647)'), 'ASC'],
        [Sequelize.literal('COALESCE("approvedAt", "createdAt")'), 'ASC']
      ];
    }

    const registrations = await EnglishTestRegistration.findAll({
      where,
      order: orderBy
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('培力英檢報名資料');

    // 定義 40 個表頭（依序，保留換行字元 \n）
    const headers = [
      '序號',
      '*報考項目\n說寫輸入S,W\n聽讀輸入LR\n四項全考輸入LR,S,W',
      '*身分國籍',
      '*身分證字號',
      '*中文姓名',
      '*英文拼音姓',
      '*英文拼音名',
      '*母語',
      '其他母語',
      '*國籍',
      '其他國籍',
      '*出生年月日（2001/5/12）',
      '*電子信箱',
      '*行動電話',
      '郵遞區號',
      '*縣市',
      '*行政區',
      '*地址',
      '*學號',
      '*學制',
      '*部所',
      '*學院',
      '*科系',
      '*年級',
      '*考生已確實詳閱並同意遵守本測驗報名方式所提注意事項，應試須知及個資使用同意書所載各項規定',
      '*中/低收入',
      '*障礙協助',
      '障礙類別',
      '補充說明障礙類別',
      '入場時間',
      '試場',
      '試題冊\n※放大2倍字體限重度視障生申請',
      '作答方式',
      '免試項目\n※聽力測驗免試限輕、中、重度聽障考生申請\n※口說能力測驗免試限限輕、中及重度聽/語障考生申請',
      '作答時間\n※延長作答時間為原時間之1.5倍限閱讀及書寫功能障礙考生申請\n※延長作答時間為原時間之2倍限重度視障考生申請',
      '考場準備',
      '考場準備其他',
      '輔具',
      '輔具其他',
      '群組代碼'
    ];

    // 設定欄位寬度（根據表頭長度自動調整）
    const columnWidths = headers.map((header, index) => {
      // 計算表頭長度（考慮換行）
      const lines = header.split('\n');
      const maxLineLength = Math.max(...lines.map(line => line.length));
      return Math.max(15, Math.min(50, maxLineLength + 2)); // 最小 15，最大 50
    });

    // 建立表頭行（第 1 列）
    worksheet.addRow(headers);

    // 設定表頭樣式（支援換行）
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // 設定欄位寬度
    headers.forEach((header, index) => {
      worksheet.getColumn(index + 1).width = columnWidths[index];
      // 設定儲存格支援換行
      const cell = worksheet.getCell(1, index + 1);
      cell.alignment = { 
        vertical: 'top', 
        horizontal: 'left',
        wrapText: true 
      };
    });

    // 設定行高（適應換行）
    headerRow.height = 60;

    // 填入資料
    registrations.forEach((reg, index) => {
      // 處理報考項目格式轉換
      let examTypeFormatted = '';
      if (reg.examType) {
        switch (reg.examType) {
          case 'LRSW':
            examTypeFormatted = 'LR,S,W';
            break;
          case 'LR':
            examTypeFormatted = 'LR';
            break;
          case 'SW':
            examTypeFormatted = 'S,W';
            break;
          case 'NON':
            examTypeFormatted = '';
            break;
          default:
            examTypeFormatted = reg.examType;
        }
      }

      // 處理出生年月日格式 (YYYY-MM-DD -> YYYY/M/D 或 YYYY/M/DD)
      let birthDateFormatted = '';
      if (reg.birthDate) {
        const date = new Date(reg.birthDate);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        birthDateFormatted = `${year}/${month}/${day}`;
      }

      // 處理障礙類別（JSON陣列轉為字串）
      let disabilityTypesFormatted = '';
      if (reg.disabilityTypes) {
        try {
          const disabilityArray = Array.isArray(reg.disabilityTypes) 
            ? reg.disabilityTypes 
            : JSON.parse(reg.disabilityTypes);
          disabilityTypesFormatted = disabilityArray.join('、');
        } catch (e) {
          // 如果不是JSON格式，直接使用字串
          disabilityTypesFormatted = String(reg.disabilityTypes);
        }
      }

      // 序號處理邏輯：
      // - 報名成功狀態：使用 successSequence（報名成功順序編號）
      // - 已通過狀態：使用報名編號（id）
      // - 其他狀態：使用報名編號（id）
      let sequenceNumber;
      if (status === 'success') {
        sequenceNumber = reg.successSequence || index + 1;
      } else {
        sequenceNumber = reg.id;
      }

      // 根據表頭順序填入對應資料
      const rowData = [
        sequenceNumber, // 序號（已通過時為連號，否則為報名編號）
        examTypeFormatted, // 報考項目
        '中華民國國民', // 身分國籍（預設）
        reg.idNumber || reg.nationalId || '', // 身分證字號
        reg.name || reg.studentNameZh || '', // 中文姓名
        reg.lastNameEn || '', // 英文拼音姓
        reg.firstNameEn || '', // 英文拼音名
        '中文', // 母語（預設）
        '', // 其他母語
        '中華民國', // 國籍（預設）
        '', // 其他國籍
        birthDateFormatted, // 出生年月日
        reg.email || '', // 電子信箱
        reg.phone || '', // 行動電話
        reg.postalCode || '', // 郵遞區號
        reg.city || '', // 縣市
        reg.district || '', // 行政區
        reg.address || '', // 地址
        reg.studentId || '', // 學號
        reg.degreeLevel || '', // 學制
        '日間部', // 部所（預設）
        reg.college || '', // 學院
        reg.department || '', // 科系
        reg.grade || '', // 年級
        '是', // 考生已確實詳閱...（預設）
        reg.isLowIncome || '否', // 中/低收入
        reg.hasDisabilityCard || '否', // 障礙協助
        disabilityTypesFormatted, // 障礙類別
        reg.examAssistanceOther || '', // 補充說明障礙類別
        '', // 入場時間
        '', // 試場
        '', // 試題冊
        '', // 作答方式
        '', // 免試項目
        '', // 作答時間
        '', // 考場準備
        '', // 考場準備其他
        '', // 輔具
        '', // 輔具其他
        ''  // 群組代碼
      ];

      worksheet.addRow(rowData);
    });

    // 設定回應標頭（使用 encodeURIComponent 處理中文檔名）
    let fileName = '培力英檢報名資料';
    if (status === 'pending') {
      fileName = '培力英檢報名資料_審核中';
    } else if (status === 'approved') {
      fileName = '培力英檢報名資料_已通過';
    } else if (status === 'revision') {
      fileName = '培力英檢報名資料_請修正';
    } else if (status === 'success') {
      fileName = '培力英檢報名資料_報名成功';
    } else if (status === 'failed') {
      fileName = '培力英檢報名資料_報名失敗';
    }
    fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;
    const encodedFileName = encodeURIComponent(fileName);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);

    await workbook.xlsx.write(res);

    logEnglishTestExportAudit(req, {
      action: 'english_test_export_excel',
      exportType: 'excel',
      rowCount: registrations.length,
      filters: { status: status || 'all' },
    });

    res.end();
  } catch (error) {
    logger.error('匯出 Excel 錯誤', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// API: 匯出已通過或報名成功學生的證件照（ZIP格式）
router.get('/english-test/registrations/export/photos', ...englishRegExportAuth, async (req, res) => {
  try {
    // 檢查 archiver 是否已安裝
    if (!archiver) {
      return res.status(500).json({ error: 'archiver 套件未安裝，無法匯出證件照。請執行: npm install archiver' });
    }

    // 從查詢參數取得狀態（預設為 'approved'，支援 'success'）
    const { status = 'approved' } = req.query;
    
    // 驗證狀態參數
    if (!['approved', 'success'].includes(status)) {
      return res.status(400).json({ error: '狀態參數必須為 approved 或 success' });
    }

    // 取得指定狀態的報名記錄
    let orderBy;
    if (status === 'success') {
      // 報名成功狀態：按 successSequence ASC（null 視為最大值），再按 approvedAt ASC
      orderBy = [
        [Sequelize.literal('COALESCE("successSequence", 2147483647)'), 'ASC'],
        [Sequelize.literal('COALESCE("approvedAt", "createdAt")'), 'ASC']
      ];
    } else {
      // 已通過狀態：按 approvedAt ASC，再按 id ASC
      orderBy = [
        [Sequelize.literal('COALESCE("approvedAt", "createdAt")'), 'ASC'],
        ['id', 'ASC']
      ];
    }
    
    const registrations = await EnglishTestRegistration.findAll({
      where: { status },
      order: orderBy
    });

    // 過濾出有證件照的記錄
    const registrationsWithPhotos = registrations.filter(reg => reg.idPhoto);

    if (registrationsWithPhotos.length === 0) {
      const statusText = status === 'approved' ? '已通過' : '報名成功';
      return res.status(404).json({ error: `沒有找到${statusText}且具有證件照的報名記錄` });
    }

    // 建立 ZIP 檔案
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高壓縮等級
    });

    // 設定回應標頭
    const statusText = status === 'approved' ? '已通過' : '報名成功';
    const fileName = `培力英檢${statusText}證件照_${new Date().toISOString().split('T')[0]}.zip`;
    const encodedFileName = encodeURIComponent(fileName);
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);

    // 將 ZIP 資料流導向回應
    archive.pipe(res);

    // 處理每個記錄
    const baseUploadPath = path.join(__dirname, '../uploads');
    
    for (let index = 0; index < registrationsWithPhotos.length; index++) {
      const reg = registrationsWithPhotos[index];
      
      // 序號處理：
      // - 報名成功狀態：使用 successSequence（報名成功順序編號）
      // - 已通過狀態：使用報名編號（id）
      let sequenceNumber;
      if (status === 'success') {
        sequenceNumber = reg.successSequence || index + 1;
      } else {
        // 已通過狀態使用報名編號
        sequenceNumber = reg.id;
      }
      
      // 清理檔名中的特殊字符
      const cleanIdNumber = String(reg.idNumber || reg.nationalId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanName = String(reg.name || reg.studentNameZh || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
      
      // 原始證件照檔案路徑
      const originalPhotoPath = path.join(baseUploadPath, reg.idPhoto);
      
      // 檢查原始檔案是否存在
      if (!fs.existsSync(originalPhotoPath)) {
        logger.warn(`證件照檔案不存在: ${originalPhotoPath}`);
        continue;
      }

      // 取得原始檔案的副檔名
      const originalExt = path.extname(reg.idPhoto);
      
      // 新的檔名格式：(序號-身分證字號-中文姓名).副檔名
      const newFileName = `${sequenceNumber}-${cleanIdNumber}-${cleanName}${originalExt}`;

      // 將檔案加入 ZIP（使用新的檔名）
      archive.file(originalPhotoPath, { name: newFileName });
    }

    // 完成 ZIP 檔案建立
    await archive.finalize();

    logEnglishTestExportAudit(req, {
      action: 'english_test_export_photos',
      exportType: 'photos_zip',
      rowCount: registrationsWithPhotos.length,
      filters: { status },
    });

  } catch (error) {
    logger.error('匯出證件照錯誤', error);
    if (!res.headersSent) {
      res.status(500).json({ error: '伺服器錯誤' });
    }
  }
});

// API: 手動調整報名成功順序（上移、下移、指定位置）
router.post('/english-test/registrations/:id/adjust-sequence', ...englishRegReviewAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, targetSequence } = req.body; // action: 'up', 'down', 'move'; targetSequence: 目標序號（用於 move）

    const registration = await EnglishTestRegistration.findByPk(id);
    if (!registration) {
      return res.status(404).json({ error: '找不到報名資料' });
    }

    if (registration.status !== 'success') {
      return res.status(400).json({ error: '只能調整「報名成功」狀態的順序' });
    }

    const currentSequence = registration.successSequence;
    if (!currentSequence) {
      return res.status(400).json({ error: '該記錄尚未有序號，請先重新排序' });
    }

    // 取得該學期所有報名成功的記錄（已排序）
    const registrationSemester = registration.semester || null;
    const whereClause = { status: 'success' };
    if (registrationSemester) {
      whereClause.semester = registrationSemester;
    }
    
    const allSuccessRegistrations = await EnglishTestRegistration.findAll({
      where: whereClause,
      order: [
        [Sequelize.literal('COALESCE("successSequence", 2147483647)'), 'ASC'],
        [Sequelize.literal('COALESCE("approvedAt", "createdAt")'), 'ASC']
      ]
    });

    const currentIndex = allSuccessRegistrations.findIndex(reg => reg.id === parseInt(id));
    if (currentIndex === -1) {
      return res.status(400).json({ error: '找不到該記錄在排序列表中的位置' });
    }

    let newSequence;
    let targetIndex;

    if (action === 'up') {
      // 上移：與前一個交換
      if (currentIndex === 0) {
        return res.status(400).json({ error: '已經是第一個，無法上移' });
      }
      targetIndex = currentIndex - 1;
      const targetReg = allSuccessRegistrations[targetIndex];
      newSequence = targetReg.successSequence;
      // 交換序號
      await registration.update({ successSequence: newSequence });
      await targetReg.update({ successSequence: currentSequence });
    } else if (action === 'down') {
      // 下移：與後一個交換
      if (currentIndex === allSuccessRegistrations.length - 1) {
        return res.status(400).json({ error: '已經是最後一個，無法下移' });
      }
      targetIndex = currentIndex + 1;
      const targetReg = allSuccessRegistrations[targetIndex];
      newSequence = targetReg.successSequence;
      // 交換序號
      await registration.update({ successSequence: newSequence });
      await targetReg.update({ successSequence: currentSequence });
    } else if (action === 'move' && targetSequence !== undefined) {
      // 移動到指定位置
      const targetSeq = parseInt(targetSequence);
      if (isNaN(targetSeq) || targetSeq < 1 || targetSeq > allSuccessRegistrations.length) {
        return res.status(400).json({ error: `目標序號必須在 1-${allSuccessRegistrations.length} 之間` });
      }

      // 找到目標序號對應的記錄
      const targetReg = allSuccessRegistrations.find(reg => reg.successSequence === targetSeq);
      if (!targetReg) {
        return res.status(400).json({ error: '找不到目標序號對應的記錄' });
      }

      if (targetReg.id === parseInt(id)) {
        return res.status(400).json({ error: '目標位置與當前位置相同' });
      }

      // 交換序號
      newSequence = targetSeq;
      await registration.update({ successSequence: newSequence });
      await targetReg.update({ successSequence: currentSequence });
    } else {
      return res.status(400).json({ error: '無效的操作類型，請使用 up、down 或 move' });
    }

    // 重新排序所有記錄以確保序號連續（1, 2, 3...）
    await reorderSuccessSequences(registrationSemester);

    const updatedRegistration = await EnglishTestRegistration.findByPk(id);
    res.json({
      message: '順序調整成功',
      registration: maskEnglishTestRegistrationForAdminApi(updatedRegistration),
      newSequence: updatedRegistration.successSequence
    });
  } catch (error) {
    logger.error('調整順序錯誤', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// API: 重新排序所有報名成功記錄
router.post('/english-test/registrations/reorder-success', ...englishRegReviewAuth, async (req, res) => {
  try {
    const count = await reorderSuccessSequences();
    res.json({
      message: `已重新排序 ${count} 筆報名成功記錄`,
      count
    });
  } catch (error) {
    logger.error('重新排序錯誤', error);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// Multer 錯誤處理中間件（必須在所有路由之後）
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    logger.error('Multer 錯誤', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '檔案大小超過限制 (5MB)' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: '檔案數量超過限制' });
    }
    return res.status(400).json({ error: `檔案上傳錯誤: ${error.message}` });
  }
  
  if (error.message && error.message.includes('只允許上傳')) {
    return res.status(400).json({ error: error.message });
  }
  
  next(error);
});

module.exports = router;
