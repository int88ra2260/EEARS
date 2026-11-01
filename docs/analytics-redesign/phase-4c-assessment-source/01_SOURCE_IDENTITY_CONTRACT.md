# 來源身分

學生學號與來源列是兩件事。比對只用 trim 後轉大寫的學號。姓名不會進入觀測，也不當合併鍵。全形折疊若和原字串不同，只記 `identityRisk`，不另造一個學號。

## 四種來源類別

| originClass | 何時使用 |
|---|---|
| external_import | `bestep_exam_scores`。`et_exam_attempts` 有 `importBatchId` 時也用這個 |
| projection | `exam_attempts` 的 `sourceRef` 與 `rawPayload.bestepExamScoreId` 指向同一筆培力列 |
| native_record | `exam_attempts.sourceType` 是 MANUAL，而且沒有培力連結 |
| unknown | 沒有主鍵、BESTEP 類型但沒有來源鍵、`sourceRef` 與 payload id 互相矛盾、或 et 列沒有批次 |

`exam_attempts.sourceType` 還有 EXTERNAL 與 LEGACY_ET。EXTERNAL 記成 external_import。LEGACY_ET 沒有獨立對應，留在 unknown。

## 確認連結

`upstreamSource` 只在下面兩者一致時成立：

- `sourceRef` 符合 `bestep_exam_scores:{id}`
- 或 `rawPayload.bestepExamScoreId`

兩邊都有而且數字不同：不建立連結，觀測標 `SOURCE_CONFLICT`。

et 列只有 `rawPayload.bestepExamScoreId` 存在時才建立連結。程式裡沒有固定的 et → 培力 sourceRef。沒看到這個鍵，就保持 null。

## 不是合併鍵

- `exam_attempts.dedupeKey` 是同步冪等鍵
- `bestep_exam_scores` 的學號加學期唯一鍵
- `et_exam_attempts` 的學號、testType、testDate 唯一鍵
- 相同 CEFR

D11 仍是 pending。這份登錄沒有來源優先權欄位。
