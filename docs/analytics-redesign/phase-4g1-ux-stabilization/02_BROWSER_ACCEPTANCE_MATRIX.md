# 瀏覽器驗收矩陣

狀態：`BLOCKED`。沒有執行真實瀏覽器，也沒有建立 `MOCKED_BROWSER_ACCEPTANCE`。

## 環境檢查

| 項目 | 結果 |
|---|---|
| Playwright / Cypress | `reservation-frontend/package.json` 沒有這些 script 或依賴 |
| Cursor 瀏覽器工具 | 工作階段有瀏覽器工具 |
| 本機前端 `127.0.0.1:3001` | 上一階段檢查時無法連線；本階段沒有另起伺服器 |
| 本機 API `127.0.0.1:3000` | 同上 |
| 管理端測試帳號 | 沒有讀取 `.env` 或憑證，因此沒有可用帳號 |

活動營運頁在登入後的管理版面裡。沒有帳號就看不到這頁，所以沒有截圖，也沒有把登入頁當成驗收。

## Viewport

| 類型 | 尺寸 | 結果 |
|---|---|---|
| Desktop | 1440 × 900 | BLOCKED |
| Laptop | 1280 × 800 | BLOCKED |
| Tablet | 768 × 1024 | BLOCKED |
| Mobile | 390 × 844 | BLOCKED |
| Small mobile | 375 × 667 | BLOCKED |

未檢查：第一屏排列、水平溢出、日期是否被切掉、說明是否遮擋、圖表實際尺寸、Loading / Empty / Error 的真實版面。

## 可重現步驟

1. 啟動後端與前端開發伺服器。
2. 使用授權的管理端測試帳號登入。
3. 打開 `/admin/analytics/overview`。
4. 依上表五種 viewport 檢查整頁，不只第一屏。
5. 切換學期、按重新整理、展開指標說明與報名補充區。
6. 對照 API 原值，不要把畫面上的百分比再算一次。

jsdom 裡的元件測試不能代替上述步驟。
