# 能否留在工程路徑

Shadow 可以留在預設關閉的工程路徑。Commit 成功後的診斷能分開 parsed prefix、正規化前綴與 committed 計數；shadow 自己的 throw 不會改匯入結果。

這還不是 Data Validated，也不適合把 finding 給管理員：

- 原檔保真度是 `not_verified`。
- 超過 200 列只描述前綴。
- 出席、投影、存量與重匯歷史仍是 `not_observed`。
- `officialUseAllowed` 與 `causalClaimAllowed` 仍是 false。
- 沒有 L3。

下一個分析試點不應是 Dashboard。若要繼續，應先決定日期與原檔證據，而不是把這份診斷放進 `res.json`。
