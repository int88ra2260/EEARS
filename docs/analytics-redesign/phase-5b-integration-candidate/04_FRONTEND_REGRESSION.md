# 前端回歸（Node 20）

工作目錄：`D:/EEARS-phase5b/reservation-frontend`。Node v20.20.2。腳本來自 `package.json`：`test` 是 `vitest run`，`lint` 是 `eslint .`，`build` 是 `vite build`。這次沒有跑整個前端測試或整個 `eslint .`，只跑分析回歸清單。

## 單元測試

```text
npx vitest run src/pages/admin/AdminAnalyticsPage.test.jsx src/utils/classBestepDisplayHelpers.attendance.test.jsx src/components/admin/classes/ClassBestepStudentsTable.attendance.test.jsx
```

- 3 files passed
- 25 tests passed（17 活動營運、3 出席格式、5 成績表）
- Failed 0、skipped 0
- Duration 15.38 s
- Vitest 3.2.7
- exit 0

成績表測試包含總分 0。沒有改元件。

## ESLint

```text
npx eslint src/pages/admin/AdminAnalyticsPage.jsx src/pages/admin/AdminAnalyticsPage.test.jsx src/utils/classBestepDisplayHelpers.js src/components/admin/classes/ClassBestepStudentsTable.jsx src/components/admin/classes/ClassBestepStudentsTable.attendance.test.jsx browser-tests/bestepAttendance.browser.mjs browser-tests/adminAnalytics.browser.mjs
```

exit 0。Browserslist 資料舊 22 個月，是警告不是 error。

後端 `npx eslint analytics-contracts tests/analytics-contracts` 也是 exit 0。

## Build

`npm run build`：6878 modules transformed，built in 41.24 s，exit 0。產物在 gitignore 的 build 目錄，沒有提交。
