# 瀏覽器 Harness

沿用 `playwright.analytics.config.mjs` 與 `vite.analyticsBrowser.config.js`。Vite 只聽 `127.0.0.1:3017`，沒有 API proxy。指令仍是 `npm run test:analytics-browser`。

Phase 4H 的 `browser-tests/index.html` 與 `main.jsx` 沒有改，活動營運頁仍掛在那裡。BESTEP 使用隔離入口：

- `browser-tests/bestep.html`
- `browser-tests/bestep-main.jsx`
- `browser-tests/bestepAttendance.browser.mjs`

入口用 `MemoryRouter` 掛上正式的 `ClassBestepOverview`，路由是 `/admin/classes/SYN-CLASS/bestep`。沒有改 `App.js`、登入或權限守衛。

`useClassBestepOverview` 會呼叫 `GET /api/admin/classes/SYN-CLASS/bestep-overview`。Playwright 攔截這個路徑並回傳合成 JSON。其他 `/api/` 與非本機 host 會被中止。

`localStorage.token` 設成測試標記 `bestep-browser-harness`。請求標頭是 `Bearer bestep-browser-harness`，不是 JWT。沒有讀取 `.env`。

Screenshot 與 trace 沿用 Playwright 設定，失敗時寫入已被 gitignore 的 `reservation-frontend/test-results/`。這次沒有把截圖加入版控。
