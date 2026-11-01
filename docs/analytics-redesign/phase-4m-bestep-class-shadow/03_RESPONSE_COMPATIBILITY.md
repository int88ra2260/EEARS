# 回應相容性

控制器整合測試使用同一形狀的合成 response，分別在旗標關閉與 `true` 下呼叫 `getBestepOverview`。

兩次的 HTTP status 都是 200。`res.body` 深度相等，包含 statistics、students 與 pagination 的全部鍵值。`Class.findByPk`、`assertCanAccessClass`、`getClassBestepOverview` 的呼叫次數與參數也相同。沒有第二次資料庫查詢。

服務拒絕時仍是 500，body 是 `{ error: 'overview failed' }`，Shadow 沒有被呼叫。範圍拒絕仍是 403 `CLASS_SCOPE_DENIED`，服務與 Shadow 都沒有被呼叫。非法 `classId` 仍是 400，而且不會查班級。

分頁參數仍原樣交給 `getClassBestepOverview`。Shadow 不改 response 裡的 `pagination`。匯出函式在旗標開啟時也不呼叫 `observeBestepClassAnalytics`。

B2 政策與 KPI 公式沒有改。前端正式元件沒有改。
