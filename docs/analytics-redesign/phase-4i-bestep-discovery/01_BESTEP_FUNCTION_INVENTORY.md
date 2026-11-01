# BESTEP 功能入口

盤點以 `server.js` 掛載與 `App.js` 路由為準。只出現在檔案、沒有被掛載的路由標 Legacy。

| Entry | Route / Page | Role | Purpose | API | Service | Source | Time | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| E-01 | `/register/english-test` | 已登入學生 | 個人培力報名 | `POST /api/english-test/register` | `englishTestRegistrationRouter` | `english_test_registrations` | 報名學期欄位；空值才用 `createdAt` 推斷 | Active | `App.js`；`englishTestRegistrationRouter.js` 約 1035 行 |
| E-02 | `/register/english-test/group` | 學生／隊長 | 團體報名與狀態 | `learningPartnerRouter` | 讀既有報名列 | `learning_partner_teams` 與報名表 | 報名學期 | Active | `server.js` `app.use('/api', learningPartnerRouter)` |
| E-03 | `/admin/english-test` | 英檢管理權限 | 審核、名單、抵免、報名統計 | `GET /api/english-test/registrations`、`/registrations/stats/analytics` | router 內查詢 | `english_test_registrations` | 管理端指定的報名學期 | Active | `adminNavigation.js` `培力英檢管理` |
| E-04 | `/admin/english-test/import` | `CAN_IMPORT_BESTEP` 等 | 出席與成績匯入 | `POST /api/admin/bestep/attendance/import`、`/scores/import` | `bestepImportService` | `bestep_attendance`、`bestep_exam_scores` | 操作者指定的檔案學期；出席另傳 `examDate` | Active | `bestepRouter.js`；`EnglishTestImportHubPage.jsx` |
| E-05 | `/admin/classes/:classId/bestep` | 教師或班級／匯出權限 | 單班報名、到考、四科通過 | `GET /api/admin/classes/:classId/bestep-overview` | `bestepClassService` | 班級名冊、報名、出席、成績檔 | 查詢參數 `semester` | Active | `adminClasses.js` 107 行 |
| E-06 | 同上匯出 | 同上 | Excel | `GET .../bestep-overview/export` | `bestepClassExportExcel.js` | 同 E-05 | 同 E-05 | Active | `adminClasses.js` 113 行 |
| E-07 | `/api/admin/bestep/teams/ranking` | `englishTestDomainMiddleware` | 團體名次 | GET/POST ranking | `bestepRankingService` | `bestep_team_rankings` 與成績 | 檔案學期 | Active API | `bestepRouter.js` 30–36 行 |
| E-08 | `/admin/learning-journey` 英檢摘要 | LJ 讀取權限 | 學期英檢摘要 | `/api/admin/learning-journey/semesters/:id/english-test-summary` | `englishTestSummaryV3Service` | LJ / et 讀模型 | LJ 學期 | Active | `learningJourneyRouter.js` 187 行 |
| E-09 | `/admin/learning-analytics/kpi-report` 等 | LJ view | 達標、技能、接近 B2 | `/api/admin/learning-analytics/*` | `kpiReportService` 等 | `et_exam_attempts` 與快照 | 名冊學期／查詢當下歷史最佳 | Active，但不是成績檔直讀 | `learningAnalyticsRouter.js`；`kpiReportService.js` |
| E-10 | `routes/englishTestsRouter.js` | 未掛載 | 舊英檢學期 CEFR 分布、資料品質 | 檔案內有 `/semesters/:id/cefr-distribution` | `englishTestsController` | et 表 | et semester | Legacy | `server.js` 沒有 require 這個 router |
| E-11 | `routes/englishTestTrackingRouter.js` | 未掛載 | 舊追蹤匯入與最佳技能 | 檔案內路由 | tracking services | `et_exam_attempts` | `testDate` | Legacy | 前端 `/admin/english-test-tracking` 已導向學習歷程 |
| E-12 | `/admin/bestep/import` | 任何進到舊網址的人 | 舊匯入網址 | 無 | redirect | 無 | 無 | Legacy | `App.js` 559 行導向 `/admin/english-test/import` |

`bestepRouter.js` 有 import `getBestepOverview`，但沒有把它掛成路由。現役班級 API 在 `adminClasses.js`。

報名統計 `GET /english-test/registrations/stats/analytics` 只做訊息來源、系所、年級分組，不是到考或成績分析。

權限證據：`adminRouteAccess.js` 的 `/admin/classes/:classId/bestep`、`/admin/english-test`、`/admin/english-test/import`。
