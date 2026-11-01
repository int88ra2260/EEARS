# Node 20 證據與整合後測試

## 已有證據

證據寫在 `docs/analytics-redesign/phase-5b-integration-candidate/`，提交為 `c811680`。測試當時的程式樹是父提交 `15974e0`，工作樹 `D:/EEARS-phase5b`。

| 項目 | 結果 |
|---|---|
| Node | v20.20.2 |
| npm | 10.8.2 |
| Backend | 26 suites、256 passed、0 failed、0 skipped、16.149 s |
| Frontend unit | 3 files、25 passed |
| Playwright | 1.64.1，15 passed，43.2 s |
| ESLint | 所列分析檔案 exit 0 |
| Build | 6878 modules，41.24 s，exit 0 |

`git diff 15974e0 c811680` 只有 11 個 Markdown。`package.json` 與兩份 lockfile 沒有再變。因此不把這次文件提交說成「又跑了一次測試」，也不要求為了這 11 個檔重跑整組。程式與依賴仍對應該次 Node 20 執行。

限制：不是完整後端或完整前端測試；不是 Node 20 的 CI runner；沒有 L3；Jest 有 `[JEST-01]` 警告但測試通過。

## 整合之後要重跑

在新的 `main` 樹上、Node v20.20.2：

```text
cd reservation-backend
npm test -- --runInBand tests/analytics-contracts tests/bestepClassPassRateDecision.test.js tests/bestepClassExport.test.js tests/bestepClassAnalyticsShadow.test.js tests/bestepClassOverviewShadow.controller.test.js tests/bestepAttendanceImport.test.js tests/bestepScoreImportShadow.test.js tests/bestepScoreImportControllerShadow.test.js tests/bestepScoreImportFormat.test.js tests/analyticsOverviewShadow.test.js
```

```text
cd reservation-frontend
npx vitest run src/pages/admin/AdminAnalyticsPage.test.jsx src/utils/classBestepDisplayHelpers.attendance.test.jsx src/components/admin/classes/ClassBestepStudentsTable.attendance.test.jsx
npx eslint src/pages/admin/AdminAnalyticsPage.jsx src/pages/admin/AdminAnalyticsPage.test.jsx src/utils/classBestepDisplayHelpers.js src/components/admin/classes/ClassBestepStudentsTable.jsx src/components/admin/classes/ClassBestepStudentsTable.attendance.test.jsx browser-tests/bestepAttendance.browser.mjs browser-tests/adminAnalytics.browser.mjs
npm run build
npm run test:analytics-browser
```

後端契約目錄的 eslint 也要再跑一次。這些命令留到授權後的整合，這次沒有執行。
