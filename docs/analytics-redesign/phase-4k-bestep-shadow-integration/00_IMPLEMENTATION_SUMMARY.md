# Phase 4K 實作摘要

Pilot 仍是 `bestep-file-quality`。本階段把 Phase 4J 的離線 validator 接到現役成績匯入的記憶體資料，預設不執行。

已完成：

- Feature flag `BESTEP_FILE_QUALITY_SHADOW_ENABLED`。只有字串 `true`，且 `NODE_ENV` 是 `test`、`development` 或 `staging` 才會跑。`production` 不跑。
- Hook 在 `importScoreData` 的 transaction commit 成功之後、回傳之前。
- 診斷只含 finding code、計數與截斷範圍。不進 HTTP JSON，不寫資料庫，不寫 log，除非另開 `BESTEP_FILE_QUALITY_SHADOW_LOG=true`。
- 掃描上限 200 列，方法是原始列的 `first_n`。
- 合成測試覆蓋 flag、回應不變、寫入與查詢次數不變、截斷、個資與失敗隔離。

未完成：

- 沒有管理員頁、沒有新 API、沒有 L3。
- 出席、投影、存量與匯入歷史在這次匯入記憶體裡不存在，診斷維持 `not_observed`。
- 正式部署設定沒有打開 flag。
