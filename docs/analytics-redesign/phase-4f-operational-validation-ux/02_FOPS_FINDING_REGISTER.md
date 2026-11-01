# F-OPS 驗證清單

狀態字彙：

- `VERIFIED_BY_CODE`：目前程式已把規則寫死。
- `VERIFIED_BY_SYNTHETIC_TEST`：測試鎖定契約或回應形狀。不是資料庫重算。
- `DATA_VALIDATION_REQUIRED`：要看 MySQL 才知道實際筆數或結構。
- `BUSINESS_DECISION_REQUIRED`：算法已存在，換口徑要由中心決定。
- `UNRESOLVED`：程式也無法判斷。

一項可以同時有程式狀態與資料狀態。沒有項目因為「還沒查資料庫」就被整項標成未知。

## F-OPS-01 名額率的分子與分母不是同一批列

- 狀態：`VERIFIED_BY_CODE`，另有 `BUSINESS_DECISION_REQUIRED`
- 程式：分子是區間內預約列的 INNER JOIN 計數。分母是同一日期條件下全部活動的 `maxCapacity` 加總，零預約場次仍在分母。
- 合成測試：卡片仍是 `partial`，沒有把這個公式改成已驗證的資料結果。
- 資料：尚未重算實際比率。
- 業務：若主任要的是「有開成的場次裡，被預約的比例」，現在的分母會把沒人預約的場次也算進去。要不要改，本階段不決定。

## F-OPS-02 違規率不是違規表的事件率

- 狀態：`VERIFIED_BY_CODE` 定義；同步與否是 `DATA_VALIDATION_REQUIRED`；要不要立案是 `BUSINESS_DECISION_REQUIRED`
- 程式：總覽只數 `checkinStatus = 已登記違規` 的預約列，分母是全部預約列。登記路由在同一交易寫入 `event_violations` 並改狀態；已是該狀態則 409。清除函式會嘗試兩邊一起改回。總覽不讀 `recordedAt`。
- 合成測試：`violationRate` 的 Metric ID 仍是 null，提案 ID 不在 32 個正式指標裡。
- 資料：狀態列數與違規表列數是否相等，需要 MySQL，而且要先確認 `reservations.userId` 欄位存在。模型檔沒有宣告這個欄位，登記與清除程式卻會使用它。
- 未解部分：沒有。定義本身已經由程式確定。

## F-OPS-03 活動日邊界與另一套學期日期

- 狀態：邊界寫法 `VERIFIED_BY_CODE`；MySQL 等價與其他學期表是 `DATA_VALIDATION_REQUIRED`
- 程式：總覽使用 `CAST(TRIM(events.date) AS DATE) BETWEEN` 設定檔起日與迄日，兩邊含當日。114-2 設定檔是 2026-02-01 到 2026-07-31。半開契約的結束點是 2026-08-01T00:00:00+08:00。`events.date` 在模型是字串。
- 這支 API 不讀 `events.semesterId`、`semesters` 或 `et_semesters`。學習歷程的 `buildSemesterEventFilter` 會用這三套條件的 OR。因此「114-2」在兩個功能裡不一定是同一批活動。
- 合成測試：114-2 的半開端點已鎖定。這不證明 MySQL `CAST` 結果。
- 資料：無效日期、帶時間的字串、設定檔與 `semesters.startDate` 是否相同，都還沒查。

## F-OPS-04 取消預約

- 狀態：`VERIFIED_BY_CODE`
- 程式：`cancelReservationPublic` 與 `cancelReservationByAdmin` 在通過檢查後 `reservation.destroy()`。黑名單視窗內的取消也會刪列。總覽沒有取消狀態可篩，因為成功取消的列已經不在。留在列上的 `cancellationCode` 是驗證碼。
- 前台建立預約會先拒絕同一活動的同學號或同 email。模型檔沒有唯一索引宣告；若資料是從別的路徑寫入，重複列仍會被數進去。重複列是否存在是 `DATA_VALIDATION_REQUIRED`。
- 合成測試：契約寫明刪列，且 `verificationStatus` 維持 `partial`。測試沒有製造一筆取消再重算 SQL。
- 不再把「SQL 沒有處理取消」當成未知。SQL 不需要取消旗標，因為取消不是改旗標。

## F-OPS-05 隱藏場次與停辦

- 狀態：納入規則 `VERIFIED_BY_CODE`；要不要排除隱藏場次是 `BUSINESS_DECISION_REQUIRED`
- 程式：`hidden_from_students` 存在，總覽 WHERE 沒有用它。模型沒有停辦或取消活動狀態。已有預約時，一般刪除會被拒絕。沒有預約的活動可以刪除，之後不在名額裡。強制刪除只呼叫 `event.destroy()`；關聯宣告是 `onDelete: CASCADE`。實際外鍵是否會一併刪預約，是 `DATA_VALIDATION_REQUIRED`。
- 不論外鍵是否生效，被刪掉的活動不會留在這支總覽的分母裡。若外鍵沒生效而預約變成孤兒，INNER JOIN 也不會把那些預約算進分子。

## F-OPS-06 items 與 byEventType

- 狀態：`VERIFIED_BY_CODE`
- 程式：`buildCapacityBreakdownPayload` 把 `byEventType` 映射成 `items`。`reservedCount`、`capacity`、`utilizationRate` 分別來自 `totalReservations`、`totalEventCapacity`、`bookingRate`。`summary` 只加 `items`。JSON 裡數字出現兩次，SQL 沒有因此加總兩次。
- 合成測試：卡片記載這個映射。測試沒有拿一組假數字去重算百分比，因此不能稱為數值一致性已驗證。
- 資料：空白與 null 的 `eventType` 在 `GROUP BY` 後會不會變成兩列、映射後又都叫「未分類」，需要 MySQL。那是標籤碰撞，不是把同一場加兩次。

## F-OPS-07 englishPassRate 與活動無關

- 狀態：`VERIFIED_BY_CODE`
- 程式：第二段 SQL 只查 `english_test_registrations`，條件是學期標籤。沒有 JOIN 預約或活動。時間契約是檔案學期，不是活動日。
- 合成測試：語意類型是 `legacy_supplement`，並會產生 `CROSS_DOMAIN_LEGACY_FIELD`。
- 資料：學期字串是否整齊，需要 MySQL。就算資料很乾淨，它仍然不是活動成效。
- 業務：不需要再決定「它算不算活動成效」。程式與契約都已經把它排除在活動成效之外。是否還要在別的頁面顯示這個舊標記，可以另議，但不影響這條結論。

## F-OPS-08

沒有使用這個編號。活動日不看 `events.semesterId` 已寫在 F-OPS-03，不另開一條。

## F-OPS-09 頂層與分項是否同一批數

- 狀態：查詢分開是 `VERIFIED_BY_CODE`；實際列數相等是 `DATA_VALIDATION_REQUIRED`
- 程式：頂層與分項是不同陳述式，使用同一套活動日條件。分項以活動為主做 LEFT JOIN，再 `COUNT(reservations.id)`。頂層以預約為主做 INNER JOIN，再 `COUNT(*)`。在沒有並行寫入、且預約都連得到區間內活動時，預約列數應相同。名額加總也應等於各類型名額之和。這是 SQL 形狀的推論，不是已執行的結果。
- 合成測試只鎖定「summary 不保證等於頂層」這句限制，沒有宣稱兩邊數字已經相符。

## 母體與權限

- 狀態：`VERIFIED_BY_CODE`
- 全中心。沒有活動類型條件，沒有工作集參數。`requireFullCenterAnalytics` 只放行 admin 或 `hasAdminRights`。看得到的人看到的是同一套全中心數字。
