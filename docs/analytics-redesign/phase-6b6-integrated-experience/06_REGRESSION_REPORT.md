# 回歸報告

Node 為可攜版 v20.20.2。命令都先把這個 Node 放進該次 shell 的 PATH。沒有改系統 PATH。

## 前端單元

```bash
npx vitest run src/pages/admin/learningExperience.test.jsx src/pages/admin/AnalyticsHubPage.test.jsx src/pages/admin/operationsObservation.test.js src/pages/admin/AdminAnalyticsPage.test.jsx src/pages/admin/LearningJourneyDashboardPage.test.jsx src/components/admin/classes/classBestepExperience.test.jsx src/components/admin/classes/ClassBestepStudentsTable.attendance.test.jsx src/utils/classBestepDisplayHelpers.attendance.test.jsx src/constants/adminNavigation.test.js src/constants/adminRouteAccess.contract.test.js src/services/learningJourneyRosterContract.test.js src/components/learningJourneyTimeline/LearningJourneyTimeline.test.jsx
```

12 files，115 tests，exit 0，約 36.42s。比 Phase 6B.5 的 114 多 1 項，是 Hub 返回連結的單元測試。

## Playwright

`npm run test:analytics-browser`：35 passed，約 1.1 分鐘，exit 0。其中整合檔 5 題。

## 後端

完整 Jest **沒有重跑**。標記：`FULL_BACKEND_REGRESSION_NOT_RUN`。不沿用先前 236 suites／1608 tests。

這次實際執行：

```bash
npx jest tests/analytics-contracts --runInBand
```

17 suites，208 tests，exit 0，約 6.79s。

```bash
npx jest tests/lvaAnalyticsService.test.js tests/lvaMethodsUpgrade.test.js tests/security/learningAnalyticsAuth.test.js tests/analyticsAdminOnly.test.js --runInBand
```

4 suites，57 tests，exit 0，約 4.16s。

這些檔案本階段沒有修改。沒有連正式資料庫。

## ESLint 與 build

`npx eslint` 針對本階段前端檔，exit 0。只有既有的 Browserslist 資料過舊提示。

`npm run build`：6886 modules，32.49s，exit 0。
