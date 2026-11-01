# 測試

Node v20.20.2，npm 10.8.2。工作樹 `D:/EEARS`，分支 `feature/analytics-hub-mvp`，HEAD 仍是 `3288d79`。這些數字是本次執行，不是舊日誌。

| 命令 | 結果 |
|---|---|
| `npx vitest run` Hub、路由契約、側欄、詞庫、活動總覽、出席 | 7 files、81 tests、34.88 s、exit 0 |
| 其中既有活動總覽與出席 | 3 files、25 tests，含在上面 |
| 其中 Hub | `AnalyticsHubPage.test.jsx` 10 tests |
| backend `npm test -- --runInBand` 契約、班級、匯入、匯出、出席、F-BESTEP-01、活動 Shadow | 26 suites、256 tests、40.303 s、exit 0 |
| `npx eslint` Hub、路由、側欄與既有分析檔 | exit 0。Browserslist 資料過期是警告 |
| `npm run build` | 6881 modules，53.06 s，exit 0 |
| `npm run test:analytics-browser` | 19 passed、29.8 s、exit 0 |

19 個瀏覽器測試含原有 15 個與 Hub 4 個。Hub 用既有 harness 與真實 `AnalyticsHubPage`。班級列表點擊在 harness 內只證明連結到 `/admin/classes`，不是正式班級頁，也不是登入後的 E2E。

後端警告仍是檔案品質計時 JSON 與 Jest `[JEST-01]`。沒有改統計公式。
