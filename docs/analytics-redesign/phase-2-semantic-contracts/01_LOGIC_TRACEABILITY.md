# 01 七套分析邏輯追溯

路徑模板：原始表 → 清洗 → 母體 → 時間 → 選筆 → 聚合 → API → 畫面。

同一套裡口徑不同的，拆成子邏輯。行號以本次讀取的檔案為準。

---

## S1 活動與行政營運

業務目的：看某一學期日期區間裡，活動名額、預約、簽到、違規，以及班級名冊上的參與與培力行政數字。不是英檢能力模型。

### S1-A 預約營運 SQL

| 欄位 | 內容 |
|---|---|
| Logic ID | S1-A |
| Business Purpose | 學期區間內預約量、名額利用率、簽到率、違規率 |
| Source Tables | `reservations`、`events`；另有 `english_test_registrations.hasCEFRB2`（legacy，函式註解寫前端營運頁不再顯示） |
| Data Transformations | `events.date` 經 `CAST(TRIM(date) AS DATE)` 對 `SEMESTER_RANGES`（`analyticsService.js` 24–26、442–454 行） |
| Population | 活動日落在學期區間的預約列。**沒有**排除取消或特定 `checkinStatus` |
| Inclusion Rules | `reservations` INNER JOIN `events`，日期在區間內 |
| Exclusion Rules | 日期無法 CAST 或區間外。取消狀態：SQL 未過濾。VERIFIED 缺這層過濾 |
| Time Boundary | `SEMESTER_RANGES[semester].start/end`。不是名冊學期，不是考試日 |
| Attempt Selection | NOT_APPLICABLE |
| Aggregation | `COUNT(*)` 預約列，不是 DISTINCT 學號。名額是區間內各活動 `maxCapacity` 加總。簽到是 `checkinStatus = '已簽到'`。違規是 `已登記違規` |
| Metric Formula | `bookingRate = 預約列數 / 名額加總`；`attendanceRate = 已簽到列數 / 預約列數`；`violationRate = 違規列數 / 預約列數`（436–472 行） |
| Missing Data | 無列則計數 0。`maxCapacity` 用 COALESCE 0 |
| API Consumers | `analyticsRouter` 的預約總覽（函式 `getReservationOverview`） |
| UI Consumers | `/admin/analytics/overview`。legacy `englishPassRate` 註解稱前端不再顯示。畫面是否仍有殘留欄位：PARTIALLY_VERIFIED |
| Evidence | `services/analyticsService.js` `getReservationOverview` |
| Verification Status | VERIFIED |

容量分解 `getReservationCapacityBreakdown` 依活動類型再聚合，同一日期規則。PARTIALLY_VERIFIED（SQL 在 578 行以後，本次讀到 GROUP BY，未逐欄對前端）。

### S1-B 班級／名冊行政 KPI

| 欄位 | 內容 |
|---|---|
| Logic ID | S1-B |
| Business Purpose | 給定學生名單在某學期的活動參與、培力報名、培力出席、培力通過、問卷完成、違規 |
| Source Tables | `reservations`＋`events`、`english_test_registrations`、`bestep_attendance`、`bestep_exam_scores`、問卷列（`buildKpiContext`） |
| Data Transformations | 學號正規化。每人只留一筆最新報名（141–145 行，先到先留，不是依日期排序後的「最新」：迴圈覆寫條件是 `if (!latest)`，所以是**查詢結果的第一筆**，不是證明過的最新一筆）。狀態：PARTIALLY_VERIFIED，排序未在這段讀到 |
| Population | 呼叫端傳入的 `studentIds`。行政總覽會先從班級成員去重學號 |
| Inclusion Rules | 參與：該生在學期區間有 `checkinStatus = '已簽到'`。報名：該生第一筆報名 `status === 'success'`。培力出席：`examType` **恰好**為 `LR` 或 `SW` 且 `attended`。通過：`bestep_exam_scores.passed` |
| Exclusion Rules | 簽到 SQL 不含未簽到。出席不計 L／R／S／W 分項列 |
| Time Boundary | 活動：`e.date BETWEEN` 字串區間（234–241 行），**沒有** S1-A 的 CAST。培力：context 依學期載入出席與成績（函式前段，本次未重讀 WHERE，標 PARTIALLY_VERIFIED） |
| Attempt Selection | 成績一人一列覆寫 `scoreByStudent[sid] = row`，多列時後寫覆蓋先寫。排序未讀完：PARTIALLY_VERIFIED |
| Aggregation | 參與率分母是傳入人數，分子是至少簽到一次的人數。培力通過率分母是 `max(lrAttendedCount, swAttendedCount)`，不是報考人數（433–444 行） |
| Metric Formula | 見上。出席率是聽讀率與說寫率的平均，不是「四項都到」 |
| Missing Data | 沒有出席列則該科不算出席。沒有成績則 `passed` 不算 |
| API Consumers | `analyticsService` 班級總覽路徑呼叫 `kpiService` |
| UI Consumers | `/admin/analytics`、`/admin/reports` 的班級／風險組裝。PARTIALLY_VERIFIED 哪些圖用哪一個函式 |
| Evidence | `services/kpiService.js` 158–169、393–445 行；檔頭註解寫明不得與學習歷程達標混用 |
| Verification Status | VERIFIED（公式）；活動日期字串比對與 CAST 不一致為 VERIFIED |

S1-A 與 S1-B 的「出席」不是同一個分子，也不是同一個分母。

---

## S2 班級 BESTEP

| 欄位 | 內容 |
|---|---|
| Logic ID | S2 |
| Business Purpose | 這一班、這個培力檔案學期：誰報名、誰出席、成績列是否四項達標 |
| Source Tables | `class_memberships`、`bestep_attendance`、`bestep_exam_scores`、學習有伴隊伍（同一函式附帶，不進入通過率） |
| Data Transformations | 等級已在匯入時正規化。通過旗標讀列上的 `passed`，不在讀取時重算 |
| Population | `classId + semester` 的班級成員。統計函式註解寫「全班、學習歷程名冊本國生口徑」並會 `loadSemesterRosterMap`。哪些人被名冊剔除：PARTIALLY_VERIFIED（189–218 行已見 registeredCount 與 passedCount） |
| Inclusion Rules | 出席與成績 `where semester = 班級學期` |
| Exclusion Rules | 其他學期的培力列。沒有報名成功的人在**匯入**時會被拒（`STUDENT_NOT_FOUND`），所以成績表通常已是報名成功者；讀取時不再檢查報名狀態。VERIFIED 匯入條件；讀取時是否再濾：此段讀取沒有 join 報名表 |
| Time Boundary | 檔案學期字串。出席列另有 `examDate`，統計通過率不用它 |
| Attempt Selection | 一人同一學期成績 map 以學號為鍵，後列覆蓋前列（154–167 行）。沒有「取最高分」 |
| Aggregation | `passedCount / registeredCount` |
| Metric Formula | `passed` 在匯入時由 `isPassed`：四個等級都在 CEFR 列表且 index ≥ B2（`bestepImportService.js` 313–317 行）。缺任一等級則 false |
| Missing Data | 沒分數不可匯入（至少要有一個分數欄）。四項等級不齊則 `passed=false`，與「未達標」同一旗標，**缺考與未達標在這個布林上不可分** |
| API Consumers | 班級 BESTEP overview |
| UI Consumers | `/admin/classes/:id/bestep` |
| Evidence | `bestepClassService.buildClassBestepOverviewStatistics`、`bestepImportService.isPassed` |
| Verification Status | VERIFIED |

---

## S3 培力報名描述

| 欄位 | 內容 |
|---|---|
| Logic ID | S3 |
| Business Purpose | 報名者的消息來源、系所、年級分布。不是分數 |
| Source Tables | `english_test_registrations` |
| Data Transformations | 本次未重讀聚合 SQL。PARTIALLY_VERIFIED |
| Population | 報名列，可依報名學期 |
| Inclusion Rules | 路由 `GET /english-test/registrations/stats/analytics` 已掛載（Phase 1） |
| Exclusion Rules | UNKNOWN（未重讀 WHERE） |
| Time Boundary | 報名紀錄上的學期欄，不是考試日 |
| Attempt Selection | NOT_APPLICABLE |
| Aggregation | 次數與占比。PARTIALLY_VERIFIED |
| Metric Formula | 未在本階段逐式展開。不把 Phase 1 的「Q21」當成已複核公式 |
| Missing Data | UNKNOWN |
| API Consumers | 英檢報名統計 |
| UI Consumers | `AnalyticsSection.js` |
| Evidence | 路由存在為 Phase 1 已查；本階段未重開該 SQL |
| Verification Status | PARTIALLY_VERIFIED |

S1-A 的 `hasCEFRB2` 比率也讀這張表，但是另一個欄位、另一個公式，不可併進 S3。

---

## S4 學習有伴

### S4-A 漏斗

系統行為：組隊、同意、完成。時間是學習有伴營運學期。公式本次未重讀。PARTIALLY_VERIFIED。API：`GET /admin/learning-partner/funnel`。

### S4-B 成績差距

| 欄位 | 內容 |
|---|---|
| Logic ID | S4-B |
| Business Purpose | 同學期、有 BESTEP 成績的人裡，有伴與非有伴的分數差 |
| Source Tables | `learning_partner_team_members`（已完成同意）＋ `bestep_exam_scores` |
| Data Transformations | 學號正規化。有伴定義寫在回傳 `definition.partner` |
| Population | 有成績者。有伴但沒成績另計 `partnerWithoutScoreCount`，不進平均 |
| Inclusion Rules | 有伴＝該學期已完成同意之成員。非有伴＝同學期成績名單中不是這些人 |
| Exclusion Rules | 沒有成績的有伴成員不進分數平均 |
| Time Boundary | 函式參數 `semester`，與成績列學期對齊（呼叫端本次未重讀 SQL，定義物件已讀） |
| Attempt Selection | 沿用成績列，不另選最佳 |
| Aggregation | 各群平均、中位數、通過率差、各技能平均差 |
| Metric Formula | `delta = partner − nonPartner`。通過率用成績列 `passed`（與 S2 同一旗標） |
| Missing Data | 無成績者排除在平均之外並另行計數 |
| API Consumers | `GET /admin/learning-partner/outcome` |
| UI Consumers | 學習有伴結果頁 |
| Evidence | `learningPartnerOutcomeService.js` 100–141 行 |
| Verification Status | VERIFIED（定義與差計算）；載入 SQL PARTIALLY_VERIFIED |

---

## S5 歷史最佳技能

| 欄位 | 內容 |
|---|---|
| Logic ID | S5 |
| Business Purpose | 名冊上的人，截至查詢當下，各技能曾達到的最高 CEFR rank |
| Source Tables | 分母 `et_enrollment_snapshots`（`semesterId`、`isActive`）。分子 `et_exam_attempts`＋`et_exam_attempt_skill_scores` |
| Data Transformations | `getCefrRank`／儲存的 `cefrRank`。加號在上游正規化時已丟。跨工具：每個技能只留最高 rank，同 rank 時 `getStudentsBestSkillsMap` **不**比較日期（只比 rank，18–25 行）；`getStudentBestSkillsWithSource` 才在同 rank 取較晚日期。報告用的是 Map 版 |
| Population | 該學期 active 名冊。可被 `allowedStudentIds` 縮小 |
| Inclusion Rules | `status: 'valid'` |
| Exclusion Rules | 非 valid。不讀 `bestep_exam_scores`，不讀 `exam_attempts` |
| Time Boundary | **沒有**考試日上限。名冊學期只限制分母 |
| Attempt Selection | 每技能取最高 rank。不同技能可以來自不同工具、不同日期 |
| Aggregation | 人數／名冊人數。技能分開，不是四項同時 |
| Metric Formula | `rank >= 4`（`B2_RANK`）。註解寫「B2+」，rank 4 在去加號後等於 B2 |
| Missing Data | 沒有該技能則該技能不計入分子，仍留在分母 |
| API Consumers | `GET .../b2-report`、`b2-breakdown`；`getLearningAnalyticsOverview` 在 query 有 `semester` 時旁路呼叫 |
| UI Consumers | 學習歷程儀表板。學習成效總覽 UI 已不送學期，這條旁路目前走不到。VERIFIED 篩選鍵不含 semester |
| Evidence | `b2ReportService.js` 39–90 行；`bestSkillService.js` 113–135 行 |
| Verification Status | VERIFIED |

風險頁 `analyticsService.js` 也 require 了 `getStudentsBestSkillsMap`（第 10 行）。它在風險分數裡怎麼用：PARTIALLY_VERIFIED（未讀風險公式全文）。

---

## S6 KPI 成對達標

| 欄位 | 內容 |
|---|---|
| Logic ID | S6 |
| Business Purpose | 選定學期名冊（再依政策年級）裡，聽讀成對與說寫成對是否達到政策 |
| Source Tables | `et_enrollment_snapshots`、`et_exam_attempts`、`et_exam_attempt_skill_scores`、政策表 |
| Data Transformations | 工具代碼 `normalizeExamType`。CEFR `normalizeCefr`（去加號）。分數加總 `combinedRaw`，缺任一科則該組無法加總 |
| Population | 名冊 `isActive`，政策 `gradeMin/Max`，可再套工作集學號 |
| Inclusion Rules | 嘗試 `status` 預設 `valid`。日期：僅當政策 `timeWindow` 不是 `lifetime` |
| Exclusion Rules | 內建政策 `timeWindow: 'lifetime'`（141–145 行），不依名冊學期切考試日。缺考日且開了日期窗：`inDateRange` 對無法解析的日期回 false（49–54 行），該筆排除 |
| Time Boundary | 分母＝名冊學期。分子預設＝終身。學年窗是 8/1 到隔年 7/31（`academicYearToDateRange`），不是 `SEMESTER_RANGES` |
| Attempt Selection | 見下表。一人只要有一個通過候選就算通過 |
| Aggregation | 通過人數／政策後名冊人數。聽讀與說寫是兩個 dimension，不是四項聯合 |
| Metric Formula | 依政策。BESTEP 預設門檻聽讀合計 ≥ 200、說寫 ≥ 560（`kpiInstrumentThresholds.js` 40–52 行）。`both_cefr` 則兩科 rank ≥ 4 |
| Missing Data | 成對缺科：`requireCompleteSkills` 時該場不算通過，計入 incomplete，不把缺考當 0 分 |
| API Consumers | `POST /api/admin/learning-analytics/kpi/report` |
| UI Consumers | `LearningAnalyticsKpiReportPage.jsx` |
| Evidence | `kpiReportService.loadAttemptsForStudents` 111–119 行；`kpiPolicyEngine.js` 186–204、236–323、378–494 行；`kpiPolicyDefaults.js` |
| Verification Status | VERIFIED |

### 選筆（本階段補完）

| 政策組場 `pairAssembly` | 行為 |
|---|---|
| `same_attempt` | 每一筆 attempt 自己成場。內建八種**不是**這個預設，內建是 same_date 或 cross_date |
| `same_date` | 同一工具＋同一 `examDate` 的多筆合併。同一技能多格時 `mergeSkillMaps` 留較高 rank，其次較高原始分，再其次較晚日期 |
| `cross_date` | 同一工具跨所有日期，各技能取最佳后再加總或比 CEFR。聽與讀可以不同日。不可跨工具 |

`pickBestCandidate`（186–204 行）只作用在 `result.passed === true` 的候選。預設 `proofSelection: 'highest_combined'`。它不決定誰沒過，只決定畫面上的證明列。

內建預設政策鍵：`pair-bothcefr-samedate-g24`（最嚴格、同日、雙科 CEFR、大二至大四）。若畫面沒改政策，看到的不是 BESTEP 200／560。200／560 在 `sumraw-*` 政策。這是 Phase 1 容易講成「KPI＝200／560」的地方，必須改成：**引擎支援該門檻；內建預設政策是同日雙科 CEFR。** 實際啟用哪一筆政策要看資料庫的預設政策列。狀態：程式預設鍵 VERIFIED；正式環境目前選中的政策 `DATA_VALIDATION_REQUIRED`。

---

## S7 分析快照

| 欄位 | 內容 |
|---|---|
| Logic ID | S7 |
| Business Purpose | 把事件投影成可篩選的學生列與考試列，供覆蓋、CEFR、GSE 前後梯、資源時數、接近 B2 |
| Source Tables | 寫入前投影：`et_exam_attempts`、`exam_attempts`、`activity_participations`、`reservations`＋`events`、`course_enrollments`、學生與名冊（入學資訊）。寫入表：`lj_student_events`、`lj_analytic_students`、`lj_analytic_exams` |
| Data Transformations | 考試 CEFR `normalizeCefr`。學測 GSAT 不進分析考試列（`isPlacementBaselineInstrument`）。全形／半形學號在寫入前合併，留下考試數與時數較高者，ASCII 學號略優先（`collapseWidthDuplicateStudents`） |
| Population | `resolveRebuildStudentIds`：有嘗試、有活動、有選課或有預約的人。不是「該學期名冊」 |
| Inclusion Rules | 事件 `excludeFlag` 與 `VOID` 可排除。考試列要有技能且非學測 |
| Exclusion Rules | 見 `isIncludedEvent`。無日期的非 BESTEP 在 14 日窗裡距離為無窮，無法與其他日合併（Phase 1 已讀 `daysBetween`） |
| Time Boundary | 重建當下 `cutoffAt` 預設 `new Date()`，寫進 `derivedAt` 與版本字串。**不是**「只納入此日前的來源列」的 SQL 過濾：本次讀到 cutoff 用來命名版本與 `derivedAt`，沒有看到來源查詢 `WHERE eventDate <= cutoff`。狀態：PARTIALLY_VERIFIED。若沒有來源過濾，cutoff 只是產生時間 |
| Attempt Selection | 同一工具：BESTEP 同學期合成一梯，其他工具 14 日內合成一梯。前後測是梯次順序，不是行政學期。第一梯＝前測語意由 `resolveTestPhase` 決定。PARTIALLY_VERIFIED 該函式全文，窗規則已在 `examSessionService.js` 6–79 行 |
| Aggregation | 學生列一人一版。考試列一人×工具×梯×技能。`isB2plus` 為該格 rank ≥ 4 |
| Metric Formula | 各頁再聚合快照，不在重建時算出 KPI。接近 B2 在讀取時用 GSE 51–58（`b1PlusWatch.js`） |
| Missing Data | 只有一梯則沒有 delta。缺原始分則不計 improved |
| API Consumers | `/overview`、`/student-explorer`、`/b1-plus`、`/cohorts`、`/skills`、`/resources`、`/offerings`、`/raw-data` |
| UI Consumers | `/admin/learning-analytics/*` 除 KPI 報表主要走 S6 |
| Evidence | `analyticRebuildService.js` 98–195、343–347 行；`eventProjectorService.js` 230–279、647–660 行；`analyticRebuildJobService.scheduleGlobalAnalyticsRebuild` |
| Verification Status | VERIFIED（來源表與雙軌考試）；cutoff 是否過濾來源 PARTIALLY_VERIFIED |

觸發：培力成績匯入後非同步 sync＋重建（`bestepImportController.js` 10–28 行）。選課匯入也會重建（`courseRecordService.js`）。手動 API 另有。不是資料庫觸發器。

---

## 不在七套裡、但已確認的管線

| ID | 結論 | 狀態 |
|---|---|---|
| 微學習 | `MicroLearningEngagementPanel` 呼叫 `getMicroLearningEngagement(..., { days: 30 })`，底層 `LearningTraceEvent`。不進 `lj_student_events` | VERIFIED |
| 問卷完成 | 進 S1-B context 的 `surveyCompletedSet`。不進快照投影 | VERIFIED（投影檔無問卷）；問卷分析頁本身的圖 PARTIALLY_VERIFIED |
| 週報互動 | 獨立 `weekly-reports/:id/analytics`。不在投影來源 | VERIFIED 不進快照；指標公式 UNVERIFIED |
| ET 分組 | `et_event_group_assignments.gse_snapshot` 由 `etGseSnapshotService` 從分析學生重算。腳本註解寫 CAPS 已遷到 GSE。分組頁不是快照重建的輸入 | VERIFIED 腳本用途；頁面公式 PARTIALLY_VERIFIED |
| 口說診斷 | 投影與本次服務搜尋未看到進入 `lj_student_events`。是否有獨立統計頁：UNVERIFIED（未打開口說路由） | UNVERIFIED 作為成效指標；VERIFIED 不是快照輸入 |
| `englishTestsRouter` | 未掛載、無其他 require。`rebuildSemesterBestSkills` 仍被 v3 重建流程呼叫 | VERIFIED |

## 培力 Excel 與 `EtExamAttempt`（專項）

```text
Excel
  → bestepImportService.importScoreData
  → bestep_exam_scores（等級已正規化，passed 已寫入）
  → setImmediate runSync bestep_scores
  → exam_attempts + exam_attempt_skill_scores（dedupe_key，sourceRef bestep_exam_scores:id）
  → scheduleGlobalAnalyticsRebuild
  → projectExamEvents 讀 exam_attempts
  → 若同鍵已有 et_exam_attempts，丟棄這筆 BESTEP 同步列

平行、不自動發生：
  learning journey / englishTestTracking 匯入 → et_exam_attempts
  → KPI、歷史最佳、以及快照裡優先保留的那一筆
```

因此：班級頁在匯入當下就看得到成績。KPI 只有在另一次寫入 `et_exam_attempts` 時才看得到同一筆。快照看得到同步列，除非被 et 列擠掉。這不是推測，是兩支寫入函式的目標模型不同（`ExamAttempt.create` 對上 `EtExamAttempt.findAll`）。`DATA_VALIDATION_REQUIRED` 的只是正式庫兩表重疊多少。
