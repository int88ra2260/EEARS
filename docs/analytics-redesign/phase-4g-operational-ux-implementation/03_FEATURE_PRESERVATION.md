# 既有功能保留

## 保留且可操作

- 學期篩選與重新整理。切換學期會用新的 `semester` 重打原本的五支請求。
- 活動趨勢折線圖，資料仍是 `trends.activityTrend[].reservationsCount`。
- 簽到趨勢折線圖，資料仍是 `events.attendanceTrend[].attendanceRate`。只改標題與提示。
- 班級 Top 10 長條圖，資料仍是 `classes.rankings[].violationRate`。
- 類型表與場次表。類型表在 API 同時給 `items` 與 `byEventType` 時，仍沿用原本邏輯，優先把 `items` 正規化成一張表，不把兩份再加一次。
- 載入中、分項錯誤、圖表錯誤、全 0 提示、查無活動提示。
- 圖表仍用既有 `ChartCard` 與 Recharts，沒有換圖表庫。

## 這頁原本就沒有

- 匯出或下載按鈕。營運報表下載仍在 `/admin/reports`，本階段沒有改那一頁，也沒有改下載內容。
- 分析類型切換。這頁繼續只送 `kind=reservation`。
- 分頁、表格列連結、系所分析。

## 顯示行為有變，數字意義沒變

- 缺少的欄位不再被 `|| 0` 顯示成 0。
- API 失敗時不畫核心 KPI，避免把錯誤看成 0%。
- 切換學期的當下先清掉上一筆總覽與圖表。
- 重疊請求只採用最後一次的結果。

## 未改的介面

- `App.js` 的 `analytics/overview` 路由。
- `adminRouteAccess.js`、`adminNavigation.js`。
- 學習成效、風險追蹤、Learning Journey 與其他分析頁。
