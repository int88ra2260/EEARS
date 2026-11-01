# 權限與資料最小化

學習分析路由仍只認既有的 `can_view_learning_analytics`，以及 admin／executive 的既有放行。Hub 看得到，不會因此放寬學習分析。

用真實 `buildAccessProfile` 與 `canAccessAdminRoute` 對過：

| 身分 | 資源覆蓋／技能成長 |
|---|---|
| admin | 可進入 |
| executive teacher | 可進入 |
| 一般教師，另開 `can_view_learning_analytics`，並關掉活動分析與班級 | 可進入 |
| 一般教師，只留班級檢視 | 不可進入 |
| 一般教師，只留活動分析 | 不可進入 |
| `office_staff`／`event_lead` | 不可進入 |
| 沒有 token | 不可進入 |

前端隱藏不是授權。真正擋路由的仍是既有 `getAdminRouteDeniedReason`。本階段沒有改前後端權限定義。

Hub 學習連結沒有學號 query。詳情連結是固定路徑：`/admin/learning-analytics/skills`、`offerings`、`raw-data`。瀏覽器夾具只用合成資源類型 GE／EAP，沒有學生姓名、學號或 Email。

瀏覽器測試的 API mock 只接受本機 `/api/admin/learning-analytics/`，其他 API 會中止。測試記錄沒有對 port 3000 的請求。
