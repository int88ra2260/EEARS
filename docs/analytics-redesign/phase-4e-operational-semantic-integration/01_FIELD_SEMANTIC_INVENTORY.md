# 活動營運總覽欄位盤點

目標只限：

`GET /api/analytics/overview?semester={semester}&kind=reservation`

程式路徑：

| 層 | 位置 | 這次看到的行為 |
|---|---|---|
| 掛載 | `server.js` 的 `app.use('/api', analyticsRouter)` | 前綴是 `/api` |
| 路由 | `routes/analyticsRouter.js` | `GET /analytics/overview`，`requireFullCenterAnalytics`：admin 或 `hasAdminRights` |
| Controller | `controllers/analyticsController.js` `getOverview` | 沒有 `semester` 回 400。`kind` 轉小寫後等於 `reservation` 才走預約總覽，其他字串走 `getAdminOverview` |
| 服務 | `services/analyticsService.js` `getReservationOverview` | 學期不在 `SEMESTER_RANGES` 時丟出 `不支援的學期`，controller 回 400 |
| 分項 | 同檔 `getReservationCapacityBreakdown`、`buildCapacityBreakdownPayload` | 總覽把分項物件嵌進 `capacityBreakdown` |
| 前端 | `pages/admin/AdminAnalyticsPage.jsx` | `kind` 固定 `reservation`。畫面用總預約、名額率、出席率、違規率。`englishPassRate` 沒有顯示。名額表優先打另一支 `GET /api/analytics/reservation-capacity-breakdown`，總覽裡的 `capacityBreakdown` 只是正規化時的候選來源 |

活動日條件是：

`CAST(TRIM(events.date) AS DATE) BETWEEN CAST(:start AS DATE) AND CAST(:end AS DATE)`

`events.date` 在模型裡是字串。114-2 的設定是起日 `2026-02-01`、迄日 `2026-07-31`，兩邊都含當日。半開契約的結束點是 `2026-08-01T00:00:00+08:00`。這兩種邊界還沒在 MySQL 對過。

`Reservation.checkinStatus` 只有 `未簽到`、`已簽到`、`已登記違規`。總覽 SQL 沒有讀 `cancellationCode`。`Event` 沒有取消或停辦欄位；`hiddenFromStudents` 與 `semesterId` 都沒有出現在這段 WHERE。

以下卡片的機器可讀版本在 `reservation-backend/analytics-contracts/pilots/activityOpsFieldContract.js`。`verificationStatus: partial` 表示公式已從程式讀到，但還沒用資料庫重算或還有未證明的邊界。

## 頂層

### semester

- Field Type: string
- Semantic Type: `query_context`
- Business Meaning: 查詢參數回顯，也是 `SEMESTER_RANGES` 的鍵。不是活動日，也不是指標。
- Calculation / Numerator / Denominator / Analysis Unit / Population: `NOT_APPLICABLE`
- Inclusion / Exclusion: `NOT_APPLICABLE`
- Source Tables: 無
- Time Field: `NOT_APPLICABLE`
- Temporal Contract: 無
- Metric ID: 無
- Metric Status: `not_a_metric`
- Evidence Classification: descriptive
- Known Limitations: 活動是否屬於這個學期，看的是 `events.date` 的 CAST 區間，不是 `events.semesterId`。
- Code Reference: `getReservationOverview` 回傳物件的 `semester`
- Verification Status: verified

### totalReservations

- Field Type: number
- Semantic Type: `metric`
- Business Meaning: 活動日在區間內的預約列數。一人一場一列，不是不重複學生。
- Calculation: `COUNT(*)`，`reservations INNER JOIN events`
- Numerator: 預約列。Denominator: `NOT_APPLICABLE`
- Analysis Unit: `reservation_row`
- Population: 全中心。路由沒有班級或學生名單。
- Inclusion: 對得到活動，且活動日通過 CAST 區間。三種簽到狀態都在內。
- Exclusion: 活動日在區間外，或沒有對應活動的預約。SQL 沒有取消條件。
- Source Tables: `reservations`, `events`
- Time Field: `events.date`
- Temporal Contract: `TC-OPS-DATE-SEMESTER`
- Metric ID: `ops.reservation.row_count`
- Metric Status: mapped
- Evidence: descriptive
- Known Limitations: 含尾日 CAST 與半開區間尚未實測（F-OPS-03）。取消列是否還在表上，這段 SQL 看不出來（F-OPS-04）。
- Code Reference: `analyticsService.js#getReservationOverview`
- Verification Status: partial

### totalEventCapacity

- Field Type: number
- Semantic Type: `derived_value`
- Business Meaning: 區間內每場 `maxCapacity` 加總，是 `bookingRate` 的分母。
- Calculation: 子查詢 `COALESCE(SUM(e2.maxCapacity), 0)`，再 `Number(值 || 0)`
- Numerator: `NOT_APPLICABLE`。Denominator: `bookingRate` 的分母
- Analysis Unit: `event_row_capacity`
- Population: 日期區間內的 `events` 列。沒有預約的場次仍計入。
- Inclusion: 同一套活動日條件。沒有活動類型篩選。
- Exclusion: 區間外的場次。沒有取消欄位可排除。
- Source Tables: `events`
- Time Field: `events.date`
- Temporal Contract: `TC-OPS-DATE-SEMESTER`
- Metric ID: 無。它是既有名額率的分母，不另建指標。
- Metric Status: `not_in_registry`
- Evidence: descriptive
- Known Limitations: 分子只算有預約列的場次，分母含零預約場次（F-OPS-01）。`hiddenFromStudents` 未用（F-OPS-05）。SQL 依活動列加總，不是依預約列乘上名額；若同一場在表上有兩列，兩列都會加。模型上 `maxCapacity` 為 NOT NULL；查詢空值變成 0。0 或負數沒有另外擋。
- Code Reference: `getReservationOverview` 的名額子查詢
- Verification Status: partial

### bookingRate

- Field Type: number
- Semantic Type: `metric`
- Business Meaning: 預約列數相對名額加總的百分比。
- Calculation: `safePct(totalReservations, totalEventCapacity)`。分母為 0 或非數字時是 0，否則百分比取兩位小數。
- Numerator: `totalReservations`。Denominator: `totalEventCapacity`
- Analysis Unit: `reservation_row_over_event_capacity`
- Population: 分子與分母不是同一批列。
- Inclusion / Exclusion: 沿用上面兩欄。
- Source Tables: `reservations`, `events`
- Time Field: `events.date`
- Temporal Contract: `TC-OPS-DATE-SEMESTER`
- Metric ID: `ops.capacity.reservation_over_seats`
- Metric Status: mapped
- Evidence: descriptive
- Known Limitations: F-OPS-01。這次不改公式。
- Code Reference: `getReservationOverview`
- Verification Status: partial

### attendanceRate

- Field Type: number
- Semantic Type: `metric`
- Business Meaning: 已簽到預約列佔全部預約列的百分比。不是不重複出席人數。
- Calculation: `safePct(已簽到列數, totalReservations)`。`attendedCount` 有算出來，沒有放進回應。
- Numerator: `checkinStatus = 已簽到`。Denominator: `totalReservations`
- Analysis Unit: `reservation_row`
- Population: 與總預約同一批列。分母含未簽到與已登記違規。
- Inclusion / Exclusion: 不在這批預約裡的人不會出現。沒有依人去重。
- Source Tables: `reservations`, `events`
- Time Field: `events.date`。不是 `checkinTime`。
- Temporal Contract: `TC-OPS-DATE-SEMESTER`
- Metric ID: `ops.reservation.checkin_row_rate`
- Metric Status: mapped
- Evidence: descriptive
- Known Limitations: 不可改掛 `ops.roster.distinct_checkin_students`。那個指標的時間契約是 `TC-OPS-DATE-STRING`，母體是呼叫端傳入的名單。
- Code Reference: `getReservationOverview`
- Verification Status: partial

### violationRate

- Field Type: number
- Semantic Type: `derived_value`
- Business Meaning: 已登記違規的預約列佔全部預約列的百分比。是列比率，不是違規學生數，也不是 `event_violations` 列數。
- Calculation: `safePct(已登記違規列數, totalReservations)`。`violationCount` 沒有放進回應。
- Numerator: `checkinStatus = 已登記違規` 的預約列。一人多列就多計。
- Denominator: `totalReservations`
- Analysis Unit: `reservation_row`
- Population: 與總預約同一批列。
- Inclusion: 只認預約列上的這個列舉值。篩選日期仍是活動日。
- Exclusion: 沒有 JOIN `event_violations`。未簽到與已簽到不算分子。
- Source Tables: `reservations`, `events`
- Time Field: `events.date`
- Temporal Contract: 若將來立案，應對 `TC-OPS-DATE-SEMESTER`。目前沒有正式 Metric ID。
- Metric ID: 無
- Metric Status: `not_in_registry`
- Evidence: descriptive
- Known Limitations: 與 `event_violations` 是否同步是 UNKNOWN（F-OPS-02）。違規登錄日若不同於活動日，這裡仍用活動日。
- Code Reference: `getReservationOverview`
- Verification Status: partial

### englishPassRate

- Field Type: number
- Semantic Type: `legacy_supplement`
- Business Meaning: 該學期英檢報名列裡，`hasCEFRB2` 被標成肯定值的百分比。不是活動造成的英語能力提升。
- Calculation: 第二段 SQL。`safePct(肯定標記列數, 該學期報名列數)`。肯定值只認 `是`、`true`、`yes`、`1`。
- Numerator: 上述標記。Denominator: `english_test_registrations.semester` 等於查詢學期的列數。
- Analysis Unit: `registration_row`
- Population: 報名列。與預約、簽到、違規沒有 JOIN。
- Inclusion: 學期標籤相等。
- Exclusion: 不讀考試分數，不讀學習歷程。
- Source Tables: `english_test_registrations`
- Time Field: `english_test_registrations.semester`
- Temporal Contract: `TC-BESTEP-FILE-SEMESTER`。這個契約不會把學期標籤展開成活動日。
- Metric ID: `ops.registration.legacy_has_cefr_b2`
- Metric Status: `mapped_cross_domain`
- Evidence: descriptive
- Known Limitations: 不能支持活動成效結論（F-OPS-07）。登錄上的治理狀態是 `deprecated_candidate`。
- Code Reference: `getReservationOverview` 的 `englishSql`
- Verification Status: partial

### capacityBreakdown

- Field Type: object，不是陣列
- Semantic Type: `breakdown`
- Business Meaning: 同一日期區間再依活動類型與單場拆開。整包不能對到一個 Metric ID。
- Calculation: `getReservationCapacityBreakdown`
- Numerator / Denominator: 見子欄位
- Analysis Unit: mixed
- Population: 與名額總數相同的活動日區間。類型查詢是 `events LEFT JOIN reservations`，零預約場次還在。
- Inclusion: 空白 `eventType` 會變成 `未分類`。
- Exclusion: 沒有活動類型白名單。
- Source Tables: `events`, `reservations`
- Time Field: `events.date`
- Temporal Contract: `TC-OPS-DATE-SEMESTER`
- Metric ID: 無
- Metric Status: `not_a_metric`
- Evidence: descriptive
- Known Limitations: `items` 是 `byEventType` 的另一種形狀，JSON 重複出現數字，SQL 沒有加總兩次（F-OPS-06）。這段與頂層主查詢是不同 SQL，數字是否一致尚未證明（F-OPS-09）。
- Code Reference: `getReservationCapacityBreakdown`、`buildCapacityBreakdownPayload`
- Verification Status: partial

## capacityBreakdown 子欄位

子欄位與頂層共用活動日區間，除非下面另外寫。診斷不會複製 `eventName` 或 `eventId` 的值。

| Field Path | Type | Semantic | 在數什麼 | Metric | Verification |
|---|---|---|---|---|---|
| `capacityBreakdown.semester` | string | query_context | 與頂層相同的學期代碼 | 無 | verified |
| `capacityBreakdown.range` | object | query_context | 含尾日的起迄字串，不是半開區間 | 無 | partial |
| `capacityBreakdown.range.startDate` | string | query_context | `SEMESTER_RANGES.start`。114-2 為 `2026-02-01` | 無 | verified |
| `capacityBreakdown.range.endDate` | string | query_context | 含尾日。114-2 為 `2026-07-31` | 無 | partial |
| `capacityBreakdown.items` | array | breakdown | 由 `byEventType` 映射。`reservedCount`、`capacity`、`utilizationRate` 分別對應類型的預約列、名額、比率 | 無 | verified（映射本身） |
| `capacityBreakdown.items[].eventType` | string | dimension | 類型代碼；空白成 `未分類` | 無 | verified |
| `capacityBreakdown.items[].reservedCount` | number | derived_value | 該類型預約列。單場先 `COUNT`，再依類型加總 | 無，是列數的切片 | partial |
| `capacityBreakdown.items[].capacity` | number | derived_value | 該類型 `maxCapacity` 加總。依 event id 收斂後再加，不會用預約列去乘名額 | 無 | partial |
| `capacityBreakdown.items[].utilizationRate` | number | derived_value | 該類型 `safePct(預約列, 名額)` | 無，是名額率的切片 | partial |
| `capacityBreakdown.summary` | object | derived_value | 只加 `items`，不加 `byEvent` | 無 | partial |
| `capacityBreakdown.summary.reservedCount` | number | derived_value | `items.reservedCount` 加總 | 無 | partial |
| `capacityBreakdown.summary.capacity` | number | derived_value | `items.capacity` 加總 | 無 | partial |
| `capacityBreakdown.summary.utilizationRate` | number | derived_value | summary 兩數的 `safePct` | 無 | partial |
| `capacityBreakdown.byEventType` | array | breakdown | 類型聚合原列。內層依 event id，外層依 eventType | 無 | partial |
| `capacityBreakdown.byEventType[].eventType` | string | dimension | 類型鍵 | 無 | verified |
| `capacityBreakdown.byEventType[].totalEventCapacity` | number | derived_value | 對應 `items[].capacity` | 無 | partial |
| `capacityBreakdown.byEventType[].totalReservations` | number | derived_value | 對應 `items[].reservedCount` | 無 | partial |
| `capacityBreakdown.byEventType[].bookingRate` | number | derived_value | 對應 `items[].utilizationRate` | 無 | partial |
| `capacityBreakdown.byEvent` | array | breakdown | 一場一列。排序是 CAST 後的活動日、名稱、id | 無 | partial |
| `capacityBreakdown.byEvent[].eventId` | number | dimension | 活動主鍵 | 無 | verified |
| `capacityBreakdown.byEvent[].eventName` | string | dimension | 活動名稱。null 轉空字串 | 無 | verified |
| `capacityBreakdown.byEvent[].eventDate` | string | dimension | `events.date` 原始字串。篩選有 CAST，輸出沒有正規化 | 無 | partial |
| `capacityBreakdown.byEvent[].eventType` | string | dimension | 該場類型 | 無 | verified |
| `capacityBreakdown.byEvent[].maxCapacity` | number | derived_value | 該場名額 | 無 | partial |
| `capacityBreakdown.byEvent[].totalReservations` | number | derived_value | 該場 `COUNT(reservations.id)`，沒有預約則 0 | 無 | partial |
| `capacityBreakdown.byEvent[].bookingRate` | number | derived_value | 該場預約列除以該場名額。超過 100 不會被截斷 | 無 | partial |

`byEventType` 在 SQL 分組時用的是正規化前的 `eventType`。映射時空白才變成 `未分類`。若資料庫把空白與 null 分成不同群，正規化後可能出現同一個標籤的多列。這點是 UNKNOWN。

類型聚合與單場列表的分子都是預約列，不是學生數。權限是全中心路由，這支總覽沒有工作集參數。
