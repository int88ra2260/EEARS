# Fail-open 邊界

Shadow 只包住 commit 成功之後的那一段。Parse、報名查詢、upsert、commit、rollback 仍在原來的 try/catch。業務錯誤繼續 throw，或沿用列內的 `PROCESSING_ERROR`。

| 階段 | 失敗時 |
|---|---|
| Flag | 讀取失敗視為關閉，回傳 null |
| Snapshot | `executionStage=snapshot`，code `SHADOW_INTERNAL_ERROR` |
| Input mapping | `executionStage=input_mapping`，同一個固定 code |
| Validator | `executionStage=validator` |
| Sanitizer | `executionStage=sanitizer` |
| Logger | 吃掉 logger 的 throw。成功診斷仍回傳；匯入結果不改 |
| Thenable | 加上空的 rejection handler，診斷 code 為 `SHADOW_ASYNC_NOT_SUPPORTED`。現役 validator 仍是同步函式 |

診斷與 log 都不收 `Error.message` 或 stack。Logger 只收到診斷物件，不收到 exception。

Commit 失敗會 rollback 並 throw，不會呼叫 observe，也不會留下 committed 診斷。
