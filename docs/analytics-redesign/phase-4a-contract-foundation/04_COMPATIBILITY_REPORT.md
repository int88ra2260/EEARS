# 相容性

本階段只新增檔案。沒有修改既有統計、路由、模型、migration、匯入、快照或前端。

| 檢查 | 結果 |
|---|---|
| 既有統計 SQL | 未改 |
| KPI、B2、成長、出席函式 | 未改 |
| API response shape | 未改。沒有新路由 |
| `server.js` 掛載 | 未改。啟動不會載入 `analytics-contracts` |
| 資料庫 schema | 未改。沒有 migration |
| 匯入與快照流程 | 未改。登錄不會寫入、不會排程 |
| 前端頁面與導覽 | 未改 |
| 資料庫連線 | 契約測試與登錄載入不需要 |
| 既有分析公式 | 未為了新測試而改 |

`calculationReference` 只存路徑字串。驗證器不 `require` 那些服務。

回歸：`tests/surveyAnswerKeyRegistry.test.js` 與新測試一起通過（15 tests）。沒有把全後端 Jest 當成本階段的相容性證明，也沒有修改其他模組來讓測試變綠。
