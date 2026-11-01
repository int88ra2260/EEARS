# Phase 4C.1 實作摘要

本階段只強化 `reservation-backend/analytics-contracts/` 與其測試、以及本目錄文件。沒有改 KPI、B2、SQL、匯入、Learning Journey、快照、API、資料庫或前端，也沒有把契約接到 `server.js`。

## 做了什麼

- `compareAssessmentObservations()` 改由同一套判斷產生。先決定來源身分，再決定成績內容是否一致，最後才映射舊的 `relationship`。
- 新增 `compareAssessmentObservationsDetailed()`。舊函式回傳仍含 `relationship`、`reasons`、`conflicts`，並附上 `identity`、`consistency`、`duplicateAssessment`。
- 來源身分加上 `recordNamespace`（資料表加主鍵）。沒有呼叫端提供的版本時，`sourceRecordVersion` 為 `unknown`。
- `1970-01-01` 只在 `exam_attempts` 已確認指向 `bestep_exam_scores` 時視為同步哨兵。
- `et_exam_attempts` 的 `testDate` 與 `examDate` 不一致時，兩欄都保留，不選一個當正式測驗日期。

## 驗證

- ESLint：`npx eslint analytics-contracts tests/analytics-contracts` 通過。
- Jest：`npm test -- --runInBand tests/analytics-contracts` 為 12 suites、97 tests，全部通過。
- 其中 H01–H20 在 `tests/analytics-contracts/assessmentContractHardening.test.js`。
- 沒有連線資料庫，沒有執行 migration，沒有 commit。

## 維持不變

32 個 Metric ID、9 個 Temporal Contract、7 個 Domain、D1–D11 皆為 pending、2 個未實作指標、`officialUseAllowed=false`、`causalClaimAllowed=false`。
