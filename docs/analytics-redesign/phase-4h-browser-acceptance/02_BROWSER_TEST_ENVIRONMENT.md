# 瀏覽器測試環境

## 為什麼用獨立 harness

正式 `/admin/analytics/overview` 走管理路由守衛。本階段不關閉守衛、不改 JWT、不寫入測試帳號。Harness 用 `MemoryRouter` 直接掛上真實 `AdminAnalyticsPage`，outlet token 固定為字串 `analytics-browser-harness`。這個字串不是 JWT，也沒有從 `.env` 讀取。

Vite 設定是 `vite.analyticsBrowser.config.js`，只聽 `127.0.0.1:3017`，沒有把 `/api` 代理到 port 3000。正式 `vite.config.js` 的 Vitest 區塊沒有修改。正式 production build 的進入點仍是 `index.html`，不包含這個 harness。

Harness HTML 不載入正式站字型或 Open Graph 網址，避免測試期間連到正式網域。版面使用專案內的 Bootstrap、`index.css` 與 `design-system.css`。

## 執行

```bash
cd reservation-frontend
npm run test:analytics-browser
```

Playwright 會先啟動上述 Vite，再啟動 headless Chromium。等待圖表時使用 `expect.poll` 檢查 `.recharts-surface` 數量與容器寬度，不使用固定 sleep。

## 請求隔離

1. 非 `127.0.0.1` / `localhost` 的請求直接 abort，並記入 blocked。
2. `/api/` 底下只允許五個既有 analytics 路徑：overview、reservation-capacity-breakdown、trends、events、classes。
3. 其他路徑以 599 擋下並記入 blocked。
4. 測試斷言 blocked 為空，且 Authorization 是 `Bearer analytics-browser-harness`。

React StrictMode 在開發伺服器會讓初次載入打兩次 API。測試檢查的是學期與次數增加，不把筆數加總進畫面。

## Fixture

全部是合成欄位，沒有學生姓名、學號或正式紀錄。

- Normal：名額 80、預約 48、預約名額比 60、簽到 75、違規狀態比 2.5、B2 標記 11；一列類型、一列場次、兩點趨勢、10 個短班名。
- Zero：上述數字皆為 0，分項與圖表陣列為空。
- Null：overview 只有學期，其餘欄位省略，陣列為空。
- Error：overview HTTP 500，body `{ error: "總覽載入失敗" }`。
- Inconsistent：`totalReservations: 1`、`totalEventCapacity: 100`、`bookingRate: 33.33`。

切到 `114-1` 時，合成預約筆數改為 7、場次名稱改為「週二桌」，用來確認畫面跟著新回應更新。
