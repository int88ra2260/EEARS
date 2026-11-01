# 跨領域導覽

路由以 `reservation-frontend/src/App.js` 與 `adminRouteAccess.js` 為準。Hub 不組班級 BESTEP 網址，也不把營運學期帶進另外兩個領域。

| 領域 | Hub 主要入口 | 詳情 | 元件 | 統計單位 | 時間 |
|---|---|---|---|---|---|
| 中心營運 | `/admin/analytics/overview` | `/admin/operations` 等既有管理頁 | `AdminAnalyticsPage` | 活動名額、預約列 | 活動日期 |
| BESTEP | `/admin/classes` | `/admin/classes/:classId/bestep`，學生明細是既有 modal | `ClassOverview`、`ClassBestepOverview` | 該班報名、出席、技能分 | 班級學期與測驗資料 |
| 學習參與 | `/admin/learning-analytics/resources` | `/admin/learning-analytics/skills` | `LearningAnalyticsResourcesPage`、`LearningAnalyticsSkillsPage` | 不重複人數、事件、測驗觀察 | 各來源自己的時間契約 |

## 三條流程

1. Hub「活動營運總覽」→ 營運觀察 →「開啟活動列表」`/admin/operations`。Harness 把活動列表掛成標題「活動列表」，不是正式活動管理頁。
2. Hub「班級列表」→ 該列「查看 BESTEP 分析」→「查看詳情」modal →「返回成效分析中心」。`返回班級列表` 仍回到 `/admin/classes`。
3. Hub「資源覆蓋」→「開啟技能成長」`/admin/learning-analytics/skills` →「返回成效分析中心」。返回的 `href` 是 `/admin/analytics`，沒有 query。

次要入口維持原路由：高風險追蹤、營運報表、個人軌跡、課／師／活動、能力總覽。沒有權限時顯示「沒有權限」，不做成可點連結。

## 沒有做的導覽

- 沒有新的麵包屑框架。頁面內用既有返回與這次的 Hub 返回。
- 沒有全域學期篩選。三個時間定義保持各頁自己的狀態。
- 沒有把 `/admin/classes/:classId` 班級明細放進這次的 BESTEP 流程。
