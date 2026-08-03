// routes/surveyRouter.js
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { EnglishTableSurveyResponse, EnglishClubSurveyResponse, SurveySettings } = require('../models');
const { authMiddleware, requirePermission, requireAnyPermission, requireSurveyAccess, P } = require('../middlewares/auth');
const { logLegacySurveyExportAudit } = require('../utils/legacySurveyExportAudit');
const { legacyDeprecationHeaders } = require('../middlewares/legacyDeprecation');
const surveyModuleService = require('../services/surveyModuleService');
const { getCurrentSemester, isValidSemester } = require('../utils/semester');

function resolveLegacyStatsSemester(req) {
  return req.query.semester && isValidSemester(req.query.semester) ? req.query.semester : getCurrentSemester();
}

const markDeprecatedSurveyRoute = legacyDeprecationHeaders({
  sunset: '2026-06-30',
  replacementApi: '/api/surveys/public/:surveyKey',
  scope: 'legacy_survey_compat'
});

const markGoneSurveyConfigRoute = legacyDeprecationHeaders({
  sunset: '2026-04-27',
  replacementApi: '/api/surveys/public/:surveyKey',
  scope: 'legacy_survey_config',
  gone: true,
  goneMessage: 'Legacy surveys.json config API 已封存，請改用 Survey Center / public survey package API。'
});

// 載入問卷配置（後台 /config、舊相容）
const surveysConfig = require('../surveys.json');

function isAdminSurveysBase(req) {
  return String(req.baseUrl || '').startsWith('/api/admin/surveys');
}

// P0: 同一份 router 會同時掛在 /api/surveys 與 /api/admin/surveys。
// 針對 admin 前綴加一道最小防線，避免公開路由在 admin 前綴下被未授權存取。
router.use((req, res, next) => {
  if (!isAdminSurveysBase(req)) return next();
  return authMiddleware(req, res, () =>
    requirePermission(P.CAN_VIEW_SURVEYS)(req, res, next)
  );
});

/** 統一公開提交錯誤回應 */
function handlePublicSubmitError(e, res, next) {
  if (e.statusCode === 400 && e.errorCode) {
    return res.status(400).json({
      success: false,
      errorCode: e.errorCode,
      message: e.message,
      error: e.message,
    });
  }
  if (e.statusCode === 400) return res.status(400).json({ error: e.message || e.error });
  if (e.statusCode === 404) return res.status(404).json({ error: e.message });
  if (e.statusCode === 403) return res.status(403).json({ code: e.code, message: e.message });
  return next(e);
}

// --- 正式公開路徑（與 POST /:surveyId 並存，語意一致）---
router.get('/public/:surveyKey/status', async (req, res, next) => {
  try {
    const st = await surveyModuleService.getPublicStatusPayload(req.params.surveyKey);
    res.json(st);
  } catch (err) {
    next(err);
  }
});

router.get('/public/:surveyKey', async (req, res, next) => {
  try {
    const st = await surveyModuleService.getPublicStatusPayload(req.params.surveyKey);
    if (!st.ok) {
      return res.status(st.code === 'not_found' ? 404 : 403).json(st);
    }
    const pkg = await surveyModuleService.getPublishedSurveyPackage(req.params.surveyKey);
    if (!pkg) return res.status(404).json({ error: '找不到問卷' });
    res.json({
      survey: pkg.config,
      meta: {
        source: pkg.source,
        versionNumber: pkg.versionNumber,
        surveyKey: pkg.surveyKey,
        currentSemester: st.currentSemester,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/public/:surveyKey/responses', async (req, res, next) => {
  try {
    const r = await surveyModuleService.submitPublicResponse(req.params.surveyKey, req.body, req);
    res.json(r);
  } catch (e) {
    handlePublicSubmitError(e, res, next);
  }
});

// 公開 API：取得啟用中的活動問卷列表（依 survey_rules，供首頁與問卷選擇頁）
router.get('/enabled', async (req, res, next) => {
  try {
    const { listEnabledActivitySurveys } = require('../services/surveyEnabledListService');
    const list = await listEnabledActivitySurveys();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// 取得問卷配置 API（legacy 相容；新流程改由 Survey Center / published package 管理）
router.get('/config', markGoneSurveyConfigRoute, async (req, res, next) => {
  try {
    res.json(surveysConfig);
  } catch (err) {
    next(err);
  }
});

// 通用問卷提交 API（legacy 相容；與 /public/:surveyKey/responses 共用業務邏輯）
router.post('/:surveyId', markDeprecatedSurveyRoute, async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    if (surveyId === 'enabled' || surveyId === 'config' || surveyId.startsWith('public')) {
      return res.status(404).json({ error: '無效路徑' });
    }
    const r = await surveyModuleService.submitPublicResponse(surveyId, req.body, req);
    res.json(r);
  } catch (e) {
    handlePublicSubmitError(e, res, next);
  }
});

// 檢查問卷填寫狀態（legacy 相容；正式後台查詢以 Survey Center 為主）
router.get('/check/:surveyId/:studentId', markDeprecatedSurveyRoute, async (req, res, next) => {
  try {
    const { surveyId, studentId } = req.params;

    // 參數驗證：確保 studentId 存在且不為空
    if (!studentId || studentId === undefined || studentId === null || String(studentId).trim() === '') {
      return res.status(400).json({ 
        success: false,
        errorCode: 'MISSING_STUDENT_ID',
        message: '缺少必要參數：studentId',
        error: '請提供學號'
      });
    }

    let SurveyModel;
    if (surveyId === 'english_table_feedback_114_1') {
      SurveyModel = EnglishTableSurveyResponse;
    } else if (surveyId === 'english_club_feedback_114_1') {
      SurveyModel = EnglishClubSurveyResponse;
    } else {
      return res.status(400).json({ 
        success: false,
        errorCode: 'UNSUPPORTED_SURVEY_TYPE',
        message: '不支援的問卷類型',
        error: '不支援的問卷類型'
      });
    }

    const trimmedStudentId = String(studentId).trim();
    const semester = getCurrentSemester();
    const exist = await SurveyModel.findOne({ where: { studentId: trimmedStudentId, semester } });
    return res.json({ filled: !!exist, semester });
  } catch (err) {
    next(err);
  }
});

// 取得問卷統計（管理員、執行長和English Table負責人可用）
router.get(
  '/stats/:surveyId',
  markDeprecatedSurveyRoute,
  authMiddleware,
  requirePermission(P.CAN_VIEW_SURVEYS),
  requireSurveyAccess('surveyId'),
  async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const semester = resolveLegacyStatsSemester(req);

    let SurveyModel;
    if (surveyId === 'english_table_feedback_114_1') {
      SurveyModel = EnglishTableSurveyResponse;
    } else if (surveyId === 'english_club_feedback_114_1') {
      SurveyModel = EnglishClubSurveyResponse;
    } else {
      return res.status(400).json({ error: '不支援的問卷類型' });
    }

    const surveys = await SurveyModel.findAll({ where: { semester } });
    const total = surveys.length;

    if (total === 0) {
      return res.json({
        totalResponses: 0,
        message: '尚無問卷回應'
      });
    }

    // 計算各題平均分數
    const questionAverages = {};
    for (let i = 1; i <= 20; i++) {
      const questionKey = `q${i}`;
      const scores = surveys.map(s => s[questionKey]).filter(s => s !== null && s !== undefined);
      if (scores.length > 0) {
        questionAverages[questionKey] = (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2);
      }
    }

    // 年級分布
    const gradeDistribution = {};
    surveys.forEach(survey => {
      const grade = survey.grade || survey.year;
      if (grade) {
        gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
      }
    });

    res.json({
      semester,
      totalResponses: total,
      questionAverages,
      gradeDistribution,
      latestResponse: surveys[0]?.createdAt,
      earliestResponse: surveys[surveys.length - 1]?.createdAt
    });
  } catch (err) {
    next(err);
  }
});

// 匯出問卷資料至 Excel（需問卷匯出權限；完整個資僅在匯出檔內，audit 不含原文）
router.get(
  '/export/:surveyId',
  markDeprecatedSurveyRoute,
  authMiddleware,
  requireAnyPermission(
    [P.CAN_EXPORT_SURVEY_RESPONSES, P.CAN_EXPORT_SURVEYS],
    '需要問卷填答匯出權限'
  ),
  requireSurveyAccess('surveyId'),
  async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const semester = resolveLegacyStatsSemester(req);

    let SurveyModel;
    let fileName;
    let worksheetName;

    if (surveyId === 'english_table_feedback_114_1') {
      SurveyModel = EnglishTableSurveyResponse;
      fileName = 'english-table-survey-responses.xlsx';
      worksheetName = 'English Table Survey Responses';
    } else if (surveyId === 'english_club_feedback_114_1') {
      SurveyModel = EnglishClubSurveyResponse;
      fileName = 'english-club-survey-responses.xlsx';
      worksheetName = 'English Club Survey Responses';
    } else {
      return res.status(400).json({ error: '不支援的問卷類型' });
    }

    const surveys = await SurveyModel.findAll({
      where: { semester },
      order: [['createdAt', 'DESC']],
    });
    
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(worksheetName);

    // 根據問卷類型定義不同的欄位
    if (surveyId === 'english_table_feedback_114_1') {
      ws.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: '學期', key: 'semester', width: 10 },
        { header: '學號', key: 'studentId', width: 15 },
        { header: '姓名', key: 'name', width: 15 },
        { header: 'Email', key: 'email', width: 25 },
        { header: '年級', key: 'grade', width: 15 },
        { header: '科系', key: 'department', width: 20 },
        { header: 'Q1', key: 'q1', width: 8 },
        { header: 'Q2', key: 'q2', width: 8 },
        { header: 'Q3', key: 'q3', width: 8 },
        { header: 'Q4', key: 'q4', width: 8 },
        { header: 'Q5', key: 'q5', width: 8 },
        { header: 'Q6', key: 'q6', width: 8 },
        { header: 'Q7', key: 'q7', width: 8 },
        { header: 'Q8', key: 'q8', width: 8 },
        { header: 'Q9', key: 'q9', width: 8 },
        { header: 'Q10', key: 'q10', width: 8 },
        { header: 'Q11', key: 'q11', width: 8 },
        { header: 'Q12', key: 'q12', width: 8 },
        { header: 'Q13', key: 'q13', width: 8 },
        { header: 'Q14', key: 'q14', width: 8 },
        { header: 'Q15', key: 'q15', width: 8 },
        { header: 'Q16', key: 'q16', width: 8 },
        { header: 'Q17', key: 'q17', width: 8 },
        { header: 'Q18', key: 'q18', width: 8 },
        { header: '聯絡信箱', key: 'interviewEmail', width: 25 },
        { header: '填寫時間', key: 'createdAt', width: 20 }
      ];
    } else if (surveyId === 'english_club_feedback_114_1') {
      ws.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: '學期', key: 'semester', width: 10 },
        { header: '學號', key: 'studentId', width: 15 },
        { header: '姓名', key: 'name', width: 15 },
        { header: 'Email', key: 'email', width: 25 },
        { header: '系所', key: 'department', width: 20 },
        { header: '年級', key: 'year', width: 15 },
        { header: '參加原因', key: 'reasonAttend', width: 30 },
        { header: '資訊來源', key: 'informationChannel', width: 30 },
        { header: '能力提升', key: 'abilityImproved', width: 30 },
        { header: 'Q1', key: 'q1', width: 8 },
        { header: 'Q2', key: 'q2', width: 8 },
        { header: 'Q3', key: 'q3', width: 8 },
        { header: 'Q4', key: 'q4', width: 8 },
        { header: 'Q5', key: 'q5', width: 8 },
        { header: 'Q6', key: 'q6', width: 8 },
        { header: 'Q7', key: 'q7', width: 8 },
        { header: 'Q8', key: 'q8', width: 8 },
        { header: 'Q9', key: 'q9', width: 8 },
        { header: 'Q10', key: 'q10', width: 8 },
        { header: '能力描述', key: 'abilityDescription', width: 40 },
        { header: '其他意見', key: 'otherComments', width: 40 },
        { header: '填寫時間', key: 'createdAt', width: 20 }
      ];
    }

    // 填入資料
    surveys.forEach(survey => {
      const rowData = survey.toJSON();
      // 處理 JSON 欄位
      if (rowData.reasonAttend && Array.isArray(rowData.reasonAttend)) {
        rowData.reasonAttend = rowData.reasonAttend.join(', ');
      }
      if (rowData.informationChannel && Array.isArray(rowData.informationChannel)) {
        rowData.informationChannel = rowData.informationChannel.join(', ');
      }
      if (rowData.abilityImproved && Array.isArray(rowData.abilityImproved)) {
        rowData.abilityImproved = rowData.abilityImproved.join(', ');
      }
      ws.addRow(rowData);
    });

    // 回傳檔案
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await wb.xlsx.write(res);

    const surveyType = surveyId === 'english_club_feedback_114_1' ? 'english_club' : 'english_table';
    const auditAction = surveyType === 'english_club'
      ? 'legacy_english_club_survey_export'
      : 'legacy_english_table_survey_export';
    logLegacySurveyExportAudit(req, {
      action: auditAction,
      surveyType,
      rowCount: surveys.length,
      filters: { semester },
      surveyId,
    });

    res.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
