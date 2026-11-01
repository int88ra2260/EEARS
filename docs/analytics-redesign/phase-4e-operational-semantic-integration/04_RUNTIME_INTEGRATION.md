# Runtime 整合

唯一改到執行路徑的檔案是 `controllers/analyticsController.js` 的 `getOverview`。

## Hook 的位置

`kind` 轉成小寫後等於 `reservation` 時，服務回傳之後、`res.json` 之前：

```js
activityOpsShadow.runActivityOpsShadow({
  semesterId: semesterStr,
  legacyResult: data,
});
```

呼叫包在 try/catch。catch 只執行 `discardShadowFailure()`，然後仍 `res.json(data)`。

## 兩種錯誤分開

| 來源 | 行為 |
|---|---|
| `getReservationOverview` 丟出 `不支援的學期` | 與原來一樣 400。Shadow 不會跑，因為還沒拿到結果 |
| 其他服務錯誤 | 與原來一樣 `next(err)`。Shadow 不會跑 |
| 缺少 `semester` | 與原來一樣 400，服務與 shadow 都不跑 |
| Validator 或 runtime 丟出錯誤 | 被 hook 吃掉。HTTP 狀態與 body 仍是 legacy 的結果 |

服務只呼叫一次。Shadow 不因為檢查失敗而再查一次。

## 不會動到的分支

- `kind` 不是 `reservation`，包含沒有 `kind`、以及任何未知字串：仍走 `getAdminOverview`。未知 kind 本來就不是 400，這次沒有新增拒絕規則。
- 其他 controller 函式與其他 analytics 路由沒有加 hook。
- 回應物件不附加 `pilotId`、`warnings` 或 `errors`。

## 相容性

| 項目 | 結果 |
|---|---|
| 回應 JSON | flag 關或開，都是服務回傳的那一份 |
| HTTP 狀態 | 沿用原本的 200 / 400 / `next(err)` |
| SQL | `analyticsService.js` 沒有改 |
| 權限 | `requireFullCenterAnalytics` 沒有改 |
| 前端 | 沒有改 |
| 其他 kind | flag 開著也不會呼叫 validator |

正式環境即使設了 flag，runtime 仍因 `NODE_ENV=production` 而不執行檢查。
