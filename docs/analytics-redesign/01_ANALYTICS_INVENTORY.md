# 01 分析資產盤點

狀態標籤：`MOUNTED` 有路由且 `server.js` 或 `App.js` 掛載；`REDIRECT` 舊路徑改導；`UNMOUNTED` 檔案在、入口未掛；`PARTIAL` 有計算但本次未逐行核對 SQL。

盤點原則：有使用者入口或會被已掛載 API 呼叫的計算才列為資產。純函式不單獨成卡，寫在 Dependencies。

## A. 學習成效分析（`/admin/learning-analytics`，API `/api/admin/learning-analytics`）

權限：檢視多為學習歷程讀取權；匯出另要匯出權；設定要 `CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS`。工作集 `studentIds` 可由 POST body 縮小母體（`workingSetIds.js`）。頁面若未標示，使用者可能以為仍是全體。

| ID | Name | Business Question | Decision User | Unit | Population | Data Source | Time Model | Metric | Frontend | API | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| LA-01 | 總覽快照 | 快照裡有多少人、英檢與前後測覆蓋、CEFR 分布、資源時數 | 中心分析人員 | 學生（快照列） | `lj_analytic_students` 符合篩選；學期**不**納入快照 where（overview service 排除 `semester`） | 快照；可選再呼叫 LJ `getSemesterB2Report` | 快照版本；學期只影響旁路 B2 報告 | 人數、覆蓋率、CEFR 計數。前端已拿掉「B2+ 快照」卡，API 仍回 `b2plusRate` | `LearningAnalyticsOverviewPage.jsx` | `GET/POST /overview` | MOUNTED。UI 與 API 欄位不完全同歩：PARTIAL |
| LA-02 | B2 KPI 報表 | 這學期名冊的聽讀成對、說寫成對達標 | 上呈、行政 | 學生 | `et_enrollment_snapshots` 該 `semesterId` 且 `isActive`；可再依政策年級與工作集縮小 | 名冊 + `et_exam_attempts`／技能分 | 分母＝名冊學期；分子＝該生全部 valid 嘗試（不依考試日切學期） | 政策引擎 `kpiPolicyEngine`＋`kpiInstrumentThresholds`（培力聽讀合計≥200、說寫≥560 等） | `LearningAnalyticsKpiReportPage.jsx` | `POST /kpi/report`、匯出、gaps | MOUNTED |
| LA-03 | 接近 B2 | 誰尚未達 B2 且 GSE 51–58 | 輔導、行政 | 學生 | 快照；條件在 `b1PlusWatch.js` | 快照技能分→GSE | 快照當下最佳，不是某次考試 | GSE 帶，不是 CEFR 字串 B1+ | `LearningAnalyticsB1PlusPage.jsx` | `GET/POST /b1-plus` | MOUNTED |
| LA-04 | 學生探索 | 依條件看一批學生的背景與英檢進度 | 行政、教師（受 scope） | 學生 | 快照 ∩ 篩選 ∩ 工作集 | 快照 | 快照 | 名單欄位；前後測原始分是否完整：本次未逐欄核對，標 PARTIAL | `LearningAnalyticsStudentExplorerPage.jsx` | `/student-explorer` | MOUNTED |
| LA-05 | 追蹤名單 | 固定一批人日後再看 | 行政 | 群體 | `lj_tracking_cohorts` | 自存學號 | 建立時點 vs 之後快照：讀取時是否重算 UNKNOWN（未追 service 全文） | 名單 | `LearningAnalyticsTrackingCohortsPage.jsx` | `/tracking-cohorts` | MOUNTED。重算語意 PARTIAL |
| LA-06 | 個人軌跡 | 一個人的輔導摘要與歷程 | 輔導 | 學生 | 單學號 + scope | 快照／歷程事件 | 個人多年 | 摘要卡 | `LearningAnalyticsStudentJourneyPage.jsx`、`StudentDetailPage.jsx` | `/students/:id/journey` | MOUNTED |
| LA-07 | 系所比較 | 系所或入學年的能力差異 | 中心 | 群體 | 快照 | 快照 GSE／CEFR | 快照，不是單一考試批次 | 分布比較，頁面自述不是學期 KPI | `LearningAnalyticsCohortsPage.jsx` | `/cohorts` | MOUNTED |
| LA-08 | 技能成長 | 聽讀說寫 GSE 前後差異 | 中心、研究向 | 學生×技能 | 可形成前後測的快照樣本 | 快照考試；GSE 對照 `gseMappingDefaults.js` | 梯次：BESTEP 同學期合併、其他工具 ≤14 天（`examSessionService.js`） | 原始差、校正後成長（回歸或簡化，`lvaAdjustedGrowthService.js`） | `LearningAnalyticsSkillsPage.jsx` | `/skills` | MOUNTED。校正後成長是統計調整，不是因果 |
| LA-09 | 課／師／活動 | 某個開課或活動的參與與可比較樣本 | 課務、活動 | 開課／活動 | 快照曝光 ∩ 篩選 | `lj_student_events` 等投影 | 事件時間投影進快照；與名冊學期不一定同一刀 | 參與、樣本數、資料品質 | `LearningAnalyticsOfferingsPage.jsx` | `/offerings` | MOUNTED。細部口徑 PARTIAL |
| LA-10 | 資源覆蓋 | 資源類型的參與與可觀察樣本 | 中心 | 資源類型 | 快照 | 投影後曝光 | 累積至快照 | 時數、成長樣本 | `LearningAnalyticsResourcesPage.jsx` | `/resources` | MOUNTED |
| LA-11 | 原始資料 | 把快照列匯出核對 | 分析人員 | 列 | 篩選後快照 | 快照 | 快照版本 | 匯出欄位見 `learningAnalyticsRawDataExportService.js` | `LearningAnalyticsRawDataPage.jsx` | `/raw-data`、`/export` | MOUNTED |
| LA-12 | 分析設定 | 篩選對照、資源技能、LVA 參數、KPI 政策 | 系統管理者 | 設定 | 不統計學生 | `learning_analytics_*` 設定表 | 設定版本 | 無成效指標 | `LearningAnalyticsSettingsPage.jsx` | `/settings`、`/kpi/policies` | MOUNTED |
| LA-13 | 洞察／模型執行頁 | 舊入口 | — | — | — | — | — | — | `App.js`：`insights`→overview，`model-runs`→resources | API `/insights`、`/model-runs` 仍在 | REDIRECT（頁）。API 仍 MOUNTED |

## B. 學習歷程讀模型（`/admin/learning-journey`，API `/api/admin/learning-journey-v3`）

| ID | Name | Question | Population | Time | Metric | Status |
|---|---|---|---|---|---|---|
| LJ-01 | 學期 B2 報告 | 名冊裡各技能歷史最佳是否達 B2 | `et_enrollment_snapshots` 該學期 | 分母＝學期名冊；能力＝歷史最佳（`b2ReportService.js` 註解） | CEFR rank ≥ 4 | MOUNTED `GET /semesters/:id/b2-report`。儀表板 `LearningJourneyDashboardPage.jsx` 會讀 |
| LJ-02 | 學期分解／健康／學生名單 | 名冊營運與資料健康 | 名冊 | 學期 id | 本次未逐指標展開 | PARTIAL |
| LJ-03 | 學生歷程剖面 | 單一學生事件與考試 | 學號 | 事件時間／考試日 | 讀模型 | MOUNTED |
| LJ-04 | LVA 分析與模型執行 | 調整後成長、資源估計 | 快照重建結果 | 模型執行 id | `lvaAnalyticsService.js`、`resource_effect_estimates` | API MOUNTED。前端模型頁已改導 resources。`LearningAnalyticsModelRunPanel.jsx` 仍連結已改導路徑 |
| LJ-05 | 研究匯出、品質斷言 | 給進階核對 | 快照 | 版本 | `researchExportService.js`、`qualityPanelService.js` | API MOUNTED。是否有穩定選單入口：PARTIAL |
| LJ-06 | 重建 | 把來源投影成 `lj_analytic_*` | 匯入與系統事件 | 重建當下 | `analyticRebuildService.js` | 背景計算 MOUNTED。頁面數字落後於匯入，直到重建 |

## C. 培力與英檢行政

| ID | Name | Question | Population | Time | Evidence | Status |
|---|---|---|---|---|---|---|
| BT-01 | 班級 BESTEP 概況 | 這一班本學期報考、到考、四項都達 B2 | 該班該學期 `class_memberships` | 培力 `semester` 字串，出席與成績都依此過濾（`bestepClassService.js`） | 系統報名 + 匯入出席／成績 | MOUNTED `/admin/classes/:id/bestep` |
| BT-02 | 報名數據分析 | 從何得知、系所、年級 | 報名列，可依學期 | 報名學期 | 只來自報名表 | MOUNTED `GET /english-test/registrations/stats/analytics`。`AnalyticsSection.js` |
| BT-03 | 學習有伴漏斗 | 組隊、完成、流失 | 該學期隊伍 | 學習有伴營運學期 | 系統行為 | MOUNTED `GET /admin/learning-partner/funnel` |
| BT-04 | 學習有伴成績對照 | 有伴與沒有伴的該次 BESTEP 差距 | 有成績者；定義在 API `definition` | 同學期 BESTEP | **混合**：行為分群 × 匯入成績 | MOUNTED `GET /admin/learning-partner/outcome` |
| BT-05 | 團體名次 | 依培力成績排名與獎金 | 該學期隊伍 | 學期 | 匯入成績 × 系統組隊 | MOUNTED `bestepRouter` ranking |
| BT-06 | 英檢學期摘要路由檔 | 學期 CEFR 分布等 | UNKNOWN（未掛載故無線上母體） | 檔內學期 id | `routes/englishTestsRouter.js` | **UNMOUNTED**（`server.js` 無對應 `app.use`） |
| BT-07 | 舊英檢追蹤路由檔 | 舊追蹤 | — | — | `englishTestTrackingRouter.js` | **UNMOUNTED**（與 AGENTS.md 一致；本次以未出現在 `server.js` 為準） |

## D. 活動與行政營運分析

| ID | Name | Question | Population | Time | Source | Status |
|---|---|---|---|---|---|---|
| OP-01 | 行政分析總覽 | 預約、名額、簽到、違規 | 中心；教師路徑另有範圍 | `events.date` 落入 `SEMESTER_RANGES`（字串日期 CAST） | 系統行為；註解寫會重用 KPI／風險 | MOUNTED `/admin/analytics/overview`，`analyticsService.js` |
| OP-02 | 風險偵測 | 誰需要優先處理 | 受權限與班級範圍限制 | 學期區間 | 行為 + 部分學習歷程最佳技能（檔頭引用 `bestSkillService`） | MOUNTED `/admin/analytics/risk`。混合程度 PARTIAL |
| OP-03 | 班級／教師報表 | 班或師的活動統計 | `reportsRouter` 班級或教師 scope | 報表參數 | 系統行為 | MOUNTED `/admin/reports` |
| OP-04 | 趨勢舊路徑 | — | — | — | — | REDIRECT 至 overview |
| OP-05 | 問卷分析 | 作答分布 | 問卷範圍權限 | 問卷／學期：PARTIAL | 系統作答 | MOUNTED `/admin/survey-analytics` |
| OP-06 | 週報互動分析 | 某一期週報的互動 | 該期 | 週報 id | 系統事件 | API `GET /admin/weekly-reports/:id/analytics`。完整指標 PARTIAL |
| OP-07 | ET 分組報表 | 場次任務 | 分組權限 | 場次 | 系統 | 頁 `AdminEtGroupingReportsPage.jsx`。口徑 PARTIAL |
| OP-08 | 公開站瀏覽計數 | 流量 | 站點 | 請求時 | 系統 | `GET /api/stats/views`。不是學習成效 |

## E. 學生端與練習（有紀錄，但是否被中心成效頁讀取：多數 UNKNOWN）

口說診斷、Vocabulary Depth、微學習面板（`MicroLearningEngagementPanel.jsx` 掛在總覽）、英語護照點數。本次確認總覽有微學習面板；其餘是否進入快照投影：**UNKNOWN**（未追 `eventProjectorService` 全文）。

## 共用限制（多卡適用）

- 快照 CEFR 經學習歷程正規化，加號級距不可當「接近 B2」條件（見 `b1PlusWatch.js` 與專案 skill；程式側以 GSE 51–58 實作接近 B2）。
- 培力匯入本身也去加號，故來源表 `bestep_exam_scores` 的等級欄也不能假設仍含 B1+。
- 工作集與班級 scope 會讓同一 API 對不同登入者返回不同分母。頁面是否始終標示：LA 工作集有橫幅；活動分析的權限縮限是否每張圖都標示：**PARTIAL**。
