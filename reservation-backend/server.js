// server.js
process.env.TZ = process.env.TZ || 'Asia/Taipei';
require('dotenv').config();
const { validateSecurityEnv } = require('./config/envValidation');
validateSecurityEnv();

const { handleUnhandledRejection, handleUncaughtException } = require('./middlewares/errorHandler');
handleUnhandledRejection();
handleUncaughtException();

const express = require('express');
const path = require('path');
const { sequelize } = require('./models');
const { createCorsMiddleware } = require('./config/corsConfig');
const {
  applyTrustProxy,
  createSecurityHeadersMiddleware,
  createGlobalRateLimitMiddleware,
  getRequestBodyLimit,
} = require('./config/httpSecurity');

const loginRouter = require('./routes/loginRouter');
const eventRouter = require('./routes/eventRouter');
const reservationRouter = require('./routes/reservationRouter');
const blacklistRouter = require('./routes/blacklistRouter');
const settingsRouter = require('./routes/settingsRouter');
const englishTableSurveyRouter = require('./routes/englishTableSurveyRouter');
const surveyRouter = require('./routes/surveyRouter');
const surveyProductAdminRouter = require('./routes/surveyProductAdminRouter');
const adminSurveyCenterRouter = require('./routes/adminSurveyCenterRouter');
const adminSurveyRulesRouter = require('./routes/adminSurveyRulesRouter');
const adminSurveyResponsesRouter = require('./routes/adminSurveyResponsesRouter');
const adminSurveyGateGapsRouter = require('./routes/adminSurveyGateGapsRouter');
const adminSurveyAnalyticsRouter = require('./routes/adminSurveyAnalyticsRouter');
const adminSurveyHealthRouter = require('./routes/adminSurveyHealthRouter');
const adminSurveyRepairsRouter = require('./routes/adminSurveyRepairsRouter');
const adminSurveyAnswerMappingRouter = require('./routes/adminSurveyAnswerMappingRouter');
const surveyGatewayRouter = require('./routes/surveyGatewayRouter');
const adminClassesRouter = require('./routes/adminClasses');
const teacherRoutes = require('./routes/teacherRoutes');
const adminRouter = require('./routes/adminRouter');
const englishTestRegistrationRouter = require('./routes/englishTestRegistrationRouter');
const englishLearningPassportRouter = require('./routes/englishLearningPassportRouter');
const adminEnglishLearningPassportRouter = require('./routes/adminEnglishLearningPassportRouter');
const bestepRouter = require('./routes/bestepRouter');
const statsRouter = require('./routes/statsRouter');
const analyticsRouter = require('./routes/analyticsRouter');
const reportsRouter = require('./routes/reportsRouter');
const announcementRouter = require('./routes/announcementRouter');
const adminAnnouncementRouter = require('./routes/adminAnnouncementRouter');
const weeklyReportRouter = require('./routes/weeklyReportRouter');
const adminWeeklyReportRouter = require('./routes/adminWeeklyReportRouter');
const adminWeeklyMediaRouter = require('./routes/adminWeeklyMediaRouter');
const siteContentRouter = require('./routes/siteContentRouter');
const adminSiteContentRouter = require('./routes/adminSiteContentRouter');
const pageContentRouter = require('./routes/pageContentRouter');
const adminPageContentRouter = require('./routes/adminPageContentRouter');
const adminMediaRouter = require('./routes/adminMediaRouter');
const healthRouter = require('./routes/healthRouter');
const notificationsRouter = require('./routes/notificationsRouter');
const internalDiagnosticsRouter = require('./routes/internalDiagnosticsRouter');
const learningJourneyRouter = require('./routes/learningJourneyRouter');
const learningJourneyV3Router = require('./routes/learningJourneyV3Router');
const learningAnalyticsRouter = require('./routes/learningAnalyticsRouter');
const learningPartnerRouter = require('./routes/learningPartnerRouter');
const etGroupingRouter = require('./routes/etGroupingRouter');
const learningTraceRouter = require('./routes/learningTraceRouter');

const { errorHandler } = require('./middlewares/errorHandler');
const { requestLogger } = require('./middlewares/requestLogger');
const { authMiddleware, requirePermission, P } = require('./middlewares/auth');
const { expireLearningPartnerTeams } = require('./scripts/learningPartnerExpireCron');
const { startEventAutoCheckScheduler } = require('./scripts/eventAutoCheckScheduler');
const adminLogsRouter = require('./routes/adminLogsRouter');
const adminEmailTemplatesRouter = require('./routes/adminEmailTemplatesRouter');
const studentsRouter = require('./routes/studentsRouter');
const importRunHistoryRouter = require('./routes/importRunHistoryRouter');
const { isLearningJourneyV3ReadModelEnabled } = require('./services/learningJourney/learningJourneyFeatureFlags');

const app = express();
const port = process.env.PORT || 3000;
const bodyLimit = getRequestBodyLimit();

applyTrustProxy(app);

// Middleware
app.use(createCorsMiddleware());
app.use(createSecurityHeadersMiddleware());
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
app.use(requestLogger);
app.use('/api', createGlobalRateLimitMiddleware());

app.use('/api', healthRouter);
app.use('/api', notificationsRouter);
app.use('/api/internal', internalDiagnosticsRouter);

app.use('/api', loginRouter);
app.use('/api', eventRouter);
app.use('/api', reservationRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/blacklist', blacklistRouter);
app.use('/api/survey', englishTableSurveyRouter);
app.use('/api/surveys', surveyRouter);
app.use('/api/surveys', surveyGatewayRouter);
app.use('/api/admin/surveys', surveyProductAdminRouter);
app.use('/api/admin/surveys', authMiddleware, requirePermission(P.CAN_VIEW_SURVEYS), surveyRouter);
app.use('/api/admin/survey-center', adminSurveyCenterRouter);
app.use('/api/admin/survey-rules', adminSurveyRulesRouter);
app.use('/api/admin/survey-responses', adminSurveyResponsesRouter);
app.use('/api/admin/survey-gate', adminSurveyGateGapsRouter);
app.use('/api/admin/surveys/analytics', adminSurveyAnalyticsRouter);
app.use('/api/admin/surveys/health', adminSurveyHealthRouter);
app.use('/api/admin/surveys/repairs', adminSurveyRepairsRouter);
app.use('/api/admin/surveys/answer-mappings', adminSurveyAnswerMappingRouter);
app.use('/api/admin/classes', adminClassesRouter);
app.use('/api', teacherRoutes);
app.use('/api', adminRouter);
app.use('/api', englishTestRegistrationRouter);
app.use('/api', englishLearningPassportRouter);
// 週報路由需要在 adminEnglishLearningPassportRouter 之前，因為後者有全局 authMiddleware
app.use('/api/admin/weekly-reports', adminWeeklyReportRouter);
app.use('/api/admin/weekly-media', adminWeeklyMediaRouter);
app.use('/api/admin', adminEnglishLearningPassportRouter);
app.use('/api', learningPartnerRouter);
app.use('/api/admin/bestep', bestepRouter);
// LEGACY - DO NOT USE:
// Learning Journey V3 no longer exposes legacy English-test tracking APIs.
// Keep route modules on disk for Phase 2 removal, but do not mount them.
app.use('/api/admin/learning-journey', learningJourneyRouter);
app.use('/api/v3/learning-journey', learningJourneyRouter);
app.use('/api/admin/learning-journey-v3', learningJourneyV3Router);
app.use('/api/admin/learning-analytics', learningAnalyticsRouter);
app.use('/api', learningTraceRouter);
app.use('/api/admin/et-grouping', etGroupingRouter);
app.use('/api/stats', statsRouter);
app.use('/api', analyticsRouter);
app.use('/api', reportsRouter);
app.use('/api/announcements', announcementRouter);
app.use('/api/admin/announcements', adminAnnouncementRouter);
app.use('/api/weekly', weeklyReportRouter);
app.use('/api/site-content', siteContentRouter);
app.use('/api/admin/site-content', adminSiteContentRouter);
app.use('/api', pageContentRouter);
app.use('/api/admin', adminPageContentRouter);
app.use('/api/admin', adminMediaRouter);
app.use('/api/admin/logs', adminLogsRouter);
app.use('/api/admin/email-templates', adminEmailTemplatesRouter);
app.use('/api/admin/import-runs', importRunHistoryRouter);
app.use('/api', studentsRouter);

// 提供上傳檔案的靜態服務
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// 提供前端靜態檔案（假設 React build 資料夾與 server.js 同層）
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));

// React Router fallback（支援 SPA 模式）；未匹配的 API 回 JSON，避免回傳 HTML 造成前端 JSON.parse 失敗
app.get('*', (req, res) => {
  const apiPath = String(req.path || req.url || '').split('?')[0];
  if (apiPath.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'API_NOT_FOUND',
      message: `No handler for ${req.method} ${apiPath}`,
      requestId: req.requestId || null,
    });
  }
  res.sendFile(path.join(buildPath, 'index.html'));
});

// 全域錯誤處理
app.use(errorHandler);

// 資料庫連線 & 啟動伺服器
const logger = require('./utils/logger');

async function checkLearningJourneyCanonicalTables() {
  try {
    const enabled = isLearningJourneyV3ReadModelEnabled();
    const required = [
      'exam_attempts',
      'exam_registrations',
      'activity_participations',
      'student_semester_profiles'
    ];
    const qi = sequelize.getQueryInterface();
    const rawTables = await qi.showAllTables();
    const tableSet = new Set(
      (rawTables || []).map((t) => {
        if (typeof t === 'string') return t.toLowerCase();
        if (t && typeof t === 'object') {
          if (t.tableName) return String(t.tableName).toLowerCase();
          const vals = Object.values(t);
          if (vals.length) return String(vals[0]).toLowerCase();
        }
        return String(t || '').toLowerCase();
      })
    );
    const missing = required.filter((x) => !tableSet.has(String(x).toLowerCase()));
    if (!enabled) return;
    if (missing.length === 0) {
      logger.info('[startup-check] Learning Journey canonical tables ready');
      return;
    }
    const msg = `[startup-check] Learning Journey v3 enabled but canonical tables missing: ${missing.join(', ')}. APIs should fallback to legacy when v3 read fails.`;
    if (process.env.NODE_ENV === 'production') logger.error(msg);
    else logger.warn(msg);
  } catch (e) {
    const msg = `[startup-check] canonical table check failed: ${(e && e.message) || String(e)}.`;
    if (process.env.NODE_ENV === 'production') logger.error(msg);
    else logger.warn(msg);
  }
}

sequelize.authenticate()
  .then(async () => {
    logger.simple.success('資料庫連線成功');
    await checkLearningJourneyCanonicalTables();

    if (process.env.ENABLE_DB_SYNC === 'true') {
      await sequelize.sync({ alter: false, force: false });
      logger.simple.success('All models synced.');
    }

    try {
      const { SurveyRule } = require('./models');
      const { syncAllLegacySettingsToSurveyRules } = require('./services/surveySettingsSyncService');
      const ruleCount = await SurveyRule.count();
      if (ruleCount === 0) {
        const synced = await syncAllLegacySettingsToSurveyRules({ source: 'startup_bootstrap' });
        logger.simple.info(`問卷規則啟動同步：已將 legacy 設定匯入 survey_rules（${synced.length} 筆）`);
      }
    } catch (bootstrapErr) {
      logger.error('問卷規則啟動同步失敗（不影響伺服器啟動）', bootstrapErr);
    }

    app.listen(port, '0.0.0.0',() => {
      logger.simple.success(`後端伺服器運行中，port：${port}`);
      logger.simple.success('系統已準備就緒！');
      
      // 啟動學習有伴過期檢查定時任務（每 15 分鐘執行一次）
      const cronInterval = 15 * 60 * 1000; // 15 分鐘
      setInterval(async () => {
        try {
          await expireLearningPartnerTeams();
        } catch (error) {
          logger.error('定時任務執行錯誤', error);
        }
      }, cronInterval);
      
      logger.simple.info('⏰ 學習有伴過期檢查定時任務已啟動（每 15 分鐘執行一次）');
      
      // 啟動時立即執行一次
      expireLearningPartnerTeams().catch(error => {
        logger.error('初始過期檢查錯誤', error);
      });

      // 每日 23:59:59 自動執行活動結束檢查
      startEventAutoCheckScheduler(logger);
    });
  })
  .catch(err => {
    logger.error('資料庫連線失敗', err);
  });
