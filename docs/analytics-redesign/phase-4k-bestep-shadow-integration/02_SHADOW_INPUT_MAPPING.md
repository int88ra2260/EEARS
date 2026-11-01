# 記憶體資料對照

| Phase 4J 集合 | 這次匯入 | 處理 |
|---|---|---|
| `rawFileRows` | `AVAILABLE_IN_MEMORY` | 已解析的 `rows`。只拷貝分數與 CEFR 欄，不拷學號、姓名、email |
| `acceptedScoreRows` | `PARTIALLY_AVAILABLE` | 同一前綴裡沒有 error 的列。等級用既有 `normalizeCefrLevel`，`examDate` 維持 null。這是寫入值的記憶體副本，不是事後查表 |
| `skippedImportRows` | `PARTIALLY_AVAILABLE` | 同一前綴的 `errors[].error`。`STUDENT_NOT_FOUND` 不會變成 accepted |
| `currentScoreRecords` | `REQUIRES_DB_QUERY` | 不查。`not_observed`。`currentStateRowCount` 是 null |
| `attendanceRows` | `NOT_AVAILABLE` | 成績匯入迴圈沒有出席列。`not_observed`，不是 0 缺考 |
| `projectionRecords` | `NOT_AVAILABLE` | sync 在回應之後的 `setImmediate`。當時還沒有投影列。`not_observed`，不是 0 筆同步 |
| `registrationPopulation` | `REQUIRES_DB_QUERY` | 迴圈只逐列找報名，沒有留下母體人數。不計算覆蓋率 |
| `importHistory` | `NOT_AVAILABLE` | upsert 不保留舊版。`not_observed`，不是「沒有重匯」 |

計數：

- `rawRowCount`：`rows.length`。沒有列物件時是 null。
- `evaluatedRowCount`：實際掃描列數，最多 200。
- `acceptedRowCount`：前綴內被當成寫入列的數量。截斷時小於全檔 `writtenRowCount`。
- `skippedRowCount`：全檔 `skipped`。這是匯入已經算出的數，不是把跳過列當成成績。
- `writtenRowCount`：全檔 `imported`。
- `currentStateRowCount`：null。

全檔 `imported` 不會拿去填 accepted 列。成功筆數也不是原始檔筆數。
