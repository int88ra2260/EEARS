# 未關閉項目

D1–D11 仍是 pending。沒有指標被核准正式使用或因果表述。兩個未實作指標仍是 `ops.participation.streak` 與 `roster.pair_pass.both_pairs`。

## 發現，這次不修 SQL

| ID | 觀察 | 為什麼先留著 |
|---|---|---|
| F-OPS-01 | `bookingRate` 分子是有預約的列，分母含沒有預約的場次 | 改分母會改既有數字 |
| F-OPS-02 | 違規率來自分預約列的 `checkinStatus`，沒有讀 `event_violations`。兩者是否同步是 UNKNOWN | 不能靠猜決定誰是來源 |
| F-OPS-03 | 活動日是含尾日的 `CAST ... BETWEEN`。契約是半開區間。MySQL 是否同一批列尚未測 | 不在這階段跑 SQL |
| F-OPS-04 | 總覽沒有使用 `cancellationCode`。取消後列是否刪除，這段查詢無法回答 | 需要另看取消流程，不能從總覽 SQL 斷定 |
| F-OPS-05 | `hiddenFromStudents` 沒有進入 WHERE | 畫面若把「學生看得到的場次」當母體，會不一致 |
| F-OPS-06 | `items` 與 `byEventType` 是同一組數字的兩種形狀 | 不是雙重計算，但容易被加總兩次 |
| F-OPS-07 | `englishPassRate` 與活動參與沒有 JOIN | 不能解釋成活動成效 |
| F-OPS-09 | 頂層聚合與分項是不同 SQL。LEFT JOIN 列數與 INNER JOIN 列數尚未在資料庫證明相等 | 不為了讓 shadow 通過而改查詢 |

F-OPS-08 沒有使用。活動日篩選不使用 `events.semesterId` 已寫在 `semester` 卡片，不另開編號。

## 其他 UNKNOWN

- 活動有沒有被實體刪除，而不是用狀態欄標成停辦。模型上沒有停辦欄位。
- `eventType` 的空白與 null 在 SQL `GROUP BY` 之後、正規化之前會不會變成多列。
- `maxCapacity` 是否可能為 0 或負數。查詢只把空值變成 0，不驗證範圍。

## 提案依賴

`ops.reservation.violation_row_rate` 要進正式登錄前，至少要決定 F-OPS-02：違規狀態列與違規資料表是不是同一個母體。在那之前它維持 `PROPOSED`。

## 下一階段不要提前做

- 不改前端。
- 不把 shadow 診斷回傳給使用者。
- 不在正式環境打開 flag。
- 不執行 L3 或任何會讀學生列的 SQL。
- 不開始 Phase 4F。
