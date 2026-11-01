# 尚未驗證與下一步

## 資料

L3 的 V01–V07 都還沒執行。活動營運試點直接相關的是 V05 與 V06。V01、V02、V03、V04、V07 服務的是成績來源，不改變這次的預約數字。

## 試點缺口

- `violationRate`、`totalEventCapacity`、`capacityBreakdown`、`semester` 維持 unmapped。
- `GET /api/analytics/reservation-capacity-breakdown` 與趨勢、班級排行是鄰近 API，這次沒有逐欄映射。
- 沒有 `kind=reservation` 時的 `getAdminOverview` 是另一套語意，不能沿用這份欄位表。
- D1–D11 仍全部 pending。這次沒有改達標定義，也沒有處理雙軌英檢。

## 若要接上正式流程

下一階段若要把說明放到回應或頁面，必須另測所有消費端。目前 `AdminAnalyticsPage` 直接讀 `totalReservations`、`bookingRate`、`attendanceRate`、`violationRate`。在那之前，說明只能留在這個內部模組。

也不要為了讓半開區間與舊 SQL 一致而修改 `sqlEventDateInSemesterRange`。等 V06 的筆數之後再決定文件要不要補充尾日列數。

## 建議的 Phase 4D 提交

尚未提交。建議訊息：

`feat(analytics): describe reservation overview with shadow contracts`

範圍只含：

- `reservation-backend/analytics-contracts/index.js`
- `reservation-backend/analytics-contracts/pilots/activityOpsOverviewPilot.js`
- `reservation-backend/tests/analytics-contracts/activityOpsOverviewPilot.test.js`
- `docs/analytics-redesign/phase-4d-first-vertical-slice/`

不要把 `.mysql-data/`、SQL dump 或 `presentation-build/` 放進去。這一步需要另外授權。

本階段到此停止。
