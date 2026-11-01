# 活動營運指標的靜態驗證

對象是 `GET /api/analytics/overview?semester=114-2&kind=reservation`。公式來源是 `analyticsService.getReservationOverview` 與 `getReservationCapacityBreakdown`。百分比都經過 `safePct`：分母為 0 或非數字時得到 0，否則取到小數兩位。

驗證狀態只用下面四種，不混用：

| 狀態 | 意思 |
|---|---|
| 程式已確認 | 這條規則寫在目前的程式裡 |
| 合成測試已確認 | 測試鎖定了契約文字或回應形狀，沒有重算資料庫 |
| 需要 MySQL | 必須看實際資料或執行計畫才知道 |
| 需要業務決定 | 程式已固定一種算法，換不換口徑是中心的決定 |

沒有任何一項在本階段被標成「資料已驗證」。

## totalReservations

- Business Question: 這個學期活動日區間裡，還有多少筆預約？
- Numerator: `COUNT(*)`，`reservations INNER JOIN events`
- Denominator: 不適用
- Population: 全中心預約列。路由 `requireFullCenterAnalytics` 沒有把班級或學生名單送進 SQL。
- Inclusion: 對得到活動，且活動日通過 `CAST(TRIM(events.date) AS DATE) BETWEEN` 設定檔起迄日。三種 `checkinStatus` 都算。
- Exclusion: 活動日不在區間，或預約沒有對應活動。公開取消與管理端取消成功時，`reservationService` 會 `destroy` 該列，因此已取消的預約不在這個數字裡。列上留下的 `cancellationCode` 是建立預約時產生的驗證碼，不是已取消旗標。
- Time Field: `events.date`
- Source: `reservations`, `events`
- SQL Reference: `analyticsService.js#getReservationOverview`
- Metric ID: `ops.reservation.row_count`
- Temporal Contract: `TC-OPS-DATE-SEMESTER`
- Data Validation Status: 程式已確認計算單位與取消刪列。前台建立預約時會拒絕同一活動的同學號或同 email。模型沒有宣告唯一索引，資料裡是否仍有重複列需要 MySQL。
- Known Risk: 一人多場會多筆。這個數字不是學生人數。

## bookingRate

- Business Question: 預約筆數相對提供的名額有多少？
- Numerator: `totalReservations`
- Denominator: `totalEventCapacity`
- Population: 分子是有預約列的場次；分母是區間內每一場，含零預約場次。
- Inclusion / Exclusion: 沿用兩欄。沒有活動類型篩選。
- Time Field: `events.date`
- Source: `reservations`, `events`
- SQL Reference: 同上，名額是獨立子查詢 `COALESCE(SUM(e2.maxCapacity), 0)`
- Metric ID: `ops.capacity.reservation_over_seats`
- Temporal Contract: `TC-OPS-DATE-SEMESTER`
- Data Validation Status: 程式已確認分子分母不是同一批列。要不要把零預約或隱藏場次留在分母，是業務決定。實際百分比尚未重算。
- Known Risk: 分母很大時，比率會看起來偏低，即使有人預約的場次其實滿了。

## attendanceRate

- Business Question: 這些預約列裡，有多少已經簽到？
- Numerator: `checkinStatus = 已簽到` 的列數。`attendedCount` 有算出來，沒有放進回應。
- Denominator: `totalReservations`，含未簽到與已登記違規。
- Population: 與總預約同一批列。
- Inclusion / Exclusion: 不在這批預約裡的人不會出現。沒有依人去重。時間不是 `checkinTime`。
- Time Field: `events.date`
- Source: `reservations`, `events`
- SQL Reference: `getReservationOverview`
- Metric ID: `ops.reservation.checkin_row_rate`
- Temporal Contract: `TC-OPS-DATE-SEMESTER`
- Data Validation Status: 程式已確認這是列比率。它不是 `ops.roster.distinct_checkin_students`，那個指標用另一個時間契約，母體是呼叫端名單。
- Known Risk: 畫面上若只寫「出席率」，會被讀成學生出席比例。

## totalEventCapacity

- Business Question: 這個日期區間提供了多少活動名額？
- Numerator: 不適用
- Denominator: 名額率的分母
- Population: 活動日在區間內的 `events` 列。一列加一次 `maxCapacity`，不是用預約列去乘。
- Inclusion: 沒有依 `eventType`、`hiddenFromStudents` 或 `events.semesterId` 篩選。
- Exclusion: 區間外的場次。模型沒有停辦欄位。`DELETE /api/events/:id` 在已有預約時會拒絕；沒有預約的活動可以刪除，刪除後就不會留在分母。強制刪除會 `event.destroy()`，模型關聯寫了 `onDelete: CASCADE`。實際資料庫外鍵有沒有這條，需要 MySQL。
- Time Field: `events.date`
- Source: `events`
- SQL Reference: `getReservationOverview` 的名額子查詢
- Metric ID: 無。它是既有名額率的分母。
- Temporal Contract: `TC-OPS-DATE-SEMESTER`
- Data Validation Status: 程式已確認納入規則。`maxCapacity` 模型為 NOT NULL；查詢把空值變成 0。0 或負數沒有另外擋下，實際有沒有這種值需要 MySQL。
- Known Risk: 隱藏場次仍算進供給。若主任問的是「學生看得到的名額」，目前數字會偏大。

## violationRate

- Business Question: 這些預約列裡，有多少被標成已登記違規？
- Numerator: `checkinStatus = 已登記違規` 的預約列。一人多筆就多計。
- Denominator: `totalReservations`
- Population: 與總預約同一批列。
- Inclusion: 只認預約列上的列舉值。日期仍是活動日，不是 `event_violations.recordedAt`。
- Exclusion: SQL 沒有 JOIN `event_violations`。
- Time Field: `events.date`
- Source: `reservations`, `events`
- SQL Reference: `getReservationOverview`
- Metric ID: 無。提案 `ops.reservation.violation_row_rate` 仍是 `PROPOSED`。
- Temporal Contract: 若立案，應對 `TC-OPS-DATE-SEMESTER`
- Data Validation Status: 程式已確認比率定義。`eventRouter` 登記違規時，同一交易會新增 `event_violations` 並改預約狀態；同一預約若已是該狀態會回 409。`clearStudentVisibleViolation` 會嘗試把狀態與違規列一起改回。兩邊筆數是否一致，需要 MySQL。正式指標要不要採用這個定義，是業務決定。
- Known Risk: 違規表若有同一人多筆，或狀態已清但違規列還在，兩個數字會不同。總覽只會跟著預約狀態走。

## capacityBreakdown

- Business Question: 同樣的日期區間裡，各活動類型與各場次的名額和預約各是多少？
- Numerator / Denominator: 類型與單場各自用該層的預約列與名額，再經 `safePct`。
- Population: 與名額總數相同的活動日條件。類型查詢是 `events LEFT JOIN reservations`，所以零預約場次還在。
- Inclusion: 空白 `eventType` 在映射時變成 `未分類`。SQL `GROUP BY` 用的是正規化前的值。
- Exclusion: 沒有類型白名單。
- Time Field: `events.date`。單場輸出的 `eventDate` 是原始字串，沒有再 CAST。
- Source: `events`, `reservations`
- SQL Reference: `getReservationCapacityBreakdown`、`buildCapacityBreakdownPayload`
- Metric ID: 無。整包是 breakdown。類型與單場的預約列、名額、比率是既有指標的切片。
- Temporal Contract: `TC-OPS-DATE-SEMESTER`
- Data Validation Status: 程式已確認 `items` 是 `byEventType` 的另一種形狀，`summary` 只加 `items`，不會把 `byEvent` 再加一次。頂層主查詢與這段是兩次 SQL。在沒有並行寫入時，區間內活動上的預約列數應與頂層 `COUNT(*)` 相同，因為一邊是 INNER JOIN 計數、一邊是 LEFT JOIN 的 `COUNT(r.id)`。這個推論沒有在 MySQL 執行。空白與 null 類型會不會變成兩列同名「未分類」，也要看資料。
- Known Risk: 把 `items` 與 `byEventType` 再加總會重複。`summary` 不等於「已用資料證明過的頂層總數」。

## englishPassRate

- Business Question: 這個學期代碼的英檢報名列裡，`hasCEFRB2` 有多少被填成肯定值？
- Numerator: `hasCEFRB2 IN ('是','true','yes','1')`
- Denominator: `english_test_registrations.semester` 等於查詢學期的列數
- Population: 報名列。與預約、簽到、違規沒有 JOIN。
- Inclusion / Exclusion: 其他標記值算未標成肯定。不讀考試分數，不讀學習歷程。
- Time Field: `english_test_registrations.semester`。契約是 `TC-BESTEP-FILE-SEMESTER`，不會展開成活動日。
- Source: `english_test_registrations`
- SQL Reference: `getReservationOverview` 的第二段 SQL
- Metric ID: `ops.registration.legacy_has_cefr_b2`
- Temporal Contract: `TC-BESTEP-FILE-SEMESTER`
- Data Validation Status: 程式已確認它與活動參與分離。治理狀態是 `deprecated_candidate`。報名表的學期字串是否都乾淨，需要 MySQL。它不能支持活動教學成效，這不是還在等資料的問題。
- Known Risk: 和營運 KPI 放在同一個 JSON，容易被讀成活動後的英語結果。現有營運頁沒有畫這個欄位。

## semester

- Business Question: 這次查詢用的是哪個學期代碼？
- Numerator / Denominator / Population: 不適用
- Inclusion: 請求字串，同時是 `SEMESTER_RANGES` 的鍵。不在表內的代碼會在服務丟出 `不支援的學期`，controller 回 400。
- Time Field: 不適用。活動落點看 `events.date`，不看 `events.semesterId`。
- Source: 查詢參數與 `shared/semesterConfig.js`
- SQL Reference: 不進統計 SQL
- Metric ID: 無
- Temporal Contract: 無
- Data Validation Status: 程式已確認它是回顯。114-2 的設定檔是 2026-02-01 到 2026-07-31。`semesters` 與 `et_semesters` 若另有起迄，不會改變這支 API，但會讓別的學習歷程篩選不同。兩邊日期是否相同，需要 MySQL。
- Known Risk: 主任若同時看學習歷程與這頁，可能以為「114-2」是同一個日期窗。
