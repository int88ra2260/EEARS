# 跨模組測試矩陣

環境：本機 Windows，Node v24.15.0。CI 規格是 Node 20，本階段沒有在 Node 20 重跑。沒有連 MySQL。沒有為了通過而改正式程式。

警告：npm 提示未知 `devdir` 設定；Playwright 在 `FORCE_COLOR` 下忽略 `NO_COLOR`；Browserslist 資料舊 22 個月。這三項不是測試失敗。

## 結果

| 命令 | 結果 | 時間 |
|---|---|---|
| `reservation-backend`：`npm test -- --runInBand tests/analytics-contracts tests/bestepClassPassRateDecision.test.js tests/bestepClassExport.test.js tests/bestepClassAnalyticsShadow.test.js tests/bestepClassOverviewShadow.controller.test.js tests/bestepAttendanceImport.test.js tests/bestepScoreImportShadow.test.js tests/bestepScoreImportControllerShadow.test.js tests/bestepScoreImportFormat.test.js tests/analyticsOverviewShadow.test.js` | 26 suites、256 tests 通過，0 failed、0 skipped | 15.874 s |
| `reservation-frontend`：`npx vitest run` 活動總覽、出席格式化、成績表三個檔 | 3 files、25 tests 通過 | 7.59 s |
| `reservation-frontend`：`npx playwright test --config playwright.analytics.config.mjs` | 15 passed、0 failed、0 skipped | 25.8 s |
| backend `npx eslint analytics-contracts tests/analytics-contracts` | exit 0 | — |
| frontend eslint 上述頁面、表格、兩個 browser 檔 | exit 0 | — |
| `reservation-frontend`：`npm run build` | 6878 modules，exit 0 | 29.61 s |

後端那一條包含使用者指定的 `tests/analytics-contracts`，並加上評量來源所在的契約目錄、檔案品質、匯入 Shadow、班級契約、班級 Shadow、匯出、出席匯入、成績匯入與 F-BESTEP-01 決策回歸、活動 Shadow。Jest 輸出沒有把 `tests/analytics-contracts` 再拆成獨立計數；26/256 是整包。

前端 25 項是 17（活動 UX）+ 3（出席格式）+ 5（表格，含總分 0）。Playwright 15 項是活動 10 項加 BESTEP 5 項。

## 限制

- 瀏覽器攔截合成 API，沒有打到 port 3000。
- 對比度是計算值。出席 5.99、缺席 6.57、未確認 4.69、未匯入 4.69。沒有跑螢幕報讀器。
- 檔案品質測試會印一行截斷計時 JSON，是既有觀測輸出。
- 未跑整個 backend `npm test` 與整個 frontend `npm test`。範圍是分析與 BESTEP 回歸清單。
