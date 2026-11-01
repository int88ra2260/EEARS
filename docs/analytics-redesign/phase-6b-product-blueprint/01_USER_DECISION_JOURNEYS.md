# 管理者要做的事

| 誰 | 要決定什麼 | 現在去哪裡 | 缺口 |
|---|---|---|---|
| 主任／executive（`hasAdminRights`） | 這學期活動供給是否夠、哪類活動預約高或出席低 | `/admin/analytics/overview`，API `GET /api/analytics/overview?kind=reservation` | 頁面有數字，但沒有一頁把「可信」與「待核准」放在一起 |
| 行政 | 違規與高風險追蹤 | `/admin/analytics/risk`，權限同為 admin／executive | 風險頁不是這次改版範圍，公式未重審 |
| 老師 | 看自己的班級與教學 | `/admin/teachers/dashboard`，`can_view_analytics` 或 `can_view_classes` | 不應看到全中心母體 |
| 班級教師 | 這班 BESTEP 報名與到考 | `/admin/classes/:classId/bestep` | 通過率語意未決；未知出席已在分支上改顯示 |
| 學習歷程授權者 | 學生接觸與歷程 | `/admin/learning-analytics/*`，權限 `can_view_learning_analytics` | 與活動頁的學期定義不同，不能共用一個未標明的篩選 |
| 匯出權限者 | 下載既有報表 | `/admin/reports`，`can_export_reports` | 匯出未知出席仍是空白 |

工讀生 `bestep_ops` 的預設入口是 `/admin/english-tests`，不是中心分析。副主任與行政人員依 `adminNavigation.js` 不能進營運總覽。
