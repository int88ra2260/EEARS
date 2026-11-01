# 07 缺口、風險與待驗證

## 掃描範圍

已讀或已對到掛載點：

- `server.js` 的 analytics、reports、learning-analytics、learning-journey v3 掛載。
- `learningAnalyticsOverviewService.js`、`kpiReportService.js`（載入嘗試段）、`b2ReportService.js`、`examSessionService.js`、`bestepImportService.js` 的等級正規化與 `isPassed`、`bestepClassService.js` 的學期過濾與通過率、`learningPartnerOutcomeService.js` 的定義物件、`kpiInstrumentThresholds.js`、`b1PlusWatch.js`、`ResourceEffectEstimate.js`。
- 前端總覽篩選鍵 `OVERVIEW_FILTER_KEYS`、`App.js` 上學習成效舊路徑改導（依前期盤點；本次未重讀 `App.js` 每一行，改導標 PARTIAL 若與前期不一致）。
- 既有文件檔名存在（`docs/learning-analytics-*.md`、`reservation-backend/docs/analytics-and-reports-*.md`）但**不用文件代替程式**。文件與程式衝突時以本次讀到的程式為準。

未逐行覆蓋，結論不得寫死：

- `analyticRebuildService` 的完整輸入表。
- `kpiPolicyEngine` 在多筆嘗試中選哪一筆。
- `analyticsService` 每個 KPI 的 SQL。
- 問卷分析、週報互動、ET 分組報表、口說診斷彙總、微學習是否進快照、護照點數。
- 培力 Excel 與 `EtExamAttempt` 是否同一管線。
- `englishTestsRouter.js` 是否被維運腳本 require。
- 正式資料庫列數、快照是否等於最新匯入、`causal_claim_allowed` 是否恆為 false。

## 風險

| ID | 問題 | 證據 | 影響 | 信心 | 需資料庫 | 方向 |
|---|---|---|---|---|---|---|
| F-03 | KPI 分子時間寬於名冊學期 | `loadAttemptsForStudents` 只濾 studentId 與 status | 上呈數字可能包含別學期考試 | 高 | 是 V-01 | 規則改成 as-of 或批次 id 後再對外 |
| F-04 | 兩套 B2 並存 | `getSemesterB2Report` vs `runKpiReport` | 對帳失敗 | 高 | 否 | 對外只留成對門檻；歷史最佳改名並標 as-of |
| F-05 | 加號被刪 | `normalizeCefrLevel`、測試斷言 B2+→B2 | 無法重現簡報級距 | 高 | 是 V-04 對原始檔 | 新匯入另存原始等級；舊列無法還原 |
| F-06 | 因果欄位名稱 | `causal_effect` 存在，旗標預設 false | 報告誤用 | 中 | 是 V-05 | 對外隱藏該欄，直到有書面研究設計 |
| F-11 | 註解寫 B2+ 但 rank 4 是去加號後的 B2 | `b2ReportService` 註解與 `cefr.js` | 文字比資料多一個級距 | 高 | 否 | 改註解與 API note |
| F-12 | 歷史最佳會改寫舊學期 | 查詢當下 `getStudentsBestSkillsMap` | 補匯入後去年的率變了 | 高 | 是 V-02 | 趨勢改為凍結 as-of |
| F-13 | 快照與來源表雙軌 | 班級讀成績表，分析讀快照 | 同一天兩個數字 | 高 | 是 V-03 | 頁面顯示快照版本與「來源表已更新但未重建」 |
| F-08 | 行為×成績沒有統一窗 | 有伴用同學期成績；快照用累積時數；技能用 14 日／同學期梯 | 關聯句無法跨頁複核 | 高 | 否 | 只在對照入口允許 join |
| F-09 | 權限與工作集改變母體 | 工作集有橫幅；活動 scope 標示不完整 | 主任與教師看到不同母體卻用同一標題 | 中 | 用測試帳號即可，不必改資料 | 每個數字帶母體句 |
| F-07 | 未掛載路由仍在樹 | `server.js` 無 englishTestsRouter | 後續開發誤接舊 API | 高 | 否 | 盤點腳本引用後再決定封存，本次不刪 |

## 待驗證（需人同意後才查正式庫）

不在本次執行。若要查，應為唯讀 SELECT，且先確認連到的不是被他人使用的寫入帳號。

| ID | 問題 | 建議查法（尚未執行） |
|---|---|---|
| V-01 | 名冊學期與達標所根據的 `testDate` 差多少 | 抽一個學期名冊，算嘗試日的學期分布 |
| V-02 | 歷史最佳是否含名冊學期之後的考試 | 比對最佳成績日與 `semesterId` 區間 |
| V-03 | 快照版本時間 vs 最近 `importedAt` | 兩欄的最大時間 |
| V-04 | 已匯入列是否已無加號 | `listeningLevel` 等 DISTINCT，對照仍留著的原始檔 |
| V-05 | 是否有人把因果旗標打開 | `causal_claim_allowed` 的計數 |
| V-06 | 培力成績表與嘗試表是否同一學生同一學期都有 | 學號交集，不是證明同一管線，只證明重疊 |

## 業務能力不可在遷移時弄丟

即使計算最終被替換，這些問題仍要有入口：本季活動營運、單一培力檔的出席與四項等級、報名來源、班級名單、有伴流程、有伴與非有伴的描述差距（含限制句）、名冊達標與未達標名單、接近門檻的人、個人紀錄、系所切片、同一工具前後梯、原始匯出、快照版本。

簡報裡的大題達成率、四項都出席、全校型／領域型對照，**程式中尚未找到對應聚合**（出席有分項列，是否已有「四項都到」的頁面指標：PARTIAL）。這是缺口，不是已上線能力。遷移不得假裝它已經在系統裡。
