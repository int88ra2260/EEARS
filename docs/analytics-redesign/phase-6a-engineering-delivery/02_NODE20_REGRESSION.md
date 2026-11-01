# Node 20 回歸（本次重跑）

工作樹：`D:/EEARS-phase5b`，SHA `15974e0`。執行檔：`C:\Users\int88\AppData\Local\node-v20.20.2-win-x64\node.exe`。Node v20.20.2，npm 10.8.2。這不是沿用 Phase 5B 的舊日誌。

| 命令 | 結果 |
|---|---|
| backend `npm test -- --runInBand` 加上契約、班級、匯入、匯出、出席、F-BESTEP-01、活動 Shadow | 26 suites、256 passed、0 failed、14.858 s、exit 0 |
| `npx vitest run` 活動總覽、出席格式、成績表 | 3 files、25 passed、13.59 s、exit 0 |
| backend eslint `analytics-contracts` 與測試 | exit 0 |
| frontend eslint 上述頁面與兩個 browser 檔 | exit 0。Browserslist 資料過期是警告 |
| `npm run build` | 6878 modules，38.15 s，exit 0 |
| `npm run test:analytics-browser` | Playwright 1.64.1，15 passed，29.9 s，exit 0 |

警告：檔案品質計時 JSON、Jest `[JEST-01]`。沒有失敗。沒有改程式。

與 `174beeb` 的差異只有 `phase-5b*` 與 `phase-5b1*` 文件，所以這次結果適用於 Release Candidate 的程式。整合進 `main` 之後仍要在該樹上再跑一次。
