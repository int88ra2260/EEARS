# Phase 4J 實作摘要

Pilot id：`bestep-file-quality`。

本階段新增離線純函式 `evaluateBestepFileQuality`。它只讀呼叫端已經放進輸入的列，回傳檔案品質報告。沒有接到 BESTEP 報名、出席匯入、成績匯入、同步、`lj:promote-bestep`、KPI、學習歷程或前端。

## 已完成

- 輸入契約區分 raw、accepted、skipped、current records、attendance、registration population、projection、import history。
- 未提供的集合是 `not_observed`，計數是 `null`。空陣列才是已觀察到的 0。
- 六個品質面向與穩定 finding code。
- 技能與日期沿用 `interpretScore`、`interpretCefr`、`interpretAssessmentDate`。
- 投影沿用 `adaptExamAttempt`、`adaptEtExamAttempt` 與 `compareAssessmentObservationsDetailed`。
- 合成測試 J01–J35，加上既有 registry 回歸。
- `officialUseAllowed`、`causalClaimAllowed`、`sourcePriorityApplied`、`mergePerformed` 固定為 false。

## 未完成

- 沒有正式 hook。
- 沒有 L3，沒有真實覆蓋率。
- 沒有還原歷次重匯內容。
- 沒有把 `B2+` 還原到已儲存的 B2。
- 沒有新增 metric id 或 temporal contract id。
