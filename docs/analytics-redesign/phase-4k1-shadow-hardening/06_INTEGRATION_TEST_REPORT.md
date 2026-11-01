# K1 測試

既有 K01–K30 斷言仍在。新增：

| ID | 結果 |
|---|---|
| K1-01 | raw 的 `sourceStage` 是 `parsed_worksheet_rows` |
| K1-02 | `originalFileFidelity=not_verified`。`SOURCE_INFORMATION_LOSS` 在 shadow 是 `undetermined`，離線報告仍是 `contract_only` |
| K1-03 | accepted stage 與 raw 不同，筆數也可以不同 |
| K1-04 | `validatedRowCount` 是 null。`upsertSucceededRowCount` 用 `imported` |
| K1-05 | 服務在 commit 後傳 `commitSucceeded: true`，診斷才有 `committedRowCount` |
| K1-06 | commit reject 不呼叫 observe |
| K1-07 | rollback 路徑沒有 committed 診斷 |
| K1-08 | snapshot throw 收成 `SHADOW_INTERNAL_ERROR`，匯入筆數仍在 |
| K1-09 | mapping throw 同上，stage 是 `input_mapping` |
| K1-10 | validator throw 同上 |
| K1-11 | sanitizer throw 同上 |
| K1-12 | logger throw 仍回傳原診斷 |
| K1-13 | thenable rejection 被收住，沒有 unhandledRejection。現役路徑仍是同步 |
| K1-14 | `XLSX.readFile` throw 仍以原訊息失敗，且不呼叫 observe |
| K1-15 | upsert reject 仍是 `PROCESSING_ERROR`，開與關的結果相同。診斷不含學號 |
| K1-16 | commit reject 仍 throw `commit failed` |
| K1-17 | `runSync` reject 後 HTTP 仍是成功回應。排程錯誤留在 controller 既有的 catch |
| K1-18 | `res.json` 第一次 throw 仍走 controller catch，得到 500。Controller 沒有引用 observe |
| K1-19 | flag 關閉不呼叫 capture |
| K1-20 | production 不呼叫 capture。Flag getter throw 視為關閉 |
| K1-21 | 500 列的 proxy 在 index 200 以後會 throw；診斷仍是前 200，代表沒讀到尾端 |
| K1-22 | 1 列與 20 列不截斷 |
| K1-23 | 沒有 rows 時 total 是 null |
| K1-24 | 前綴第 1 列 skip、其餘 accepted，三個 selectionScope 分開 |
| K1-25 | log 只有一行，不含學號或 email |
| K1-26 | `console.error` 沒有收到 exception。診斷不含 `Error.message` |
| K1-27 | governance 四個旗標仍是 false。沒有把 loss 改成 confirmed projection |
| K1-28 | `not_observed` 的 count 是 null |
| K1-29 | 2000 列只評估 200。Flag 關閉約 0.01 ms，沒有進 capture |
| K1-30 | `evaluateBestepFileQuality` 的報告形狀與 `contract_only` 維持原樣。未實作指標仍是 2 個 |
