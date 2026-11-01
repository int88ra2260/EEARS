# Phase 4B 實作摘要

狀態：時間查詢上下文已可建立、驗證與拒絕。它不是查詢執行器。

## 完成範圍

沿用 Phase 4A 的 9 個 Temporal Contract ID 與 32 個 Metric ID。新增的程式都在 `reservation-backend/analytics-contracts/`，沒有第二套登錄。

- `buildTemporalContext` 檢查指標、契約、允許的組合與必要邊界。
- 日期只接受 `YYYY-MM-DD`，時間只接受帶時區的 ISO 8601，並改寫成 `Asia/Taipei`。
- 活動學期區間來自 `shared/semesterConfig.js`，含尾日被轉成半開區間。檔案學期與名冊學期不展開成考試日。
- `validateTemporalContext`、`evaluateTemporalCompatibility`、`toSafeQueryBoundaries`、`adaptLegacyTimeFields`。
- 比較結果只有 `compatible`、`incompatible`、`undetermined`、`unsupported`。時間相容的 `scope` 固定是 `temporal_only`。

## 限制

- 不連資料庫，不產生 SQL，不推 Sequelize 條件。
- 不補今天、不補目前學期、不用月曆規則填不在設定表裡的學期。
- 九個契約的 `asOfQuerySupported` 仍是 false。指定歷史截止日是 `unsupported` 或直接拒絕。
- `officialUseAllowed`、`causalClaimAllowed` 仍是 false。D1–D11 仍是 pending。兩個未實作指標沒有改狀態。
- 滾動 30 日除了 `rollingDays` 之外，還要求呼叫端給 `windowEnd`。Phase 4A 的契約文字是「請求當下往回」，這裡不把當下換成 `new Date()`。

## 分支

工作分支是 `analytics/phase-4b-temporal-context`，HEAD 仍是 `1f41dd5`。沒有 commit。
