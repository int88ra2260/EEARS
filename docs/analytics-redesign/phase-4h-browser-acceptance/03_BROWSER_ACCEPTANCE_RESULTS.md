# 瀏覽器驗收結果

最終執行：Playwright 10 passed / 0 failed / 0 skipped。瀏覽器為 Chrome for Testing 156.0.8078.4。第一次完整執行時 H04 因瀏覽器把 HTTP 500 記成 console error 而失敗；頁面本身已顯示錯誤訊息且沒有 KPI。其後把「未捕捉 page error」與「預期中的 500 網路日誌」分開，最終執行通過。這不是畫面缺陷。

| ID | 結果 | 證據 |
|---|---|---|
| H01 | Passed | Normal fixture 顯示 48、80、60.0%，114-2 日期為 2026/02/01–2026/07/31 |
| H02 | Passed | 0、0.0%，以及「皆為 0」「查無活動資料」 |
| H03 | Passed | 缺值顯示「—」，畫面上沒有 0.0%、NaN、Infinity、undefined |
| H04 | Passed | Alert「總覽載入失敗」，核心 KPI 不存在 |
| H05 | Passed | 預約名額比顯示 33.3%，不是 1.0% |
| H06 | Passed | 三張圖的標題與 SVG 都在 |
| H07 | Passed | 見 `04_RECHARTS_VALIDATION.md` 的實測尺寸 |
| H08 | Passed | 類型表含 English Table 與「活動類型」 |
| H09 | Passed | 場次表含「週一桌」與「活動名稱」 |
| H10 | Passed | 五個 viewport 的 page overflow 都是 0 |
| H11 | Passed | 五個說明按鈕可用 Tab、Enter、Space，焦點留在按鈕 |
| H12 | Passed | B2 補充預設收合，Enter 展開、Space 收合，不在核心 KPI 內 |
| H13 | Passed | 切學期後舊 KPI 消失，載入中出現，新回應才顯示 7 或 48 |
| H14 | Passed | 重新整理仍是 114-2，再次請求，數值仍是 48 與 80 |
| H15 | Passed | 錯誤狀態沒有 0.0% |
| H16 | Passed | Normal 頁沒有 console error、page error 或 `width(-1)` |
| H17 | Passed | 請求授權標頭是 harness 字串，不是 JWT |
| H18 | Passed | blocked 請求清單為空，頁面 URL 停在 127.0.0.1:3017 |
| H19 | Passed | 只打到五個既有 analytics 路徑；overview 與 trends 帶 `kind=reservation`。後端檔案無 diff |
| H20 | Passed | 沒有場次數、取消率、不重複學生標題，也沒有 `ops-value-event-count` |

Viewport：1440×900、1280×800、768×1024、390×844、375×667。每個尺寸都檢查了學期、日期、四個 KPI 區、B2、兩張表、三張圖與整頁橫向溢出。

本機截圖在 `reservation-frontend/browser-tests/evidence/`，內容是合成資料。該目錄已 gitignore，不進入版控。
