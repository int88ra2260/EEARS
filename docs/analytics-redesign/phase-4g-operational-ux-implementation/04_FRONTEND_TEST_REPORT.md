# 前端測試報告

## 指令與結果

| 指令 | 結果 |
|---|---|
| `npx vitest run src/pages/admin/AdminAnalyticsPage.test.jsx` | 1 個檔案、14 項測試通過，0 失敗 |
| `npx eslint src/pages/admin/AdminAnalyticsPage.jsx src/pages/admin/AdminAnalyticsPage.test.jsx src/pages/admin/activityOpsPresentation.js` | exit 0。沒有印出檔案級 error 或 warning。載入時有既有的 Browserslist「caniuse-lite 已 22 個月」提示 |
| `npm run build` | exit 0。Vite 6.4.3，6878 modules，`built in 54.27s` |

U11 仍會在 stderr 印出 React `act(...)` warning。測試斷言通過。這是測試更新時序的警告，不是頁面把上一學期數字留在畫面上。

後端本階段沒有再改。Phase 4F 提交前已跑：

`npm test -- --runInBand tests/analytics-contracts/activityOpsShadowValidator.test.js tests/analyticsOverviewShadow.test.js`

2 suites、31 tests 通過。沒有重跑全部資料庫整合測試。

## 測試對照

| ID | 結果 | 怎麼確認 |
|---|---|---|
| U01 | 通過 | `ops-value-reservations` 為 API 的 10 |
| U02 | 通過 | 預約名額比顯示 25.0% |
| U03 | 通過 | 預約列簽到率顯示 50.0% |
| U04 | 通過 | 活動總名額顯示 40 |
| U05 | 通過 | 違規狀態比顯示 5.0% |
| U06 | 通過 | 核心 KPI 區沒有「報名資料 B2 標記比例」 |
| U07 | 通過 | 補充區看得到該名稱、12.5%，以及未 JOIN 的說明 |
| U08 | 通過 | 內文與學期選單都是 114-2 |
| U09 | 通過 | 顯示文字等於 `SEMESTER_RANGES` 格式化結果；頁面與文案檔沒有寫死 `2026/02/01` 或 `2026-02-01` |
| U10 | 通過 | 改選 114-1 後，overview 與 trends 以新學期再請求 |
| U11 | 通過 | 改學期後 777 消失，狀態為載入中，且不畫 KPI。另有 act warning |
| U12 | 通過 | 顯示「總覽載入失敗」，沒有 KPI，也沒有 0.0% |
| U13 | 通過 | null 為「—」，bookingRate 0 為 0.0%，且不出現「皆為 0」 |
| U14 | 通過 | 類型表只有一列資料；預約筆數是 10，畫面上沒有加總出的 20 |
| U15 | 通過 | 三張圖的標題都在 |
| U16 | 通過 | 類型表與場次表都在，場次名稱「週一桌」在 |
| U17 | 通過 | 學期選單可用，含 114-1 選項 |
| U18 | 通過 | 這頁沒有匯出或下載按鈕；重新整理仍在。沒有新增匯出 |
| U19 | 部分 | jsdom 中說明按鈕可 focus，點擊後 `aria-expanded` 變 true 並出現限制文字。沒有在真實瀏覽器按 Enter |
| U20 | 部分 | 這頁沒有分析類型選單，overview 的 kind 都是 `reservation`。其他分析頁沒有另跑畫面測試，只確認本階段沒改那些檔 |
| U21 | 通過 | overview、breakdown、trends、events、classes 的參數與改前相同 |
| U22 | 通過 | API `bookingRate` 33.33 顯示 33.3%，沒有改顯示成 1/100 |
| U23 | 部分 | 只檢查 `col-12`、選單 `w-100` 與 `max-width: 220px`。沒有真實視窗寬度 |
| U24 | 通過 | 收合狀態下沒有場次數、不重複學生、取消率 |
| U25 | 部分 | 讀取現有 `App.js` 與 `adminRouteAccess.js`，路由字串仍在。這兩份檔案本階段沒有修改 |

Build 成功只代表打包通過，不是視覺驗收。
