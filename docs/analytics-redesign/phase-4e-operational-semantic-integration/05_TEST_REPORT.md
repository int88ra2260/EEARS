# 測試報告

沒有連資料庫。Legacy service 在路由測試裡是 mock。Shadow validator 測的是真實函式。

## ESLint

指令：

```bash
npx eslint analytics-contracts tests/analytics-contracts controllers/analyticsController.js tests/analyticsOverviewShadow.test.js
```

`analytics-contracts`、契約測試與新的路由測試沒有問題。`analyticsController.js` 有 3 個既有的 `no-unused-vars` 警告，位於第 5、31、36 行，與這次 hook 無關。ESLint 沒有 error，結束碼為 0。

## Jest

契約目錄單獨執行：

```bash
npm test -- --runInBand tests/analytics-contracts
```

- Suites：14 passed
- Tests：132 passed
- Failed：0
- Skipped：0

加上路由邊界與既有 admin 回歸：

```bash
npm test -- --runInBand tests/analytics-contracts tests/analyticsOverviewShadow.test.js tests/analyticsAdminOnly.test.js
```

- Suites：16 passed
- Tests：151 passed
- Failed：0
- Skipped：0

其中 `tests/analyticsOverviewShadow.test.js` 是 1 個 suite、10 個測試，走真實 router 與 `getOverview`，`analyticsService` 為 mock。`tests/analyticsAdminOnly.test.js` 是 1 個 suite、9 個測試，flag 維持關閉，結果仍是 200。

## E01–E25

| ID | 結果 | 位置 |
|---|---|---|
| E01 | flag 預設關；production 即使 flag 為 true 也不啟用 | 契約測試，另有路由級 production 案例 |
| E02 | flag 關時不呼叫 validator | 契約測試與路由測試 |
| E03 | flag 開時回應與服務回傳相同 | 路由測試 |
| E04 | validator 丟錯仍是原回應 | 路由測試。runtime 本身丟錯也另有一則 |
| E05 | 服務錯誤仍是 500，且不呼叫 validator | 路由測試 |
| E06 | `totalReservations` → `ops.reservation.row_count` | 契約測試 |
| E07 | `bookingRate` → `ops.capacity.reservation_over_seats` | 契約測試 |
| E08 | `attendanceRate` → `ops.reservation.checkin_row_rate` | 契約測試 |
| E09 | `englishPassRate` 為 `legacy_supplement`，並有 `CROSS_DOMAIN_LEGACY_FIELD` | 契約測試 |
| E10 | `semester` 為 `query_context` | 契約測試 |
| E11 | `totalEventCapacity` 為分母，沒有 Metric ID | 契約測試 |
| E12 | `violationRate` 有提案 ID，且提案不在登錄 | 契約測試 |
| E13 | 分項子路徑可從卡片列出 | 契約測試 |
| E14 | 多餘鍵產生 `UNKNOWN_RESPONSE_FIELD` | 契約測試 |
| E15 | 檢查後登錄仍是原來的 ID，報告不含提案 ID | 契約測試 |
| E16 | 活動日指標配上課案學期與 `reservations.timestamp` 會同時得到時間契約不符與不可比時間 | 契約測試 |
| E17 | 114-2 半開區間為 `2026-02-01T00:00:00+08:00` 到 `2026-08-01T00:00:00+08:00` | 契約測試 |
| E18 | validator 與 runtime 原始碼沒有 SQL 或 `getReservationOverview` | 契約測試 |
| E19 | 檢查前後 legacy 物件的 JSON 相同 | 契約測試，路由測試也比對回應 |
| E20 | 診斷字串不含學號、email、活動名稱與 Bearer | 契約測試 |
| E21 | flag 關時非 reservation 仍走 admin 總覽 | 路由測試 |
| E22 | flag 開時 `kind=workshop` 仍走 admin 總覽，不跑 shadow | 路由測試 |
| E23 | 回應 JSON 與 mock 回傳相同 | 路由測試 |
| E24 | 回應沒有 `pilotId`、`warnings`、`errors` | 路由測試 |
| E25 | 32 指標、9 個時間契約、7 個領域、D1–D11 仍 pending，兩個未實作指標不變，`officialUseAllowed` 與 `causalClaimAllowed` 全為 false | 契約測試 |

另外覆蓋：缺少學期是 400、不支援的學期是 400、legacy 為 null 或字串、`capacityBreakdown` 不是物件、分項列不是物件。

## Shadow 開與關

- 關：預約總覽與 admin 總覽的 body 都等於 mock，validator 呼叫次數是 0，服務各呼叫一次。
- 開：預約總覽 body 仍等於 mock，validator 恰好一次。其他 kind 仍不呼叫 validator。
- 正式 `NODE_ENV`：flag 打開也不呼叫 validator。

## 沒測到的

- 沒有對 MySQL 執行總覽 SQL，所以不能證明 CAST 含尾日與半開區間相等，也不能證明頂層數字與分項加總相等。
- 沒有用真實回應或學生資料。
- 沒有測前端畫面。
- 分項陣列超過 200 列時只檢查前 200 列的鍵，這個上限有診斷，但沒有用超大 fixture 做效能測試。
