# 契約與測試

本階段沒有改統計 SQL、服務公式、API 形狀、前端或資料庫。契約只更正已經由程式確認、但 Phase 4E 仍寫得過寬的限制說明。

## 改了什麼

`activityOpsFieldContract.js`：

- `totalReservations` 寫明成功取消會刪除預約列，`cancellationCode` 是驗證碼，不是已取消狀態。驗證狀態維持 `partial`。
- `totalEventCapacity` 寫明沒有停辦欄位、隱藏場次仍納入、一般刪除與強制刪除的程式差異。
- `violationRate` 寫明登記路由會同時寫違規表與預約狀態，總覽只數預約狀態。Metric ID 仍是 null。

`activityOpsShadowValidator.test.js` 新增一則測試，鎖定上述文字，並確認核心欄位沒有被改成 verified。這則測試沒有重算任何百分比，也不能用來宣稱頂層與分項的數字已經一致。

Shadow runtime、controller hook 與正式回應都沒有再改。

## ESLint

```bash
npx eslint analytics-contracts tests/analytics-contracts controllers/analyticsController.js tests/analyticsOverviewShadow.test.js
```

Error：0。Warning：3，都在 `analyticsController.js` 第 5、31、36 行，是既有的未使用變數，不是這次修改。

## Jest

```bash
npm test -- --runInBand tests/analytics-contracts tests/analyticsOverviewShadow.test.js tests/analyticsAdminOnly.test.js
```

- Suites：16 passed
- Tests：152 passed
- Failed：0
- Skipped：0

比 Phase 4E 提交時的 151 多 1。多的是「程式已確認的限制維持 partial」。路由測試 10 則與 `analyticsAdminOnly` 9 則仍通過。Flag 關閉與開啟時的回應相容沒有改動。

## 這次測試沒有覆蓋的資料情境

- 沒有執行 V-OPS-01 到 V-OPS-07。
- 沒有證明 `CAST` 與半開區間的筆數相同。
- 沒有證明頂層預約數等於分項加總。
- 沒有證明違規狀態與 `event_violations` 筆數相同。
- 沒有用真實回應或瀏覽器檢查頁面。
