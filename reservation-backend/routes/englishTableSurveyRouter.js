// routes/englishTableSurveyRouter.js
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { EnglishTableSurveyResponse, EnglishClubSurveyResponse, Reservation, Event } = require('../models');
const { authMiddleware, adminMiddleware, requirePermission, requireAnyPermission, P } = require('../middlewares/auth');
const { logLegacySurveyExportAudit } = require('../utils/legacySurveyExportAudit');

const legacySurveyExportAuth = [
  authMiddleware,
  requireAnyPermission(
    [P.CAN_EXPORT_SURVEY_RESPONSES, P.CAN_EXPORT_SURVEYS],
    '需要問卷填答匯出權限'
  ),
];
const { getCurrentSemester, isValidSemester } = require('../utils/semester');

function resolveLegacyStatsSemester(req) {
  return req.query.semester && isValidSemester(req.query.semester) ? req.query.semester : getCurrentSemester();
}

// TODO: deprecated - will be removed
router.use((req, res, next) => {
  res.setHeader('X-EEARS-Deprecated', 'true');
  next();
});

function isAdminSurveyLegacyBase(req) {
  return String(req.baseUrl || '').startsWith('/api/admin/survey');
}

// P0: 避免 legacy survey router 在 admin 前綴下出現未授權存取。
router.use((req, res, next) => {
  if (!isAdminSurveyLegacyBase(req)) return next();
  return authMiddleware(req, res, () =>
    requirePermission(P.CAN_VIEW_SURVEYS)(req, res, next)
  );
});

// 檢查學生是否已填問卷（通用路由，支援 English Table 和 English Club）
router.get('/check/:surveyId/:studentId', async (req, res, next) => {
  try {
    const { surveyId, studentId } = req.params;
    
    if (!studentId || studentId === 'undefined' || studentId === 'null' || String(studentId).trim() === '') {
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

// 向後相容：檢查學生是否已填English Table問卷（舊路由）
router.get('/check/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const semester = getCurrentSemester();
    const exist = await EnglishTableSurveyResponse.findOne({ where: { studentId, semester } });
    return res.json({ filled: !!exist, semester });
  } catch (err) { 
    next(err); 
  }
});

// 接收English Table問卷提交
router.post('/english-table', async (req, res, next) => {
  try {
    const {
      studentId, name, email, grade, department,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
      q11, q12, q13, q14, q15, q16, q17, q18,
      interviewEmail, times_this_semester
    } = req.body;

    // 驗證必要欄位（在最前面檢查，避免後面查詢時發生錯誤）
    if (!studentId || studentId === 'undefined' || studentId === 'null') {
      return res.status(400).json({ error: '缺少必要欄位：studentId' });
    }

    const semester = getCurrentSemester();
    try {
      const existing = await EnglishTableSurveyResponse.findOne({ where: { studentId, semester } });
      if (existing) {
        return res.status(400).json({ error: '您已填過English Table問卷' });
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      return res.status(500).json({ error: '資料庫查詢錯誤' });
    }

    // 驗證基本資料必填欄位（只驗證學生基本資訊，grade 和 department 選填）
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '請填寫姓名' });
    }
    
    if (!email || email.trim() === '') {
      return res.status(400).json({ error: '請填寫Email' });
    }

    // 驗證李克特量表分數 (1-5) - 只驗證 q1-q18 (新版本)
    const likertQuestions = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10',
                           'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18'];
    
    for (const question of likertQuestions) {
      const score = req.body[question];
      if (score === undefined || score === null || score === '') {
        return res.status(400).json({ error: `請回答${question}問題` });
      }
      if (score < 1 || score > 5) {
        return res.status(400).json({ error: `${question}分數必須在1-5之間` });
      }
    }

    // 驗證email格式（如果提供）
    if (interviewEmail && interviewEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(interviewEmail)) {
        return res.status(400).json({ error: '聯絡信箱格式不正確' });
      }
    }

    // 自動計算參加次數（114-1學年度English Table活動的簽到次數）
    const attendanceCount = await Reservation.count({
      include: [{
        model: Event,
        where: {
          eventType: 'English Table',
          date: {
            [require('sequelize').Op.between]: ['2025-08-01', '2026-01-31'] // 114-1學年度
          }
        }
      }],
      where: {
        studentId: studentId,
        checkinStatus: '已簽到'
      }
    });

    // 建立問卷回應 - 保持數據庫兼容性，舊問題設為 null
    try {
      await EnglishTableSurveyResponse.create({
        studentId,
        semester,
        name,
        email,
        grade: grade || null,
        department: department || null,
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
        q11, q12, q13, q14, q15, q16, q17, q18,
        interviewEmail: interviewEmail || null
      });

      res.json({ message: 'English Table問卷已送出，謝謝您的回饋！' });
    } catch (createError) {
      console.error('Error creating survey response:', createError);
      return res.status(500).json({ error: '問卷送出失敗，請稍後再試' });
    }
  } catch (err) { 
    next(err); 
  }
});

// 接收English Club問卷提交
router.post('/english-club', async (req, res, next) => {
  try {
    const {
      studentId, name, email, department, year,
      reason_attend, information_channel, ability_improved,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
      ability_description, other_comments
    } = req.body;

    // 驗證必要欄位
    if (!studentId || studentId === 'undefined' || studentId === 'null' || String(studentId).trim() === '') {
      return res.status(400).json({ error: '缺少必要欄位：studentId' });
    }

    const semester = getCurrentSemester();
    try {
      const existing = await EnglishClubSurveyResponse.findOne({
        where: { studentId: String(studentId).trim(), semester },
      });
      if (existing) {
        return res.status(400).json({ error: '您已填過English Club問卷' });
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      return res.status(500).json({ error: '資料庫查詢錯誤' });
    }

    // 驗證基本資料必填欄位
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: '請填寫姓名' });
    }
    
    if (!email || email.trim() === '') {
      return res.status(400).json({ error: '請填寫Email' });
    }

    if (!department || department.trim() === '') {
      return res.status(400).json({ error: '請填寫系所' });
    }

    if (!year || year.trim() === '') {
      return res.status(400).json({ error: '請選擇年級' });
    }

    // 驗證複選題（必須是陣列且至少選一項）
    if (!reason_attend || !Array.isArray(reason_attend) || reason_attend.length === 0) {
      return res.status(400).json({ error: '請選擇參加原因' });
    }

    if (!information_channel || !Array.isArray(information_channel) || information_channel.length === 0) {
      return res.status(400).json({ error: '請選擇資訊來源' });
    }

    if (!ability_improved || !Array.isArray(ability_improved) || ability_improved.length === 0) {
      return res.status(400).json({ error: '請選擇能力提升項目' });
    }

    // 驗證李克特量表分數 (1-5) - q1 到 q10
    const likertQuestions = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'];
    
    for (const question of likertQuestions) {
      const score = req.body[question];
      if (score === undefined || score === null || score === '') {
        return res.status(400).json({ error: `請回答${question}問題` });
      }
      const numScore = parseInt(score);
      if (isNaN(numScore) || numScore < 1 || numScore > 5) {
        return res.status(400).json({ error: `${question}分數必須在1-5之間` });
      }
    }

    // 驗證email格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Email格式不正確' });
    }

    // 建立問卷回應
    try {
      await EnglishClubSurveyResponse.create({
        studentId: String(studentId).trim(),
        semester,
        name: name.trim(),
        email: email.trim(),
        department: department.trim(),
        year: year.trim(),
        reasonAttend: reason_attend,
        informationChannel: information_channel,
        abilityImproved: ability_improved,
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
        abilityDescription: ability_description || null,
        otherComments: other_comments || null
      });

      res.json({ message: 'English Club問卷已送出，謝謝您的回饋！' });
    } catch (createError) {
      console.error('Error creating survey response:', createError);
      return res.status(500).json({ error: '問卷送出失敗，請稍後再試' });
    }
  } catch (err) { 
    next(err); 
  }
});

// 匯出 English Table 問卷資料至 Excel（需問卷匯出權限；完整個資僅在匯出檔內，audit 不含原文）
router.get('/export', ...legacySurveyExportAuth, async (req, res, next) => {
  try {
    const semester = resolveLegacyStatsSemester(req);
    const surveys = await EnglishTableSurveyResponse.findAll({
      where: { semester },
      order: [['createdAt', 'DESC']],
    });
    
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('English Table Survey Responses');

    // 定義欄位 - 更新為新版本 18 題
    ws.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: '學期', key: 'semester', width: 10 },
      { header: '學號', key: 'studentId', width: 15 },
      { header: '姓名', key: 'name', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: '年級', key: 'grade', width: 15 },
      { header: '科系', key: 'department', width: 20 },
      { header: 'Q1-流利談論個人經驗', key: 'q1', width: 8 },
      { header: 'Q2-給出詳細有趣回答', key: 'q2', width: 8 },
      { header: 'Q3-精準描述圖表訊息', key: 'q3', width: 8 },
      { header: 'Q4-整理表達個人想法', key: 'q4', width: 8 },
      { header: 'Q5-使用生活例子強化觀點', key: 'q5', width: 8 },
      { header: 'Q6-連結課程與現實例子', key: 'q6', width: 8 },
      { header: 'Q7-說英文更有自信', key: 'q7', width: 8 },
      { header: 'Q8-不緊張害怕犯錯', key: 'q8', width: 8 },
      { header: 'Q9-更願意用英文交談', key: 'q9', width: 8 },
      { header: 'Q10-個人理由參加ET', key: 'q10', width: 8 },
      { header: 'Q11-不同主題更有興趣', key: 'q11', width: 8 },
      { header: 'Q12-計劃繼續參加ET', key: 'q12', width: 8 },
      { header: 'Q13-總結主要想法', key: 'q13', width: 8 },
      { header: 'Q14-主動尋求協助', key: 'q14', width: 8 },
      { header: 'Q15-遵守輪流發言規範', key: 'q15', width: 8 },
      { header: 'Q16-同儕主導模式幫助開口', key: 'q16', width: 8 },
      { header: 'Q17-ET氣氛佳互動性強', key: 'q17', width: 8 },
      { header: 'Q18-整體提升口說技能', key: 'q18', width: 8 },
      { header: '聯絡信箱', key: 'interviewEmail', width: 25 },
      { header: '填寫時間', key: 'createdAt', width: 20 }
    ];

    // 填入資料
    surveys.forEach(survey => {
      ws.addRow(survey.toJSON());
    });

    // 回傳檔案
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="english-table-survey-responses.xlsx"');
    await wb.xlsx.write(res);

    logLegacySurveyExportAudit(req, {
      action: 'legacy_english_table_survey_export',
      surveyType: 'english_table',
      rowCount: surveys.length,
      filters: { semester },
    });

    res.end();
  } catch (err) {
    next(err);
  }
});

// 刪除所有 English Table 問卷紀錄（測試用）
router.delete('/english-table/all', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const deletedCount = await EnglishTableSurveyResponse.destroy({
      where: {},
      truncate: true // 清空整個表格
    });
    
    res.json({ 
      message: `已刪除所有問卷紀錄`,
      deletedCount: deletedCount
    });
  } catch (err) {
    next(err);
  }
});

// 刪除特定學生的問卷紀錄
router.delete('/english-table/:studentId', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    
    const deletedCount = await EnglishTableSurveyResponse.destroy({
      where: { studentId }
    });
    
    if (deletedCount === 0) {
      return res.status(404).json({ error: '找不到該學生的問卷紀錄' });
    }
    
    res.json({ 
      message: `已刪除學號 ${studentId} 的問卷紀錄`,
      deletedCount: deletedCount
    });
  } catch (err) {
    next(err);
  }
});

// 取得English Table問卷統計（管理員專用）
router.get('/stats', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const semester = resolveLegacyStatsSemester(req);
    const surveys = await EnglishTableSurveyResponse.findAll({ where: { semester } });
    const total = surveys.length;

    if (total === 0) {
      return res.json({
        semester,
        totalResponses: 0,
        message: '尚無問卷回應'
      });
    }

    // 計算各題平均分數 - 只處理 q1-q18 (新版本)
    const questionAverages = {};
    for (let i = 1; i <= 18; i++) {
      const questionKey = `q${i}`;
      const scores = surveys.map(s => s[questionKey]).filter(s => s !== null);
      if (scores.length > 0) {
        questionAverages[questionKey] = (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2);
      }
    }

    // 年級分布
    const gradeDistribution = {};
    surveys.forEach(survey => {
      gradeDistribution[survey.grade] = (gradeDistribution[survey.grade] || 0) + 1;
    });

    const timesVals = surveys.map((s) => s.timesAttended).filter((x) => x != null && !Number.isNaN(Number(x)));
    const attendanceStats =
      timesVals.length > 0
        ? {
            min: Math.min(...timesVals),
            max: Math.max(...timesVals),
            average: (timesVals.reduce((sum, s) => sum + Number(s), 0) / timesVals.length).toFixed(2),
          }
        : { min: null, max: null, average: null };

    res.json({
      semester,
      totalResponses: total,
      questionAverages,
      gradeDistribution,
      attendanceStats,
      latestResponse: surveys[0]?.createdAt,
      earliestResponse: surveys[surveys.length - 1]?.createdAt
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
