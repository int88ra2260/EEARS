# Phase 4C 實作摘要

狀態：來源身分與觀測物件已可離線建立。它辨識衝突，不合併成績，也不決定誰優先。

## 完成範圍

在 `reservation-backend/analytics-contracts/` 新增：

- 三個來源的靜態說明
- Assessment Observation
- `adaptBestepScore`、`adaptExamAttempt`、`adaptEtExamAttempt`
- `compareAssessmentObservations`
- 十二種品質標記，沒有總分

沒有新資料表、沒有路由、沒有把 adapter 掛進匯入或快照。

Phase 4A／4B 的 32 個 Metric、9 個時間契約、11 個 pending 決策門維持原狀。`officialUseAllowed` 與 `causalClaimAllowed` 仍是 false。

## 限制

- Adapter 不查資料庫，也不重跑 `resolveBestepExamDate`。
- 只有 `sourceRef` 或 `rawPayload.bestepExamScoreId` 對得上，才是 confirmed projection。
- 相似的學生、日期、工具、技能最多是 `possible_duplicate`。
- 沒有跨工具換算。`normalizedScore` 固定是 null。
- 資料庫裡已經去掉加號的 B2，不會被還原成 B2+。
- 只有學期時，考試日保持 null。沒有呼叫 Temporal Builder 去補日期。

## 基準

Phase 4C 開始前，Phase 4A／4B 測試是 6 suite、45 tests 通過。完成後整個 `tests/analytics-contracts` 是 11 suite、77 tests 通過。沒有 commit。
