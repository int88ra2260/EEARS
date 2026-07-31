// server.js
process.env.TZ = process.env.TZ || 'Asia/Taipei';
require('dotenv').config();
const { handleUnhandledRejection, handleUncaughtException } = require('./middlewares/errorHandler');
handleUnhandledRejection();
handleUncaughtException();

const express = require('express');
const path = require('path');
const cors = require('cors');
const { sequelize } = require('./models');

const loginRouter = require('./routes/loginRouter');
const eventRouter = require('./routes/eventRouter');
const reservationRouter = require('./routes/reservationRouter');
const blacklistRouter = require('./routes/blacklistRouter');
const settingsRouter = require('./routes/settingsRouter');
const englishTableSurveyRouter = require('./routes/englishTableSurveyRouter');
const surveyRouter = require('./routes/surveyRouter');
const surveyProductAdminRouter = require('./routes/surveyProductAdminRouter');
const surveySettingsRouter = require('./routes/surveySettingsRouter');
const adminSurveyCenterRouter = require('./routes/adminSurveyCenterRouter');
const adminSurveyRulesRouter = require('./routes/adminSurveyRulesRouter');
const adminSurveyResponsesRouter = require('./routes/adminSurveyResponsesRouter');
const adminSurveyAnalyticsRouter = require('./routes/adminSurveyAnalyticsRouter');
const adminSurveyHealthRouter = require('./routes/adminSurveyHealthRouter');
const adminSurveyRepairsRouter = require('./routes/adminSurveyRepairsRouter');
const adminSurveyAnswerMappingRouter = require('./routes/adminSurveyAnswerMappingRouter');
const surveyGatewayRouter = require('./routes/surveyGatewayRouter');
const adminClassesRouter = require('./routes/adminClasses');
const teacherRoutes = require('./routes/teacherRoutes');
const featureFlagsRouter = require('./routes/featureFlagsRouter');
const adminRouter = require('./routes/adminRouter');
const englishTestRegistrationRouter = require('./routes/englishTestRegistrationRouter');
const learningPartnerRouter = require('./routes/learningPartnerRouter');
const bestepRouter = require('./routes/bestepRouter');
const statsRouter = require('./routes/statsRouter');
const analyticsRouter = require('./routes/analyticsRouter');
const reportsRouter = require('./routes/reportsRouter');
const announcementRouter = require('./routes/announcementRouter');
const adminAnnouncementRouter = require('./routes/adminAnnouncementRouter');
const healthRouter = require('./routes/healthRouter');
const notificationsRouter = require('./routes/notificationsRouter');
const internalDiagnosticsRouter = require('./routes/internalDiagnosticsRouter');
const learningJourneyRouter = require('./routes/learningJourneyRouter');
const learningJourneyV3Router = require('./routes/learningJourneyV3Router');

const { errorHandler } = require('./middlewares/errorHandler');
const { requestLogger } = require('./middlewares/requestLogger');
const { expireLearningPartnerTeams } = require('./scripts/learningPartnerExpireCron');
const adminLogsRouter = require('./routes/adminLogsRouter');
const studentsRouter = require('./routes/studentsRouter');
const weeklyReportsRouter = require('./routes/weeklyReportsRouter');
const { isLearningJourneyV3ReadModelEnabled } = require('./services/learningJourney/learningJourneyFeatureFlags');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use('/api', healthRouter);
app.use('/api', notificationsRouter);
app.use('/api/internal', internalDiagnosticsRouter);

app.use('/api', loginRouter);
app.use('/api', eventRouter);
app.use('/api', reservationRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/blacklist', blacklistRouter);
app.use('/api/survey', englishTableSurveyRouter);
app.use('/api/admin/survey', englishTableSurveyRouter);
app.use('/api/surveys', surveyRouter);
app.use('/api/surveys', surveyGatewayRouter);
app.use('/api/admin/surveys', surveyProductAdminRouter);
app.use('/api/admin/surveys', surveyRouter);
app.use('/api/admin/survey-center', adminSurveyCenterRouter);
app.use('/api/admin/survey-rules', adminSurveyRulesRouter);
app.use('/api/admin/survey-responses', adminSurveyResponsesRouter);
app.use('/api/admin/surveys/analytics', adminSurveyAnalyticsRouter);
app.use('/api/admin/surveys/health', adminSurveyHealthRouter);
app.use('/api/admin/surveys/repairs', adminSurveyRepairsRouter);
app.use('/api/admin/surveys/answer-mappings', adminSurveyAnswerMappingRouter);
app.use('/api/admin/survey-settings', surveySettingsRouter);
app.use('/api/admin/classes', adminClassesRouter);
app.use('/api', teacherRoutes);
app.use('/api', featureFlagsRouter);
app.use('/api', adminRouter);
app.use('/api', englishTestRegistrationRouter);
app.use('/api', learningPartnerRouter);
app.use('/api/admin/bestep', bestepRouter);
// LEGACY - DO NOT USE:
// Learning Journey V3 no longer exposes legacy English-test tracking APIs.
// Keep route modules on disk for Phase 2 removal, but do not mount them.
app.use('/api/admin/learning-journey', learningJourneyRouter);
app.use('/api/v3/learning-journey', learningJourneyRouter);
app.use('/api/admin/learning-journey-v3', learningJourneyV3Router);
app.use('/api/stats', statsRouter);
app.use('/api', analyticsRouter);
app.use('/api', reportsRouter);
app.use('/api/announcements', announcementRouter);
app.use('/api/admin/announcements', adminAnnouncementRouter);
app.use('/api/admin/logs', adminLogsRouter);
app.use('/api', studentsRouter);
app.use('/api/weekly-reports', weeklyReportsRouter);

// 提供上傳檔案的靜態服務
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// 提供前端靜態檔案（假設 React build 資料夾與 server.js 同層）
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));

// React Router fallback（支援 SPA 模式）
app.get('*', (req, res) => {
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
    });
  })
  .catch(err => {
    logger.error('資料庫連線失敗', err);
  });
