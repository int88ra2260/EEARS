# 跨領域契約稽核

檢查命令（只讀載入，未改檔）：

```text
node -e 載入 analytics-contracts，印出數量與旗標
```

結果：metrics 32、domains 7、temporal 9、重複 ID 0、`officialUseAllowed` 0、`causalClaimAllowed` 0。D1–D11 皆 `pending`。未實作：`ops.participation.streak`、`roster.pair_pass.both_pairs`。

本階段沒有新增 Metric ID，沒有改公式，沒有改學期區間，沒有決定 BESTEP 日期優先順序。

## Metric

活動營運的預約列、簽到列與名冊人數使用不同 ID（`ops.reservation.row_count`、`ops.reservation.checkin_row_count`、`ops.roster.distinct_checkin_students`）。沒有把預約列數當成不重複學生。

`ops.registration.legacy_has_cefr_b2` 對應頁面上的 `englishPassRate`。Phase 4G 文案把它放在報名補充區。它不是活動後的英語能力。

BESTEP 檔案四技能分數、等級、單科達 B2、四科 CEFR B2 是不同 ID。班級 `passRate` 在 4L 對應到 `bestep.file.four_skill_cefr_b2` 的 mapped 欄位，但班級分母是本國生且報名成功，與檔案列母體不同。這是已知 mapping gap，不是新的強制改名。`PROPOSED:bestep.class.*` 不在 32 個正式 ID 裡，不能升成官方指標。

`ops.roster.bestep_pass_over_attendance` 是另一個母體，不能拿來取代班級 `passRate`。

## Temporal

9 個契約仍在 registry。學期邊界來自既有學期設定，半開區間與 `Asia/Taipei` 沒有在本階段改寫。

必須分開的日期：

- 活動列用活動日。
- 報名 B2 標記用報名學期標籤，沒有和預約列 JOIN。
- BESTEP 成績檔的學期是檔案學期；匯入把 `examDate` 寫成 null。
- 出席日是出席匯入自己的日期。
- `exam_attempts.examDate` 可能來自同步推斷，確認投影上的 `1970-01-01` 是哨兵，不是考試日。
- 查詢參數裡的學期是 query echo，不是資料列的日期。

DG-BESTEP-01 與 DG-BESTEP-04 仍待決定。本稽核沒有把檔案學期填成考試日。

## Assessment Source

三個來源維持分開：`bestep_exam_scores`、`exam_attempts`、`et_exam_attempts`。

- 一列成績拆成四個技能觀察，不是四次考試，也不是四個學生。
- 相同學號、日期、技能、分數不能證明同一個來源。
- 確認投影與內容衝突要分開記錄。
- B2+ 存成 B2 是既有正規化，不能從 B2 還原加號。
- 成績匯入覆寫走既有 upsert；本階段沒有去重。
- 班級總覽不讀 `exam_attempts` 或 `et_exam_attempts`。KPI 讀的是 `et_exam_attempts`。
- D11 維持 pending。沒有把三個來源合成一次實測。

## Quality

檔案品質契約在 `analytics-contracts`，由匯入 Shadow 在旗標開啟時呼叫。它不改變匯入結果。`SOURCE_INFORMATION_LOSS` 在 Shadow 診斷裡降級，不阻擋匯入。`validatedRowCount` 保持 null。列數上限 200，超出截斷。
