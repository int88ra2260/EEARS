# 03 時間模型

時間分成四類。查詢可以同時帶多個，但每個指標只允許自己的 Temporal Contract 所列出的那一種當**邊界**。其餘只能當標籤。

| 類別 | 維度 | 角色 |
|---|---|---|
| 來源資料上的事實 | Event Time（活動日）、Assessment Date（嘗試日或出席日）、Import Time、考試原始檔上的學期字串 | 存在列上。分析不得改寫 |
| 查詢參數 | Academic Semester（哪一把尺要先聲明）、Cohort（名冊或名單）、Exam Session（工具＋日期或檔案批次）、Baseline／Follow-up 梯次 | 呼叫端選擇。未聲明的參數不得默認成「學期」 |
| 截止與版本 | As-of Date、Reporting Period、Snapshot Generation Time、Published At、Data As Of | 正式發布才凍結。監測的 As-of 預設是查詢當下，且必須顯示 |
| 配對條件 | 同人、同工具、相鄰梯、考前窗起迄 | 只用於 DOM-LONG／EXPLORE。不能拿來定義達標 |

不得混用：

- 活動日的日期學期 ≠ 培力檔案學期 ≠ 名冊 `semesterId` ≠ KPI 終身窗 ≠ 快照版本日。
- Import Time 不得填進 Assessment Date。培力 sync 若用替代日，該列的 Assessment Date 品質是 `imputed`，在 D11 之前不拿來對 et 的考試日做自動合併。
- Snapshot Generation Time 不是 Data As Of（Phase 2：cutoff 沒過濾來源）。
- 歷史最佳的查詢當下不是 Reporting Period。

Query Context 是一次請求的信封，不是新的學期表。

```text
QueryContext
  usage: monitoring | official | exploratory
  populationRef
  temporalContractId
  bound: { semesterRange | fileSemester | rosterSemester | asOf | session | snapshotVersion }
  comparison: null | { baseline, followUp, instrument }
  scope: { permission, workingSet }
```

指標若收到不屬於自己契約的 bound，拒絕計算。

## Scenario 1 — 114-2 的活動、預約、出席

- Query Context: `usage=monitoring`，契約 `TC-OPS-DATE-SEMESTER`，bound 為 `SEMESTER_RANGES['114-2']`。
- Population: 活動日可 CAST 且落在區間的 `events` 與 join 到的預約列。不是名冊。
- Time Boundary: Event Time。不用考試日。
- Source: `events`、`reservations`。
- Metric Contract: `ops.event.count`、`ops.reservation.row_count`、`ops.reservation.checkin_row_count`、`ops.reservation.checkin_row_rate`、`ops.capacity.reservation_over_seats`。
- Result Metadata: 區間起迄、是否含未分類的預約狀態（現況是含）、快取若仍為 5 分鐘要寫 `cache: true`。
- Data Quality: 不與 DOM-PART 的名單參與率畫在同一序列。若要「多少學生」，改問 Scenario 的參與變體，契約換成 `TC-OPS-DATE-STRING`，並標明與 CAST 可能不一致。

## Scenario 2 — 114-2 某一次培力的出席與四項達標

現況沒有「這一場」的已上線達標率（Phase 2）。本情境是目標查詢，**出席日篩選若要當正式分母，等 D4／D6**。在那之前，安全查詢是檔案學期，不是自作主張的場次率。

- Query Context: `usage=monitoring`。`fileSemester=114-2`。若使用者另給 `assessmentDate`，只過濾出席列的顯示，不把 `bestep.file.four_skill_cefr_b2` 改成「當日到考者為分母」，除非 D4 核准場次母體。
- Population: 成績側是該學期 `bestep_exam_scores` 與班級或報名成功的人（沿用 S2 的 registeredCount，不在本設計改定義）。出席側沿用現有欄位。行政平均率仍只認 LR／SW，必須在 metadata 寫 `attendanceCode: LR_SW_ONLY`。
- Time Boundary: 檔案學期標籤為主。Assessment Date 僅在出席列存在時作可選篩選。
- Source: `bestep_exam_scores`、`bestep_attendance`。不讀 et，避免把另一軌混進這一檔。
- Metric Contract: `bestep.file.attendance` 的現有 ID `bestep.file.attendance_lr_sw_avg` 只覆蓋行政平均。分項出席若畫面要顯示，標成同一來源的明細，不新造一個已上線的「四項都到」率（Phase 2 標缺口）。四項等級用 `bestep.file.four_skill_cefr_b2`。`official: false`。
- Result Metadata: `plusCollapsed: true`，`missingLevelCountsAsFail: true`。
- Data Quality: 不得與 `roster.pair_pass.*` 對帳。不得把率叫成 B2+。

## Scenario 3 — 114-2 名冊截至指定日的累積能力狀態

- Query Context: `usage=exploratory` 或監測上的狀態，**不是 official**。`rosterSemester=114-2`，`asOf=指定日`。
- Population: 該學期 `isActive` 名冊。工作集與權限寫進 scope。
- Time Boundary: 分母是名冊。分子若沿用今天的程式，是查詢當下的全部 valid et，**還沒有 as-of 參數**。目標設計是 `testDate <= asOf` 且 `status=valid`。在程式學會 as-of 之前，API 若被要求指定日，應回 `not_supported`，而不是偷偷用今天的最佳冒充該日。
- Source: `et_exam_attempts` only。
- Metric Contract: `roster.best_skill_state`、`roster.best_skill_rank_b2`。
- Result Metadata: `asOf`、`crossInstrument: true`、`rewritesWhenNewerScoresArrive: true`（若仍是現況）、`official: false`。
- Data Quality: 四技能可來自不同考次。禁止與 Scenario 2 的四項達標並列成「同一個 B2」。

截至日是目標能力。現況做不到時，誠實回傳不支援，是這個情境的驗收條件之一。

## Scenario 4 — 同一學生兩次可比測驗

- Query Context: `usage=exploratory`。`instrument` 必填。`comparison.baseline` 與 `followUp` 是相鄰梯，不是兩個行政學期。
- Population: 該生在快照中、該工具至少兩梯、兩邊原始分可用。否則結果是 `ineligible`，不是成長 0。
- Time Boundary: `TC-EXAM-SESSION`。BESTEP 同學期分日可成一梯；其他工具 14 日。GSAT 拒絕當前測。
- Source: `lj_analytic_exams`。要檢查 snapshot version 與來源延遲。
- Metric Contract: `snapshot.gse_raw_delta`。校正值另要 `snapshot.gse_adjusted_delta`，且 claimCeiling 是 adjusted。
- Result Metadata: 兩梯起迄、工具、是否 GSE 鈍化、排除原因。
- Data Quality: 不可改問歷史最佳的差。不可跨工具相減原始分。

## Scenario 5 — 發布 114-2 正式成果，之後匯入不得改寫

- Query Context: `usage=official`。在 D1 未核准時，這個情境**不能選擇達標指標**。系統只允許發布已核准的 Metric ID。安全的先行範例是營運附錄（Scenario 1 的五個 ID），達標槽保持未發布。
- Population: 發布當下的 Population Manifest（名冊 id 清單的雜湊、或活動區間）。
- Time Boundary: Data As Of 由核准人指定。若來源沒有歷史列，Data As Of 只能標成「發布當下的表狀態」，再現性是 Frozen 而不是 Reproducible（`05`）。
- Source: Source Manifest：表名、列數、最大 `importedAt` 或最大活動日。不複製全庫，除非日後另決。
- Metric Contract: 只有 registry 裡 `officialEligible` 且決策狀態 Approved 的 ID。達標 ID 現在都不是。
- Result Metadata: `publicationStatus=published`、`publishedAt`、`metricVersion`、`policyKey` 若適用、`frozen: true`。
- Data Quality: 其後的匯入只影響 monitoring。讀 published id 永遠回凍結值。要更正就新建 version，不覆蓋。

五個情境共用 Query Context，不共用一個 semester 參數的意義。Scenario 5 在達標上被 D1 擋住，這是故意的。
