# 試點選擇與資料流

## 選定的 API

`GET /api/analytics/overview?semester={semester}&kind=reservation`

掛載路徑：

- `server.js` 第 161 行 `app.use('/api', analyticsRouter)`
- `routes/analyticsRouter.js`：`router.get('/analytics/overview', requireFullCenterAnalytics, analyticsController.getOverview)`
- `analyticsController.getOverview`：`kind` 為 `reservation` 時呼叫 `analyticsService.getReservationOverview`，否則走 `getAdminOverview`
- 前端 `pages/admin/AdminAnalyticsPage.jsx` 固定 `kind = 'reservation'`，經 `services/reportsAdminApi.js` 的 `fetchAnalyticsOverview` 呼叫

選擇這支，是因為它已經掛載，問的是活動預約與出席，而且權限是全中心行政，不是英檢達標政策。同一支 URL 在沒有 `kind=reservation` 時是另一套行政總覽，所以試點只涵蓋 `kind=reservation`。

## 計算

`getReservationOverview` 讀 `utils/semesterConstants.js`，該檔轉出 `shared/semesterConfig.js`。`114-2` 是 `2026-02-01` 到 `2026-07-31`，尾日包含在內。

主查詢把 `reservations` INNER JOIN `events`，條件是 `sqlEventDateInSemesterRange`：

`CAST(TRIM(events.date) AS DATE) BETWEEN CAST(:start AS DATE) AND CAST(:end AS DATE)`

時間欄位是 `events.date`。沒有使用 `reservations.createdAt`。

`reservations.checkinStatus` 的列舉是 `未簽到`、`已簽到`、`已登記違規`。總預約數是這三種列的 `COUNT(*)`。出席率的分子只算 `已簽到`。違規率的分子只算 `已登記違規`。沒有取消狀態欄；取消碼存在，但這段 SQL 沒有用它過濾。

名額是另一段子查詢，把區間內活動的 `maxCapacity` 加總。利用率是預約列數除以這個名額，經 `safePct` 變成百分比。

`englishPassRate` 另查 `english_test_registrations.semester`。它不是活動日區間。前端營運頁目前不顯示這個欄位，但 JSON 仍有它。

`capacityBreakdown` 來自 `getReservationCapacityBreakdown`，是巢狀的類型、場次與列數。頁面另外呼叫 `GET /api/analytics/reservation-capacity-breakdown`。那支 API 不在這次試點的欄位映射裡。

## 母體

`requireFullCenterAnalytics` 只放行 admin 或 `hasAdminRights`。沒有班級或學生名單參數。因此它和 `kpiService.getParticipationMetrics` 的「傳入名單」不是同一母體。呼叫端若自備工作集，不能把這支 API 的數字解釋成那個工作集。

## 快取

`getReservationOverview` 本身沒有呼叫 `getCache`。約五分鐘快取出現在同檔的其他總覽路徑。這支 `kind=reservation` 回應不以那份快取為準。
