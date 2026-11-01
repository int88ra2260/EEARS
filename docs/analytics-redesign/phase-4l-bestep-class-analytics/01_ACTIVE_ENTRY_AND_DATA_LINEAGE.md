# 現役入口

`/admin/bestep/import` 會導去匯入頁。班級分析不是那條。

| 節點 | 證據 |
|---|---|
| Route | `reservation-frontend/src/App.js` 的 `classes/:classId/bestep` 渲染 `ClassBestepOverview` |
| 頁面 | `pages/admin/ClassBestepOverviewPage.js` 轉呼叫 `components/ClassBestepOverview.js` |
| 權限 | 前端 `adminRouteAccess.js` 要 `CAN_VIEW_CLASSES`、`CAN_MANAGE_CLASSES` 或 `CAN_EXPORT_BESTEP` 之一。後端 `routes/adminClasses.js` 先 `authMiddleware`，路由再 `teacherMiddleware`（`requireTeacher`：admin、teacher、office_staff）。Controller 再 `assertCanAccessClass` |
| 客戶端 | `hooks/useClassBestepOverview.js` 呼叫 `services/classAdminApi.js` 的 `fetchClassBestepOverview` |
| API | `GET /api/admin/classes/:classId/bestep-overview` |
| Controller | `controllers/bestepClassController.js` `getBestepOverview` |
| Service | `services/bestepClassService.js` `getClassBestepOverview` 與 `buildClassBestepOverviewStatistics` |
| 匯出 | 同頁 `exportClassBestepOverview`，`GET .../bestep-overview/export`，`buildClassBestepExportData` |

`server.js` 把 router 掛在 `/api/admin/classes`。

統計讀取：

- `Class`、`ClassMembership`：班級與查詢學期名冊。
- `EtEnrollmentSnapshot`：`loadSemesterRosterMap`，判斷本國生。
- `EnglishTestRegistration`：`pickLatestRegistrationPerStudent`。
- `BestepAttendance`：以 `examType` 成鍵。
- `BestepExamScore`：同一學生多列時，`findAll` 的後列覆寫前列，順序沒有另外指定。
- 團體名次來自 `BestepTeamRanking`，不是技能來源。

學生表吃 search、分頁與 `examType`。卡片統計另查全班，而且 `applyExamFilter: false`。回應沒有把查詢學期原樣放進 `statistics`。`classInfo.semester` 是 `classes.semester`。
