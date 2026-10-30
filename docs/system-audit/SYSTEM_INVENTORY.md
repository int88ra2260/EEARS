# EEARS 系統盤點（SYSTEM_INVENTORY）

- 稽核日期：2026-10-29
- 模式：唯讀。未改應用程式、未安裝依賴、未跑 migration、未連正式資料庫、未執行測試套件。
- 證據來源：直接讀取 `server.js`、`App.js`、`package.json`、模型與權限檔，並以檔案計數複核；其餘分域觀察來自同一次唯讀盤點。
- 本文件描述「倉庫裡實際有什麼」。行為是否正確見 `CONSISTENCY_AUDIT.md` 與 `TECHNICAL_DEBT_REGISTER.md`。

## 覆蓋清單

| 區域 | 狀態 |
|------|------|
| 後端進入點、中介層順序、`server.js` 路由掛載 | 已檢 |
| 路由／控制器／服務／模型／中介層檔案計數與最大路由行數 | 已計數 |
| 權限鍵、staff／student JWT 入口、學生預約綁定 | 已抽樣讀碼 |
| 前端 `App.js` 路由、管理端三份登錄（路由／導覽／存取） | 已檢 |
| 學生身分、學期、問卷雙寫、LJ／BESTEP／ET 讀寫分層 | 已抽樣讀模型與服務 |
| 每個路由的每個 HTTP 方法與權限 | **未逐一檢** |
| 每支 migration 與實際 MySQL schema 差異 | **未檢**（未連 DB） |
| 每個頁面的視覺、響應式、無障礙實測 | **未檢**（未開瀏覽器） |
| `public/` 媒體、`.mysql-data/`、維運腳本逐支行為 | **未檢** |
| 測試是否通過 | **未執行** |

因此本稽核**不是**「整個系統每一行都已審完」。未檢項目列在各文件末節。

## 倉庫頂層

| 路徑 | 角色 |
|------|------|
| `reservation-backend/` | Express 4 + Sequelize 6 + MySQL API，也提供 SPA `build/` |
| `reservation-frontend/` | Vite + React 18 SPA |
| `scripts/ops/` | Windows 部署／PM2（`deploy.bat`、`restart-backend.bat`、`setup-pm2.bat`） |
| `docs/` | 產品與維運文件（本稽核目錄為新增） |
| `.cursor/rules/`、`.cursor/skills/`、`AGENTS.md` | 開發護欄；與程式可能不同步，不能當成現行 API 契約 |

部署形態（文件與 `server.js` 一致）：Node 聽 port 3000，IIS 反代；時區 `Asia/Taipei`（`server.js` 啟動時設定，PM2 `ecosystem.config.cjs` 亦設定）。

## 後端計數（2026-10-29 目錄計數）

| 目錄 | 數量 |
|------|------|
| `routes/*.js` | 66 |
| `controllers/*.js` | 23 |
| `services/**/*.js` | 268 |
| `models/*.js` | 142 |
| `middlewares/*.js` | 16 |
| `migrations/` 檔案 | 168 |
| `scripts/` 檔案 | 134 |
| `tests/**/*.test.js` | 201 |

`server.js` 實際 `app.use` 掛載約 50 個前綴。磁碟上有、**未**在 `server.js` require 的路由檔（已核對 `server.js` 無對應字串）：

- `routes/englishTestTrackingRouter.js`
- `routes/featureFlagsRouter.js`
- `routes/surveySettingsRouter.js`
- `routes/englishTestsRouter.js`

最大路由檔（總行數）：

| 檔案 | 行數 |
|------|------|
| `routes/englishTestRegistrationRouter.js` | 3624 |
| `routes/eventRouter.js` | 1728 |
| `routes/learningPartnerRouter.js` | 1215 |
| `routes/reservationRouter.js` | 1034 |
| `routes/etGroupingRouter.js` | 906 |

## 後端進入點與中介層順序

`reservation-backend/server.js`：

1. `validateSecurityEnv()`
2. `applyTrustProxy`
3. CORS（`config/corsConfig.js`）
4. Security headers（`config/httpSecurity.js`，helmet）
5. JSON／urlencoded body limit
6. `requestLogger`
7. `/api` 全域 rate limit
8. 各路由（**沒有**全域 `authMiddleware`）
9. `/uploads` 靜態檔
10. `build/` 靜態檔與 SPA fallback
11. `errorHandler`（最後）

DB 連線成功後才 `listen`。同進程啟動：

- 學習有伴過期：`setInterval` 15 分鐘（`expireLearningPartnerTeams`）
- `scripts/eventAutoCheckScheduler.js`（每日活動結束檢查）
- `scripts/ewlDailySyncScheduler.js`（寫作工坊同步）
- `scripts/backupDailyScheduler.js`（每日備份）
- 可選 MFA／Whisper worker（`scripts/speakingMfaWorkerHost.js`、`speakingWhisperWorkerHost.js`）

未使用 `node-cron`。排程綁在 API 進程（PM2 `ecosystem.config.cjs` 為單 instance）。

## 後端依賴（`reservation-backend/package.json`）

執行期：express ^4.21.2、sequelize ^6.37.6、mysql2 ^3.13.0、jsonwebtoken ^9.0.2、helmet ^8.2.0、express-rate-limit ^8.5.2、bcrypt ^5.1.1、bcryptjs ^2.4.3、exceljs ^4.4.0、xlsx ^0.18.5、zod ^4.0.17、nodemailer、multer、pdf-parse、qrcode、uuid、archiver、cors、dotenv。

開發：jest ^30.3.0、supertest ^7.2.2、eslint ^8.57.1。

已核對：程式 `require('bcrypt')` 與 `require('zod')` **零次**；密碼使用 `bcryptjs`。`xlsx` 與 `exceljs` **兩者都有實際 require**（匯入多走 `xlsx`，匯出多走 `exceljs`）。

## 前端進入點與依賴

- 進入點：`reservation-frontend/src/index.js` → `App.js`
- 路由：React Router 7，`BrowserRouter`，多數頁面 lazy + `Suspense`
- 建置：Vite 6，`build.outDir = build`，由後端提供
- 測試：Vitest（`npm test`），不是 CRA Jest（`AGENTS.md` 仍寫 CRA Jest，**文件過期**）

主要依賴：react ^18.2.0、react-router-dom ^7.1.5、bootstrap ^5.3.3、react-bootstrap ^2.10.9、axios ^1.10.0、dayjs、recharts、gsap、motion、@fullcalendar/*、@tiptap/*、xlsx、@dnd-kit/*、isomorphic-dompurify。

`utils/axiosClient.js` 存在，但 `src/` **沒有**任何檔案 import 它。服務層以 `utils/fetchClient.js` 為主。部分舊元件仍直接 `fetch`（例如 `components/ViolationManagement.js`）。

## 模組對檔案

### 公開網站與微學習

| 路徑 | 主要檔案 |
|------|----------|
| `/`、`/about`、`/faq`、`/privacy`、`/terms` | `pages/HomePage.js`、`AboutPage`、`FAQPage`、`PublicLayout`、`components/Header.js`、`constants/translations.js` |
| `/activities`、`/practice/*` | `pages/ActivitiesPage.jsx`、`WordBridgePage.jsx`、`ListeningLadderPage.jsx`、`VocabularyDepthPage.jsx`、`VocabularySizePage.jsx`、`data/learningContent/` |
| `/weekly` | `pages/WeeklyPage.jsx`、`services/weeklyReportApi.js`；後端 `routes/weeklyReportRouter.js` |
| 公告 | `pages/AnnouncementsPage.jsx`；後端 `routes/announcementRouter.js`、`adminAnnouncementRouter.js` |

### 預約／活動／簽到／違規

| 層 | 檔案 |
|----|------|
| 公開預約 | `pages/EventsPage.js`、`hooks/useEventBooking.js`、`components/EventList.js` |
| 我的預約 | `pages/MyReservationsPage.js`（`RequireStudentAuth`） |
| 後台運作 | `components/AdminHome.js`、`pages/admin/AdminEventDetailPage.jsx`、`hooks/useAdminEventWorkspace.js` |
| API | `routes/eventRouter.js`、`eventTypeRouter.js`、`reservationRouter.js` |
| 時間規則 | `utils/reservationTime.js`（前後端各一份）、`services/eventTypeService.js` |
| 違規／黑名單 | `components/ViolationManagement.js`、`routes/blacklistRouter.js`、`services/blacklistEnforcementService.js`、`models/BlackListRecord.js`、`models/User.js` |

### 問卷與 Gate

| 層 | 檔案 |
|----|------|
| 學生填寫 | `components/SurveyPage.js`、`SurveyChoicePage.js` |
| 後台 | `pages/admin/AdminSurveyCenterPage.js`、`AdminSurveyRulesPage.js`、`AdminSurveyResponsesPage.js`、`AdminSurveyAnalyticsPage.js`、`AdminSurveyDataHealthPage.js` |
| API | `routes/surveyRouter.js`（同時掛 `/api/surveys` 與 `/api/admin/surveys`）、`surveyGatewayRouter.js`、`adminSurvey*Router.js`、`englishTableSurveyRouter.js` |
| Gate | `middlewares/checkSurvey.js`、`services/surveyGateService.js`、`models/SurveyRule.js` |

### 培力英檢報名、BESTEP、班級

| 層 | 檔案 |
|----|------|
| 學生報名 | `components/EnglishTestRegistrationPage.js`（`RequireStudentAuth`）、`routes/englishTestRegistrationRouter.js` |
| 學習有伴 | `components/LearningPartner*Page.jsx`、`routes/learningPartnerRouter.js` |
| 後台英檢 | `components/EnglishTestManagement.js`、`pages/admin/EnglishTestImportHubPage.jsx` |
| 班級／BESTEP | `components/ClassOverview.js`、`ClassDetail.js`、`ClassBestepOverview`、`routes/adminClasses.js`、`routes/bestepRouter.js`、`controllers/bestep*Controller.js`、`services/bestepImportService.js` |

### 學習歷程與成效分析

| 層 | 檔案 |
|----|------|
| 後台 LJ | `pages/admin/LearningJourneyDashboardPage.jsx`、`LearningJourneyStudentProfilePage.jsx`、`components/learningJourneyV3/` |
| API | `routes/learningJourneyV3Router.js` → `/api/admin/learning-journey-v3`；`routes/learningJourneyRouter.js` 仍掛 `/api/admin/learning-journey` 與 `/api/v3/learning-journey` |
| 讀模型開關 | `services/learningJourney/learningJourneyFeatureFlags.js`（`ENABLE_LEARNING_JOURNEY_V3_READ_MODEL`，預設開） |
| 學期寫入政策 | `services/learningJourney/canonicalSemesterPolicyService.js` |
| 成效分析 | `pages/admin/LearningAnalytics*.jsx`、`routes/learningAnalyticsRouter.js`、`services/learningAnalytics/` |
| 舊分析 | `/admin/analytics/overview`、`/admin/analytics/risk`、`/admin/reports` 仍存在 |

### 權限、帳號、內容、匯入

| 領域 | 檔案 |
|------|------|
| Staff 登入 | `routes/loginRouter.js`、`middlewares/auth.js`、`auth/permissions.js`、`auth/accessProfile.js` |
| 學生登入 | `routes/studentAuthRouter.js`、`middlewares/studentAuth.js`、`services/studentAuthService.js`、`models/StudentAccount.js` |
| 前端權限 | `constants/permissions.js`、`utils/accessControl.js`、`constants/adminRouteAccess.js`、`constants/adminNavigation.js` |
| 一致性腳本 | `scripts/check-access-control-consistency.js`（比對 Teacher JSON 與 DB override，**不**掃前端） |
| 匯入中心 | 前端 `pages/admin/ImportCenterPage.jsx`、`constants/importCenterCards.js`（導覽，不是統一上傳 API）；紀錄 `routes/importRunHistoryRouter.js` |
| 英語學習護照 | 學生 `pages/student/EnglishLearningPassport*.jsx`；API `routes/englishLearningPassportRouter.js`（email 驗證碼，非學生 JWT）；管理端 `adminEnglishLearningPassportRouter.js` |
| 週報後台 | `pages/admin/AdminWeeklyReport*.jsx`、`routes/adminWeeklyReportRouter.js` |
| 稽核日誌 | `models/AuditLog.js`、`SurveyAdminAuditLog.js`、`EnglishLearningAuditLog.js`、`SystemLog.js`、`EmailLog.js` |

## 測試基礎設施

| 端 | 配置 | 觀察 |
|----|------|------|
| 後端 | `jest.config.js`，`tests/**/*.test.js`，`tests/setup.js` 固定 JWT、關閉 rate limit | 約 201 個測試檔；`tests/security/` 有權限測試；多數 mock DB |
| 後端整合 | `tests/integration/reservationFlow.test.js` | **占位斷言**，沒有打到 app 或資料庫 |
| 後端整合 | `tests/integration/surveyFailClose.test.js` | 直接測 middleware（有效形態） |
| 前端 | Vitest，約數十個 `*.test.js(x)` | 偏 utils／詞彙庫／常數；`App.test.js` 不載入真正的 `App.js` |
| E2E | — | 倉庫內未見瀏覽器 E2E |

## 既有文件（與程式可能分歧）

| 文件 | 備註 |
|------|------|
| `AGENTS.md` | 仍寫前端測試為 CRA Jest；實際是 Vitest |
| `reservation-backend/docs/DEVELOPER_PERMISSION_GUIDE.md` | 未涵蓋後續的 LVA、ET 分組、ELP、學生帳號等權限鍵 |
| `reservation-backend/docs/PHASE_2_6_PERMISSION_MATRIX.md` | 仍把 permission table 寫成規劃；Phase 3 與 `accessVersion` 已在程式中 |
| `reservation-backend/docs/API_SPECIFICATION.md` | 未在本次逐端點對照，**不能**當成完整現行契約 |
| `docs/UX-AUDIT.md`、`docs/UX-AUDIT-ADMIN.md` | 既有 UX 筆記，本次未重跑視覺稽核 |

## 背景工作與維運腳本（分類，非完整清單）

- 權限：`access:check-consistency`、`access:seed-role-permissions`、`access:audit-role-permissions`
- 學習歷程：`lj:daily-governance`、`lj:reconcile-semester`、`lj:rebuild-analytics`、`lj:promote-bestep`
- 備份／日誌：`backup`、`backup:health`、`logs:cleanup`
- 學期：`semester:sync`／`semester:check`（腳本在倉庫 `scripts/sync-semester-config.js`）
- 部署檢查：`post-deploy-check`、`health-check`（檔案為 `scripts/post_deploy_check.mjs`、`health-check.mjs`）
