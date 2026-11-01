# 瀏覽器回歸（Node 20）

工作目錄：`D:/EEARS-phase5b/reservation-frontend`。

- Node v20.20.2
- 命令：`npm run test:analytics-browser`
- 實際腳本：`playwright test --config playwright.analytics.config.mjs`
- Playwright：Version 1.64.1
- 套件宣告的 Chromium：156.0.8078.4（`playwright-core/browsers.json`）
- 15 passed、0 failed、0 skipped
- 43.2 s
- exit 0

10 項在 `browser-tests/adminAnalytics.browser.mjs`，5 項在 `browser-tests/bestepAttendance.browser.mjs`。後者掛載真正的 `ClassBestepOverview`。沒有升級 Playwright。

## 隔離

兩個測試檔都把非 `127.0.0.1` / `localhost` 的請求 `route.abort()`，並中止不是指定合成路徑的 API。斷言 authorization 不含 `eyJ`。測試沒有讀 `.env`。`.gitignore` 含 `/test-results` 與 `/playwright-report`。沒有把瀏覽器二進位、截圖、trace 或影片加進 Git。

這是合成 harness。它不代表 L3，也不代表正式環境已更新。
