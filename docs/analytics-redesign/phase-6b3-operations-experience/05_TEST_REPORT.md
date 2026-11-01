# 測試

Node v20.20.2，npm 10.8.2。工作樹 `D:/EEARS`。分支 `feature/analytics-operations-experience`。HEAD 是 Phase 6B.2 的 `0ca8867a159b04d21d73a9fd6173142fe4916d19`。以下是本次執行，不是舊日誌。

| 命令 | 時機 | 結果 |
|---|---|---|
| `npx vitest run` 觀察、總覽、Hub、出席兩檔、路由契約、側欄 | 標題改為「營運觀察」之後，Node v20.20.2 | 7 files、84 tests、16.36 s、exit 0 |
| 詞庫 `adminNavSearchGlossary` | 同階段另一次 | 3 tests、exit 0 |
| backend `npm test -- --runInBand` | 後端檔案未改 | 26 suites、256 tests、21.014 s、exit 0 |
| `npx eslint` 總覽、說明、觀察與其測試 | 標題修改之後再跑一次 | exit 0。Browserslist 過期是警告 |
| `npx vitest run` `AdminAnalyticsPage.test.jsx` 與 `operationsObservation.test.js` | 標題修改之後 | 2 files、23 tests、exit 0 |
| `npm run build` | 標題修改之後 | 6882 modules，30.83 s，exit 0 |
| `npm run test:analytics-browser` | 標題修改之後 | 24 passed、36.1 s、exit 0 |

84 項含觀察 6、總覽 17、Hub 10、路由契約 11、側欄 32、出席 helper 3、出席表 5。這次 7 files 是標題改為「營運觀察」之後的完整前端回歸。

24 個瀏覽器測試含原有活動總覽、Hub 4、BESTEP 出席 5、本階段 5。本階段掛載真正的 `AdminAnalyticsPage`，只 stub 本機 `/api/analytics/**`，其他 API abort。沒有正式學生資料，token 是 harness 用的假字串。

瀏覽器覆蓋：Hub 進入總覽、觀察文案、學期 48 改 7、總覽錯誤不出現觀察、一般教師沒有管理連結、1440／1280／768／390／375 沒有整頁橫向溢出。點「開啟活動列表」後看到的是 harness 標題「活動列表」，只證明 `href` 為 `/admin/operations`。不是正式活動管理頁，也不是登入 E2E。

後端警告仍是檔案品質計時 JSON 與 Jest `[JEST-01]`。沒有改統計公式。
