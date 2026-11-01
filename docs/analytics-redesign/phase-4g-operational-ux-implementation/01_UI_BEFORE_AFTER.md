# 活動營運總覽：修改前與修改後

盤點對象是 `reservation-frontend/src/pages/admin/AdminAnalyticsPage.jsx`。這頁的請求種類固定為 `reservation`，沒有分析類型切換。

| 既有功能 | 修改前 | 本階段 | 標記 |
|---|---|---|---|
| 學期下拉 | `SEMESTER_OPTIONS` | 保留，並顯示所選學期與活動日期 | Retain、Add Explanation |
| 重新整理 | 有 | 保留 | Retain |
| 四張 KPI | 總預約數、預約率、簽到出席率（預約）、違規率（預約） | 改名並分成供給、需求、簽到、例外 | Relabel、Regroup、Add Explanation |
| 活動總名額 | API 有 `totalEventCapacity`，第一屏沒有獨立卡片 | 新增一張卡片，數字仍是 API 原值 | Add Explanation |
| 類型表 | 依活動類型 | 保留，欄名改為活動名額、預約筆數、預約名額比 | Retain、Relabel、Regroup |
| 場次表 | 依場次，最高約 420px 可捲動 | 保留，最後一欄改為預約名額比 | Retain、Relabel、Regroup |
| 活動趨勢圖 | 每日預約筆數 | 保留 | Retain、Relabel |
| 出席趨勢圖 | 標題為出席率 | 標題改為預約列簽到率，資料欄位不變 | Retain、Relabel |
| 班級排行 | Top 10 長條圖 | 保留，標題改為預約列違規狀態比 | Retain、Relabel |
| 系所分析 | 這頁沒有 | 沒有新增 | Not In Scope |
| 分頁 | 這頁沒有 | 沒有新增 | Not In Scope |
| 列內鑽取 | 表格列不是連結 | 沒有新增 | Not In Scope |
| 匯出 | 這頁沒有按鈕；下載在另一頁 `/admin/reports` | 這頁不新增，另一頁不修改 | Not In Scope |
| 載入、空資料、錯誤 | 有 | 保留；載入時不留上一學期數字，錯誤不顯示成 0 | Retain |
| 權限 | `/admin/analytics/overview`，`allowAdminOrExecutive` | 路由與權限檔未改 | Retain |
| 窄螢幕 | Bootstrap `col-12` | 卡片維持整列換行；學期選單 `max-width: 220px` 且寬度 100% | Retain |

## 修改後的第一屏順序

1. 學期、活動日期、母體、時間欄位。
2. 資源供給：活動總名額。
3. 預約需求：預約筆數、預約名額比。
4. 簽到與使用：預約列簽到率。
5. 行政例外：預約列違規狀態比。
6. 活動類型與場次：類型表、場次表。
7. 報名資料補充資訊：預設收合，內有報名資料 B2 標記比例。
8. 活動趨勢與班級排行：原有三張圖。

`items` 與 `byEventType` 仍只畫成一張類型表。場次表是另一種粒度，不與類型表相加。
