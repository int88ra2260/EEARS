# 測試

Node v20.20.2，npm 10.8.2。工作樹 `D:/EEARS`。分支 `feature/analytics-bestep-experience`。HEAD 仍是 Phase 6B.3 的 `997a89d18f99ad618d47ac626fd5776a24026046`。數字是本次執行。

| 命令 | 結果 |
|---|---|
| `npx vitest run` 觀察、總覽、Hub、出席、路由、側欄、BESTEP 體驗 | 8 files、97 tests、29.09 s、exit 0 |
| backend `npm test -- --runInBand` | 236 suites、1608 tests、170.531 s、exit 0 |
| `npx eslint` 本次 BESTEP 與 Hub 相關檔 | exit 0。Browserslist 過期是警告 |
| `npm run build` | 6883 modules，36.92 s，exit 0 |
| `npm run test:analytics-browser` | 27 passed、55.0 s、exit 0 |

97 項含 BESTEP 體驗 13、出席表 5、出席 helper 3、Hub 10、營運觀察 6、活動總覽 17、路由契約 11、側欄 32。

27 個瀏覽器測試含原有活動總覽、Hub、BESTEP 出席、營運觀察，以及本階段 3 個。本階段掛上真正的 `AnalyticsHubPage`、`ClassOverview`、`ClassBestepOverview`。API 只回合成 JSON，其他 API abort。

驗收層級是 `ROUTE_BROWSER_ACCEPTED`。MemoryRouter 不改瀏覽器網址列。Harness 沒有登入，也沒有 `AdminLayout` 守衛。不是完整 E2E。

空資料與錯誤時，表格裡沒有「缺席」。讀法區仍會解釋四個出席詞，所以整頁文字檢索會看到「缺席」這個詞。錯誤警示沿用既有對應，測試確認它不是 150% 或 0% 的通過比例。

後端警告仍是檔案品質計時 JSON 與 Jest `[JEST-01]`。這次跑的是整個後端 Jest，不是以前那組 26 suites。
