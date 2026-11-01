# 資料階段

`importScoreData` 沒有把下列階段拆成獨立函式。實際順序在同一個 transaction 裡：

| 檢查清單 | 程式裡的實際東西 |
|---|---|
| Uploaded Excel | `XLSX.readFile` 讀的檔案。Shadow 不再讀它 |
| Parsed Worksheet Rows | `sheet_to_json` 的 `rows`。表頭已經變成物件鍵 |
| Normalized Rows | 沒有獨立集合。`getFieldValue` 對照表頭；寫入前才 `parseNullableScore` 與 `normalizeCefrLevel` |
| Validated Rows | 沒有留下。驗證失敗直接推進 `errors` 並 `continue` |
| Registration Matched Rows | 沒有留下。找不到 `status=success` 就是 `STUDENT_NOT_FOUND` |
| Upsert Attempted Rows | 通過前述檢查才呼叫 `BestepExamScore.upsert`。沒有另存清單 |
| Successfully Written Rows | `imported` 只在 upsert 回傳後加一。列內 throw 變成 `PROCESSING_ERROR`，不加 `imported` |
| Committed Import Outcome | `transaction.commit()` 成功後的 `{ imported, skipped, errors, importBatchId, sourceFile }` |
| Shadow | commit 成功、且在 rollback 的 catch 之外 |

因此 parsed、validated、written、committed 不是同義詞。`validatedRowCount` 沒有證據，維持 null。`upsertSucceededRowCount` 用的是記憶體裡的 `imported`。`committedRowCount` 只有 hook 明示 commit 已成功時才等於同一個數。
