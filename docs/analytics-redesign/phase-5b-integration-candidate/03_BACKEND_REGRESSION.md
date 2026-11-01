# 後端回歸（Node 20）

工作目錄：`D:/EEARS-phase5b/reservation-backend`。

- Node：v20.20.2
- npm：10.8.2
- 命令：`npm test -- --runInBand` 加上 `tests/analytics-contracts`、`tests/bestepClassPassRateDecision.test.js`、`tests/bestepClassExport.test.js`、`tests/bestepClassAnalyticsShadow.test.js`、`tests/bestepClassOverviewShadow.controller.test.js`、`tests/bestepAttendanceImport.test.js`、`tests/bestepScoreImportShadow.test.js`、`tests/bestepScoreImportControllerShadow.test.js`、`tests/bestepScoreImportFormat.test.js`、`tests/analyticsOverviewShadow.test.js`
- Suites：26 passed，26 total
- Tests：256 passed，256 total
- Failed：0
- Skipped：0
- 時間：16.149 s
- exit：0

這包涵蓋契約（含時間與評量來源）、活動營運 Shadow、BESTEP 檔案品質與匯入 Shadow、班級契約與 Shadow、成績匯入、出席匯入、班級匯出、F-BESTEP-01 決策回歸。

警告：

- 檔案品質測試印出既有的截斷計時 JSON。
- Node 20 上 Jest 印出 `[JEST-01]`：測試之間 soft-delete 的 global 物件稍後被讀取。測試仍然通過。沒有為了消警告而改測試或正式程式。
- `npm ci` 的 audit 公告不是這次測試失敗。

同一顆 Node 載入 `analytics-contracts`：metrics 32、domains 7、temporal 9、重複 ID 空陣列、official 0、causal 0、D1–D11 皆 `pending`。未實作是 `ops.participation.streak` 與 `roster.pair_pass.both_pairs`。
