# 控制器與權限路徑

現役頁面是 `/admin/classes/:classId/bestep`。前端 `ClassBestepOverview` 經 `useClassBestepOverview` 與 `fetchClassBestepOverview` 呼叫概況 API。

後端掛載：

| 步驟 | 位置 |
|---|---|
| 掛載 | `server.js` 將 `adminClassesRouter` 掛在 `/api/admin/classes` |
| 登入 | `routes/adminClasses.js` 的 `router.use(authMiddleware)` 在 BESTEP 路由之前 |
| 角色 | `router.get('/:classId/bestep-overview', teacherMiddleware, getBestepOverview)` |
| 教師角色 | `requireTeacher` 允許 `admin`、`teacher`、`office_staff` |
| 班級範圍 | `controllers/bestepClassController.js` 的 `assertCanAccessClass` |
| 組裝 | `services/bestepClassService.js` 的 `getClassBestepOverview`，統計由 `buildClassBestepOverviewStatistics` 產生 |
| 送出 | 同一個 controller 的 `res.json(result)` |

`classId` 來自 `req.params`，再用 `parseInt`。學期、`examType`、`page`、`pageSize`、`search` 來自 `req.query`。沒有學期回 400。班級 ID 無法轉成數字回 400。找不到班級回 404。範圍錯誤走 `sendClassScopeDenied`。服務丟出的錯誤仍進原本的 catch，回 500，Shadow 不會先被呼叫。

匯出是相鄰路由 `/:classId/bestep-overview/export`，函式是 `exportClassBestepOverview`。它呼叫 `buildClassBestepExportData`，不經過這次的 Shadow。

Shadow 只放在概況成功之後。它不重查資料庫，也不取代 `assertCanAccessClass`。其他班級路由沒有引用這個 runtime。
