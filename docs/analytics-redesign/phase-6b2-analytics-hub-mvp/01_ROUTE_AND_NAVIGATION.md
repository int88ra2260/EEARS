# 路由與側欄

| 路徑 | 元件 | 這次 |
|---|---|---|
| `/admin/analytics` | `AnalyticsHubPage` | 新增 |
| `/admin/analytics/overview` | `AdminAnalyticsPage` | 保留 |
| `/admin/analytics/risk` | `RiskDetectionPage` | 保留 |
| `/admin/learning-analytics/*` | 既有 layout | 保留 |
| `/admin/classes` | `ClassOverview` | 保留，作為 BESTEP 入口 |
| `/admin/classes/:classId/bestep` | `ClassBestepOverview` | 保留，Hub 不連結 |

`App.js` 以 `path="analytics"` 掛首頁，與 `analytics/overview` 並列。`getAdminRouteAccess('/admin/analytics')` 對到首頁規則，overview 與 risk 仍對到自己的規則。

側欄區段 `analytics` 的可見性改為 `analyticsHub`，也就是 `canAccessAdminRoute(profile, '/admin/analytics')`。子項仍用原本的 `adminOnly` 或權限。因此只有學習分析權限的人看得到首頁，看不到活動總覽。

`matchPrefixes` 用最長前綴。管理員看總覽時，標題仍是「活動營運總覽」。
