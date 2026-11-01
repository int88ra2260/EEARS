# Phase 4D 實作摘要

本階段做了三件事：把 Phase 1–4C.1 收成兩個本機提交、審查 L3 唯讀驗證草案，以及為已掛載的活動預約總覽加上獨立的契約說明。沒有改統計 SQL、沒有改 API 回應、沒有連線資料庫，也沒有 push。

## Git

- Commit 1：`b65e1df01fa5584c69d8866331d13d9e1870d3fa`
- Commit 2：`6a4215a35ec082b6a13fbca20cd63eb261530d3b`
- Phase 4D 的程式與文件留在工作區，沒有提交。

## 試點

`GET /api/analytics/overview?semester={semester}&kind=reservation`

服務是 `analyticsService.getReservationOverview`。Shadow adapter 在 `reservation-backend/analytics-contracts/pilots/activityOpsOverviewPilot.js`。它讀學期設定與既有契約，產生每個回應欄位的指標、時間欄位與母體說明，不重算數字。

## 測試

提交前，契約測試為 12 suites、97 tests，ESLint 通過。加入試點後再跑同一指令：13 suites、112 tests，ESLint 通過。新增的是 P01–P15。

## 沒有做的事

- 沒有執行 L3 SQL。
- 沒有把半開區間說成已在 MySQL 上等於舊的含尾日 `BETWEEN`。
- 沒有為違規率、名額加總或名額分項整包配上 Metric ID。
- 沒有實作正式發布或新的儀表板。
