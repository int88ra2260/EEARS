# Shadow Runtime 稽核

三個 runtime 分開檢查。本階段沒有把它們收成共用框架。相似處只列為日後候選。

| 項目 | 活動營運 | BESTEP 檔案品質 | BESTEP 班級 |
|---|---|---|---|
| 旗標 | `ANALYTICS_SEMANTIC_SHADOW_ENABLED` | `BESTEP_FILE_QUALITY_SHADOW_ENABLED` | `BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED` |
| 預設 | 未設定即關閉 | 同左 | 同左 |
| 環境 | `test` / `development` / `staging`；`production` 關閉 | 同左 | 同左 |
| 字串 | trim 後轉小寫，必須是 `true` | trim 後必須是精確 `true` | 同檔案品質 |
| 掛載 | `getOverview` 且 `kind=reservation`，統計完成後 | `importScoreData` 提交成功後 | `getBestepOverview` 成功後、`res.json` 前 |
| 失敗 | 內部 try 與 controller catch 都丟棄 | catch 呼叫 `discardBestepFileQualityShadowFailure` | catch 呼叫 `discardBestepClassAnalyticsShadowFailure` |
| 回應 | `res.json(data)` 使用原物件 | 匯入結果不改 | `res.json` 使用原 overview |
| 資料庫 | 不再查詢、不寫入 | 同左 | 同左 |
| 輸入 | 不改 legacy payload | 不改匯入列 | 不把 search 字串送進 Shadow |
| 日誌 | 另需 log 旗標；只印 pilot、狀態與代碼 | 診斷不含個資；預設不印 console | 同左，且需注入 logger |
| 測試 | `analyticsOverviewShadow` 與契約測試 | 匯入 Shadow 與 controller 測試 | 班級 Shadow 與 controller 測試 |
| 停用 | 拿掉環境變數即可 | 同左 | 同左；匯出本來就沒掛 |

## 差異（保留，不合併）

- 活動旗標接受 `TRUE`，兩個 BESTEP 旗標只接受 `true`。三者在 production 都關閉。這是一致性候選，不是缺陷到需要本階段改程式。
- 活動失敗報告帶固定英文 detail；班級診斷把例外收成 `SHADOW_INTERNAL_ERROR`，不帶例外訊息。
- 檔案品質有 200 列上限與截斷。班級 Shadow 只讀已經組好的 overview，不重算通過率。
- 三個丟棄函式名稱不同，避免 `index.js` 展開時撞名。

## 本階段結論

沒有看到未處理的 Shadow Promise 會改寫回應。controller 測試在旗標開啟時比對完整 JSON。匯出、報名、出席匯入、KPI 沒有被這三個 hook 重算。
