# 執行隔離

程式：`analytics-contracts/pilots/bestepFileQualityShadowRuntime.js`。

Flag 關閉時，`importScoreData` 不會呼叫 `observeBestepScoreImport`，也不做 snapshot。

Flag 開啟時：

1. 用前 200 筆原始列與對應 error code 組 validator 輸入。
2. 呼叫 `evaluateBestepFileQuality`。
3. 回傳值被匯入函式丟掉，不放進 `outcome`。
4. validator 丟錯或 mapper 丟錯時，runtime 回 `shadow_error`。若 runtime 本身仍丟錯，匯入函式的外層 catch 吃掉，仍回傳原本的 `outcome`。

Commit 失敗會先 rollback 並 throw。這條路徑到不了 shadow，所以既有錯誤不會被收成成功。

列內的 `upsert` 失敗仍沿用舊行為：該列變成 `PROCESSING_ERROR`，整批繼續，最後 commit。Shadow 沒有改這個 catch。

權限、出席匯入、報名路由與 KPI 檔沒有引用這個 flag。活動營運 shadow runtime 沒有被改成共用實作。

`discardBestepFileQualityShadowFailure` 與活動營運的 `discardShadowFailure` 是兩個函式，避免 `index.js` 的匯出互相覆蓋。
