# 權限與授權

前端規則仍來自 `canAccessAdminRoute`／`getAdminRouteDeniedReason`。沒有改後端權限或 JWT 驗證。

| 身分 | Hub | 營運總覽 | 班級 | 學習資源 |
|---|---|---|---|---|
| Admin | 允許 | 允許 | 允許 | 允許 |
| Executive | 允許 | 允許 | 允許 | 允許 |
| Class-only | 允許 | 拒絕（AccessDenied） | 允許 | 拒絕 |
| Learning-only | 允許 | 拒絕 | 拒絕（含 BESTEP deep link） | 允許 |
| Operations-only | 允許，但無可用入口 | 拒絕（主要入口不是連結） | 拒絕 | 拒絕 |
| No permission（event_lead） | 前端若進得了則無入口；正式側欄本來就不顯示 Hub | 拒絕 | 拒絕 | 拒絕 |
| Unauthenticated | 導向 `/login?next=` | 同左 | 同左 | 同左 |

空入口處理：可開 Hub 但三個領域都沒有允許連結時，顯示「目前沒有可用分析入口」。未放寬 `allowAdminOrExecutive` 的營運總覽規則。

後端授權：完整 Jest 236 suites／1608 tests 通過，其中含既有 Learning Analytics 與 admin analytics 權限測試。瀏覽器測試只驗證前端守衛。
