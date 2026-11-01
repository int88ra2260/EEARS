# 指標語意

粒度不能混用：報名列、不重複學生、到考項目、成績列、四個技能 observation。一列成績拆成四個 observation，不是四次考試，也不是四位學生。

既有 metric id 來自 `metricRegistry.js`。沒有 id 的候選維持未實作，本階段不新建 id。

## 營運

### Exam Sessions

- Business Question：這個檔案學期有幾次實體梯次。
- Analysis Unit：學期一列的 `bestep_exam_sessions`。
- 現況：匯入不寫此表。沒有名額欄。沒有 metric id。
- Implementation Status：未作為分析入口。
- Business Decision Needed：場次是否等於檔案學期，還是 LR 日與 SW 日各算一場。

### Registration Rows

- Business Question：報名表有幾列。
- Numerator：`english_test_registrations` 列數。
- Population：管理端篩選下的列。唯一索引是學號加學期，但抵免程式仍防一人多列。
- Time Field：`semester`；空白時 `inferRegistrationSemester` 可用 `createdAt`。
- Existing Metric ID：無。`stats/analytics` 是系所與年級分組，不是報名筆數契約。
- Known Limitations：管理端刪除會讓列消失。`success` 以外的列不能拿來匯入出席或成績。

### Unique Registrants

- Business Question：有幾位學生有報名。
- Analysis Unit：學號。
- 班級統計的 `registeredCount` 不是全中心不重複人數。它只數班級裡本國生、且 `isSuccessfulBestepRegistration` 為真的人。證據：`computeClassBestepExportSummary`。
- 報名列數與這個人數不是同一個數。

### Attendance Rows / No-show

- Attendance Rows：`bestep_attendance` 一列是學號乘學期乘 examType。
- No-show：`attended===false`。沒有列是 `null`，班級匯出留白，不計入已出席，也不標成缺席。
- 班級到考率分母是報名成功者的應考項目數，不是出席表列數。`attendanceRate = attendedSlots / totalRegistrationExamSlots`。
- Existing Metric ID：`ops.roster.bestep_pass_over_attendance` 是另一個通過與出席的組合，不是本段的項目到考率。使用前仍受該 metric 自己的限制。

### Session Capacity Utilization

- 程式沒有場次名額欄，也沒有使用率計算。
- Implementation Status：未實作。
- Business Decision Needed：名額若存在於報名流程之外，本系統目前沒有對應欄位。

## 表現

### Valid Score Records

- Metric Name：培力成績檔列。
- Business Question：這個檔案學期有幾列已寫入的成績。
- Analysis Unit：學號乘檔案學期。
- Population：匯入時找得到 success 報名的列。跳過列不在表內。
- Source：`bestep_exam_scores`。
- Time：`TC-BESTEP-FILE-SEMESTER`。`examDate` 在匯入時為 null。
- Existing Metric ID：沒有列數 id。最接近的是 `bestep.file.skill_score`。
- Evidence Quality：匯入程式可讀；正式列數未做 L3。
- Known Limitations：重匯覆蓋。四科可部分為 null，但 `passed` 在不滿四科時為 false。

### Score Import Coverage

- Business Question：success 報名裡有多少人有成績列，以及四科是否齊。
- Numerator：有成績列的學號，或四個等級都非 null 的列。
- Denominator：若用 success 報名，必須先決定是否含只報 LR 的人。
- Implementation Status：匯入回應有 `imported` 與 `skipped`，沒有持久的覆蓋率 API。
- Business Decision Needed：分母用報名成功人數，還是用該次檔案裡的列。

### CEFR Distribution / Skill Score Distribution

- 等級來自已折疊的欄位。`bestep.file.skill_level`。
- 分數是 `bestep.file.skill_score`，單位是技能 observation。
- 未掛載的 `englishTestsRouter` 有 CEFR 分布路由，不是現役入口。
- 不可把不同工具原始分放在一起比。

### B2 Skill Attainment

- `bestep.file.skill_reached_b2` 是單科是否達折疊後的 B2。decision gate D1。沒有獨立單科達標率 API。
- `bestep.file.four_skill_cefr_b2` 對應 `isPassed`：四科都存在且都達 B2 基底。班級 `passRate` 用 `passedCount / registeredCount`。
- `hasCEFRB2` 是報名表自填標記，metric id `ops.registration.legacy_has_cefr_b2`。它不是這次測驗的四科結果。
- `officialUseAllowed=false`。

## 長期成果（只標來源，不進入試點）

### Best Historical Result

- 讀 `et_exam_attempts`，日期用 `testDate || examDate`。契約 `TC-ROSTER-BEST-ASOF-NOW` 寫明技能可以來自不同考次。
- metric：`roster.best_skill_rank_b2`、`roster.best_skill_state`。
- 限制：不是單次 BESTEP。KPI 不讀 `exam_attempts`。這是現況，不是優先權決定。

### Cross-attempt Growth

- 快照 GSE 差：`snapshot.gse_raw_delta`、`snapshot.gse_adjusted_delta`。
- 契約限制寫明不可把這個差說成中心活動造成。`causalClaimAllowed=false`。
