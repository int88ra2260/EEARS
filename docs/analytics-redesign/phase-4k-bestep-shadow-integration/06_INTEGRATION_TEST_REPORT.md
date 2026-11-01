# 測試

Runtime：`tests/analytics-contracts/bestepFileQualityShadowRuntime.test.js`。

匯入邊界：`tests/bestepScoreImportShadow.test.js`。用合成 xlsx，mock `sequelize.transaction`、`BestepExamScore.upsert` 與 `findRegistrationForSemester`。沒有連 MySQL。

Controller：`tests/bestepScoreImportControllerShadow.test.js`。mock `importScoreData`、`runSync` 與 rebuild。比較 flag 開與關。

| ID | 結果 |
|---|---|
| K01 | 未設 flag、`TRUE`、只有 `NODE_ENV=test` 都是關 |
| K02 | `NODE_ENV=production` 即使 flag 為 `true` 也不跑 |
| K03 | flag 關時 `importScoreData` 不呼叫 observe |
| K04 | `test` + 字串 `true` 會評估 |
| K05 | 同一份三列 xlsx，開與關的 imported、skipped、error code 相同。Controller JSON 除錯誤檔名的時間戳外相同 |
| K06 | 缺檔 400。`importScoreData` reject 時 500，body `{ error: 'boom' }` |
| K07 | `MIS1` 仍是一筆 `STUDENT_NOT_FOUND`，imported 2、skipped 1 |
| K08 | upsert 次數在開與關各為成功列數，沒有多一次 |
| K09 | `imported > 0` 時 `runSync` 仍各排程一次 |
| K10 | observe 丟錯時 commit 結果仍回傳 |
| K11 | `findRegistrationForSemester` 次數不因 shadow 增加 |
| K12 | 每次匯入 `XLSX.readFile` 一次，shadow 不再讀檔 |
| K13 K14 | 凍結的原始列在評估後 JSON 不變 |
| K15 K16 K17 | attendance、projection、import history 是 `not_observed` |
| K18 | 450 列評估 200，total 450，truncated true |
| K19 | 2 列不截斷 |
| K20 | 沒有 rows 時 total 與 accepted 都是 null |
| K21 | index 210 的非法 CEFR 不進入 finding。`wholeFileInference` false |
| K22 | raw、accepted、skipped 的 selectionMethod 分開 |
| K23 | 診斷 JSON 不含合成學號、姓名、email |
| K24 | 預設不 `console.info`。log flag 開啟時一行且不含學號 |
| K25 | 路由仍是 `englishTestDomainMiddleware` + `upload.single('file')` + `importScores` |
| K26 | `importAttendanceData` 函式本體沒有 observe 呼叫 |
| K27 | 報名 router 沒有這個 flag |
| K28 | KPI service 沒有這個 flag。32 / 9 / 7 / 11 pending 仍在 |
| K29 | 回應鍵維持 success、semester、importBatchId、imported、skipped、errors、errorFileUrl、analyticsPromoteScheduled、analyticsPromoteHint |
| K30 | commit reject 仍 throw，而且尚未呼叫 observe |

另外：口說 0 分不產生 `SKILL_SCORE_MISSING`。raw `B2+` 與 accepted 的折疊會產生 `SOURCE_INFORMATION_LOSS`，診斷不含 `B2+`。
