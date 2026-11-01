# 管理者流程

合成資料下實際走過的路徑：

1. `/admin/analytics`，元件 `AnalyticsHubPage`。
2. 點「資源覆蓋」，進入 `/admin/learning-analytics/resources`，元件 `LearningAnalyticsResourcesPage`。
3. 頁面讀 `GET /api/admin/learning-analytics/meta` 與 `GET /api/admin/learning-analytics/resources`。
4. 預設短句說明人數不是事件次數、也不是資源造成的能力提升。
5. 點「怎麼讀這頁」展開來源、空值、匿名軌跡、`evidenceLevel` 與「這支回應沒有排除原因明細」。
6. 點「開啟技能成長」，進入 `/admin/learning-analytics/skills`，元件 `LearningAnalyticsSkillsPage`。網址不帶資源頁的篩選，也不帶學號。
7. 同一組連結還可以進既有的 `/admin/learning-analytics/offerings` 與 `/admin/learning-analytics/raw-data`。瀏覽器驗收這次實際打開的詳情頁是技能成長。

Browser harness 掛上的是這三個真實元件，使用 MemoryRouter 與合成 JSON。沒有掛 `AdminLayout`、`LearningAnalyticsLayout`，也沒有連正式 API。因此這是路由與元件級驗收，不是完整登入 E2E。
