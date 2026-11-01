# Shadow Runtime 契約

檔案：`reservation-backend/analytics-contracts/pilots/bestepClassAnalyticsShadowRuntime.js`。

它重用 Phase 4L 的 `bestepClassAnalyticsContract.js` 與 `bestepClassAnalyticsValidator.js`。`activityOpsShadowRuntime.js` 與 `bestepFileQualityShadowRuntime.js` 沒有修改。公開 helper 使用 `discardBestepClassAnalyticsShadowFailure`，避免和另外兩個 runtime 的函式同名。

## 旗標

`isBestepClassAnalyticsShadowEnabled` 讀 `BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED`。未設定、`TRUE`、`1` 都不啟用。`NODE_ENV=production` 時即使旗標是 `true` 也不啟用。旗標判斷若丟出例外，視為關閉。

沒有管理端開關，沒有新的正式 API，也沒有改部署設定。

## 輸入

Controller 傳入已經算好的 `result`，以及學期、考試類型、頁碼、頁面大小、`searchPresent`。不把搜尋字串送進 Shadow，避免搜尋內容是學號。Runtime 不複製整份 response，也不重新計算指標。

## 輸出

回傳診斷物件，不寫回 `result`。診斷只保留 pilot id、契約版本 `phase-4l`、狀態、欄位計數、警告代碼、F-BESTEP-01 的證據分類，以及四個治理旗標。四個旗標維持 false。`recalculated` 維持 false。`examSittings` 維持 null。

## Fail-open

旗標、query context、validator、sanitizer、logging 各自失敗時，HTTP 回應不受影響。Runtime 內部錯誤收成 `SHADOW_INTERNAL_ERROR`。非同步 validator 會被當成不支援，代碼 `SHADOW_ASYNC_NOT_SUPPORTED`，並掛上空的 rejection handler。例外訊息與 stack 不進入診斷。

預設不寫 console。只有另一個明確字串旗標 `BESTEP_CLASS_ANALYTICS_SHADOW_LOG=true` 且呼叫端提供 logger 時，才送出一行代碼與計數。Logger 丟出例外時，已完成的診斷仍保留。
