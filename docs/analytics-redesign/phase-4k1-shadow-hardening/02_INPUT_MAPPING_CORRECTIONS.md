# 輸入對照修正

契約欄位名稱仍是 `rawFileRows`、`acceptedScoreRows`、`skippedImportRows`。階段差寫在 metadata，沒有第二套輸入。

| 集合 | 來源與階段 | 正規化 | 完整 | 已提交 | 身分 | 可推論 | 不可推論 |
|---|---|---|---|---|---|---|---|
| `rawFileRows` | commit 後記憶體中的前 200 個 parsed row。`sourceStage=parsed_worksheet_rows` | 只做表頭對應，CEFR 不折疊 | 否，`first_n` | 否 | 只有 `eval:index` | 前綴儲存格與寫入值可以比較 | 不是 Excel 原檔，也不是全檔品質 |
| `acceptedScoreRows` | 同一前綴裡沒有 skip code 的列。有 commit 旗標時 stage 是 `committed_normalized_prefix` | 分數已 parse，CEFR 已折疊 | 只含前綴 | 只有 `commitSucceeded` | 同一個 `eval:index` | 這些列已通過檢查、upsert 回傳，且交易已 commit | 不是資料庫重讀，也不是全檔 accepted 清單 |
| `skippedImportRows` | 同一前綴的 `errors[].error` | 只留 code，不留 message | 否 | 不適用 | 同一個 index | skip code | 不是完整原因，也不是有效成績 |
| `currentScoreRecords` | 未傳。`not_observed` | 不適用 | 否 | 未知 | 無 | 無 | 不是目前資料庫狀態，也不是 0 筆 |
| `attendanceRows` | 未傳。`not_observed` | 不適用 | 否 | 未知 | 無 | 無 | 不是 0 缺考 |
| `projectionRecords` | 未傳。sync 還沒跑 | 不適用 | 否 | 未知 | 無 | 無 | 沒有已確認來源關聯，也不是 0 筆同步 |
| `registrationPopulation` | 未傳。迴圈沒有母體人數 | 不適用 | 否 | 未知 | 無 | 無 | 不能算覆蓋率 |
| `importHistory` | 未傳。upsert 不留舊版 | 不適用 | 否 | 未知 | 無 | 無 | 不能還原重匯 |

`SOURCE_INFORMATION_LOSS` 比較的是 parsed cell 與正規化寫入值。Shadow 把它標成 `undetermined`，不把它說成已確認的原檔損失。離線報告仍是 `contract_only`。
