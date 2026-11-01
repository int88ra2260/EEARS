# 04 時間語意契約

一個指標只能掛一個主契約。比較之前先看 Comparison Eligibility，不要先把軸都叫學期。

## 策略何時可用

| 策略 | 適用 | 不適用 |
|---|---|---|
| Event-based | 預約、簽到、違規。時間是活動日 | 名冊達標、培力檔案學期 |
| Exam-session-based | 同工具前後梯、同日成對 | 沒有考試日的列；跨工具加總 |
| Semester-based（日期區間） | 活動供給與簽到，且使用同一套日期解析 | 英檢嘗試、培力成績列 |
| Semester-based（檔案標籤） | 某次匯入指定的培力學期 | 活動日、終身嘗試 |
| Cohort-based | 名冊是誰。只定義人，不定義成績發生何時 | 單獨當作考試時間 |
| As-of snapshot | 快照版本上的描述統計 | 把它當成「該學期結束時的官方達標」 |
| Longitudinal | 同人、同工具、兩梯都有分 | 歷史最佳、單次培力、缺第二梯的人 |
| Pre/Post window | 上一梯結束到本次考試之間的時數 | 全學期參與、沒有前一梯的人 |

## TC-OPS-DATE-SEMESTER

- Analysis Unit: 預約列、活動
- Cohort Time: NOT_APPLICABLE
- Event Time: `events.date` CAST 成日期
- Assessment / Import / Baseline / Follow-up: NOT_APPLICABLE
- Reporting Period: `SEMESTER_RANGES` 的 start、end
- As-of Date: 查詢當下；另有 5 分鐘記憶體快取（`OVERVIEW_CACHE_TTL_MS`）
- Observation Window: 該學期日期區間
- Data Version: 無
- Late-arriving Data: 活動日改了會改屬於哪個學期。快取最多晚 5 分鐘
- Historical Recalculation: 每次查詢重算，不凍結
- Comparison Eligibility: 兩個學期都用同一 CAST 規則才可並排。不可與名冊達標並排
- Metrics: `ops.event.count`、`ops.reservation.row_count`、`ops.reservation.checkin_row_*`、`ops.capacity.reservation_over_seats`

## TC-OPS-DATE-STRING

- Analysis Unit: 名單上的學生
- Event Time: `e.date BETWEEN` 字串，無 CAST
- 其餘觀察窗同日期學期的意圖，但實作不同
- Comparison Eligibility: 與 TC-OPS-DATE-SEMESTER 的人數不必相同。尾碼帶時間的 `events.date` 可能一邊算進去、另一邊沒有
- Metrics: `ops.roster.distinct_checkin_students`、`ops.roster.distinct_checkin_rate`、`ops.roster.avg_checkin_count`
- Evidence: `kpiService.js` 240–241 行 vs `analyticsService.js` 24–26 行。VERIFIED

## TC-BESTEP-FILE-SEMESTER

- Analysis Unit: 學生 × 匯入時指定的學期字串
- Cohort Time: 班級學期或報名學期，呼叫端傳入，不從考試日推
- Event Time: 出席列有 `examDate`，通過率不用它
- Assessment Time: 成績列沒有獨立「這一場」必填日。sync 時 `resolveBestepExamDate` 才設法填 `exam_attempts.examDate`。該函式本體未讀完：PARTIALLY_VERIFIED
- Import Time: `importedAt`
- Reporting Period: 檔案學期標籤
- As-of Date: 讀取當下的成績表
- Observation Window: NOT_APPLICABLE
- Data Version: 無版本號。後匯入覆蓋同鍵時，舊結果不保留
- Late-arriving Data: 會改當下頁面。不會留下「匯入前的班級通過率」
- Historical Recalculation: 不凍結
- Comparison Eligibility: 兩學期可並排，僅當匯入欄位與 `isPassed` 規則未改，且接受加號已摺疊
- Metrics: `bestep.file.*`、`ops.roster.bestep_pass_over_attendance`、`partner.score_gap`（差距用同一成績列）

## TC-ROSTER-LIFETIME-DEFAULT

- Analysis Unit: 名冊學生
- Cohort Time: `et_enrollment_snapshots.semesterId`
- Event Time: NOT_APPLICABLE
- Assessment Time: `et_exam_attempts.testDate`／`examDate`。預設政策不拿它來排除
- Import Time: 嘗試列若有匯入時間，KPI 不用
- Reporting Period: 使用者選的名冊學期。不是成績的報告期
- As-of Date: 查詢當下的嘗試表
- Observation Window: 預設無界。可選日期窗或學年 8/1–7/31，與 `SEMESTER_RANGES` 不是同一把尺
- Baseline / Follow-up: NOT_APPLICABLE（這不是成長）
- Data Version: 政策 `kpi-policy.v1` 與政策鍵
- Late-arriving Data: 新的 valid 嘗試會讓舊名冊的通過人數變多
- Historical Recalculation: 不凍結。無法重現「去年發布當天」的率，除非當時有匯出
- Comparison Eligibility: 跨學期並排只在「終身累積、分母換名冊」的意義下成立。不可說成各學期考試成果
- Metrics: `roster.pair_pass.listening_reading`、`roster.pair_pass.speaking_writing`

## TC-ROSTER-BEST-ASOF-NOW

- Analysis Unit: 名冊學生 × 技能
- Cohort Time: 名冊學期
- Assessment Time: 各技能最佳那一筆的日期（Map 版報告甚至不回傳日期）
- As-of Date: 查詢當下。沒有參數可問「截至 114-1 結束」
- Late-arriving / Recalculation: 較高 rank 會改寫任何過去名冊的率
- Comparison Eligibility: 不建議把歷年這張表當成趨勢
- Metrics: `roster.best_skill_rank_b2`、`roster.best_skill_state`
- 同一學生四技能可以來自四次考試、四種工具。VERIFIED（迴圈不要求同一 attempt）

## TC-EXAM-SESSION

- Analysis Unit: 學生 × 工具 × 梯 × 技能
- Assessment Time: 梯的起迄日
- Observation Window: BESTEP＝考試日所屬日期學期；其他＝14 日
- Baseline Time: 前一梯
- Follow-up Time: 後一梯
- Comparison Eligibility: 只比較同一工具的相鄰梯。GSAT 不在此契約
- Metrics: `snapshot.gse_raw_delta` 的時間部分（數值在快照列上，所以還受 TC-SNAPSHOT-VERSION 約束）

## TC-EXPOSURE-BEFORE-EXAM

- Analysis Unit: 一次考試格
- Event Time: 課程／活動事件日
- Assessment Time: 該格 `eventDate`
- Observation Window: 上一梯 `sessionEnd` 到本次考試日。沒有上一梯時起點為 null
- Comparison Eligibility: 可描述「這次考試前窗裡有多少時數」。不可與全學期簽到率相減
- Metrics: `snapshot.skill_exposure`

## TC-SNAPSHOT-VERSION

- Analysis Unit: 快照列
- Cohort Time: 快照裡的入學／年級欄，不是篩選用的行政學期（總覽已拿掉學期篩選）
- Data Version: `snapshot_version` 字串含日期、`rules:lj-analytics-2026-v1`、程式 build
- As-of Date: 版本字串裡的日期是 `cutoffAt`，預設為重建開始的現在。是否等於來源資料截止：見 `05`，目前不能假定
- Generated At: `derivedAt`
- Late-arriving Data: 來源更新後，頁面不變，直到下一次重建成功
- Historical Recalculation: 新版本是新字串。舊版本列是否保留：PARTIALLY_VERIFIED（重建是寫入新 version 還是覆蓋，未讀完 delete/insert）
- Comparison Eligibility: 同一 version 內可比系所。不同 version 只有在規則段相同時才可比較覆蓋率
- Metrics: `snapshot.exam_cell_rank_b2`、`snapshot.near_b2_gse`、`snapshot.evidence_quality`、`snapshot.gse_adjusted_delta`、`snapshot.growth_episode`、`snapshot.resource_effect`

## TC-TRACE-ROLLING-30D

- Analysis Unit: 微學習事件
- Observation Window: 請求當下往回 30 日（前端寫死）
- As-of Date: 請求當下
- Comparison Eligibility: 與學期活動、與快照時數都不可直接比
- Metrics: `trace.micro_learning.30d`

## 必須分開的問題（對照證據）

| 問題 | 答案 | 狀態 |
|---|---|---|
| 學期日期與測驗梯次相同嗎 | 否。日期學期是活動。BESTEP 梯次用考試日推學期。KPI 預設不用學期切嘗試 | VERIFIED |
| 名冊學期與成績發生時間相同嗎 | 只在分母相同。分子預設不相同 | VERIFIED |
| 匯入時間會被當成測驗時間嗎 | 班級通過率不用 `importedAt`。sync 的 `examDate` 若推不出真實考試日，可能用替代日。替代規則未讀完 | PARTIALLY_VERIFIED |
| 歷史最佳會改寫過去成效嗎 | 會，因為沒有 as-of 參數 | VERIFIED |
| 不同技能來自不同考次嗎 | S5 與 KPI `cross_date` 會。預設 KPI 政策是 same_date，同一對必須同日，但聽讀對與說寫對仍可不同日 | VERIFIED |
| 參與與測驗有先後嗎 | 快照考試列有考前時數。活動總覽與培力檔沒有這條邊。沒有全系統「只算考前」 | VERIFIED |
| 快照時間是統計截止嗎 | 版本字串有日期。來源查詢未看到 `<= cutoff` | PARTIALLY_VERIFIED |
| 能重現歷史報表嗎 | 活動與培力檔每次重算、不凍結。KPI 與歷史最佳會被晚到資料改寫。快照若保留舊 version 才可能重現快照頁 | VERIFIED 前兩句；快照保留 PARTIALLY_VERIFIED |

## 參與與測驗的先後

可驗證的先後只存在於已投影的考試列：`exposureWindowStart`、`activityHoursBeforeExam`。條件是事件先進 `lj_student_events`，且重建已跑完。預約總覽的簽到沒有接到某一次 `testDate`。所以「先參加活動再考試」不能從營運頁推出，只能從快照考試列的窗欄位描述，而且窗的定義是上一梯到這次考試，不是「所有考前活動」。
