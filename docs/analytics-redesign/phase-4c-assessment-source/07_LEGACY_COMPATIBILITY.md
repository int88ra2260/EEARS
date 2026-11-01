# 與既有分析的隔離

新增檔案都在 `analytics-contracts` 與對應測試、文件。`server.js` 沒有引用這個目錄。

| 項目 | 結果 |
|---|---|
| API 與路由 | 未改 |
| SQL | 未改。kpiService 只被測試讀取原文 |
| KPI／B2／歷史最佳 | 未改 |
| BESTEP 匯入與 syncBestepScoresToExamAttempts | 未改 |
| Learning Journey、LVA、快照 | 未改 |
| 資料庫與 migration | 未改 |
| 前端 | 未改 |
| 排程 | 未新增，adapter 也不會啟動既有排程 |

載入這些模組只會 require 純 JavaScript。測試沒有建立 Sequelize 連線。

既有分析頁面的數字不會因為這次新增而改變，因為沒有任何正式讀取路徑呼叫 adapter。這不是端到端資料驗證。
