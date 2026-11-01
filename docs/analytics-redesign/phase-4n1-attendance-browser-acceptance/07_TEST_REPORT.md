# 測試報告

Playwright：`npx playwright test --config playwright.analytics.config.mjs`。15 passed、0 failed、0 skipped。其中 10 條是 Phase 4H，5 條是 BESTEP。出席狀態那一條在加上對比日誌後又跑過一次。

前端單元：兩個出席測試檔，8 tests passed。後端 `npm test -- --runInBand` 涵蓋 analytics contracts、通過率決策、匯出、Shadow、controller 與出席匯入：22 suites、236 tests passed。相關 ESLint 0 errors、0 warnings。`npm run build` 成功，約 28.5 秒。

| ID | 狀態 | 說明 |
|---|---|---|
| N1-01–N1-10 | Passed | 真實頁面與八種合成列，含四科、抵免、未報名與總分 0 |
| N1-11–N1-16 | Passed | 五種 viewport；頁面溢出 0；窄螢幕表格可局部捲動 |
| N1-17 | Passed | 四種狀態都有文字 |
| N1-18 | Passed | 對比 5.99、6.57、4.69、4.69 |
| N1-19–N1-21 | Passed | 分頁、搜尋、考試類型、空狀態 |
| N1-22 | Passed | 500 時有 alert，沒有學生列 |
| N1-23 | Passed for backend only | 瀏覽器沒有執行匯出下載。後端 `bestepClassExport.test.js` 通過。不把瀏覽器匯出標成通過 |
| N1-24–N1-26 | Passed | 沒有正式網路、沒有 JWT、頁面沒有 `@` |
| N1-27 | Passed | Phase 4H 十條瀏覽器測試通過 |
| N1-28 | Passed | 出席單元測試 8 條通過 |
| N1-29 | Passed | `npm run build` 成功，6878 modules |
| N1-30 | Passed | `bestepClassPassRateDecision.test.js` 仍期待 Legacy 150%，公式未改 |

螢幕報讀器：Pending。Staging 與正式資料：Pending。
