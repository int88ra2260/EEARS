# 發布前狀態

三種狀態不能互相代替。

## Engineering Ready

可以視為工程測試通過，還不是部署驗收。

- Vitest：17 passed，連續 3 次，0 failed，0 skipped。
- 沒有 React `act(...)` warning。
- ESLint：目標三個前端檔 exit 0。只有既有 Browserslist 資料過期提示。
- `npm run build`：exit 0，Vite `built in 20.77s`。
- 沒有改 API、SQL、權限或其他分析頁。

## UX Accepted

Pending。

真實瀏覽器、五種 viewport、圖表像素與螢幕報讀都沒有做。鍵盤只在 jsdom 驗證。

## Data Validated

Pending。

沒有執行 L3，也沒有查資料庫。隱藏場次佔比、違規表同步與日期邊界仍待驗證。

## 阻擋

- 沒有可登入的本機管理端。
- 沒有授權的測試帳號。
- 沒有既有 E2E script。

## 建議的下一步

先用授權測試帳號在本機打開 `/admin/analytics/overview`，依 `02_BROWSER_ACCEPTANCE_MATRIX.md` 的 viewport 做一次人工驗收。不要在那之前把這個介面標成 UX Accepted 或 Data Validated。
