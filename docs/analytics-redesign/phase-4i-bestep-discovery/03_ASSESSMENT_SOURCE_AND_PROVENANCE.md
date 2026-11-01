# 來源身分與投影

沿用 `analytics-contracts/assessmentSourceRegistry.js`。本階段沒有改登錄，也沒有做 D11 優先權。

| 來源 | 主鍵 | 學生 | 工具 | 日期欄 | 技能粒度 | 與成績檔的關係 |
|---|---|---|---|---|---|---|
| `bestep_exam_scores` | `id` | `studentId` | 固定 BESTEP | `examDate` 可空；匯入寫 null | 一列四欄 | 來源本體 |
| `exam_attempts` | `id` | `studentId` 與 `studentPk` | `examVendor` | `examDate` 不可空 | 子表 `exam_attempt_skill_scores` | `sourceRef=bestep_exam_scores:{id}` 且 `rawPayload.sync` 才是確認投影 |
| `et_exam_attempts` | `id` | `studentId` | `examType` / `testType` | `testDate` 與 `examDate` 兩欄 | 子表 `et_exam_attempt_skill_scores` | 程式沒有把 `bestepExamScoreId` 寫進這張表。只有 rawPayload 已有該鍵時 adapter 才建投影 |

相同學號、日期、技能或分數不足以判成同一筆。`assessmentContractHardening.test.js` 的 H07 已要求不同表的同一個數字 id 不是 `same_source_record`。H05 要求確認投影在分數衝突時仍保留連結。H08 要求一列成績變成四個 skill observation，且聽力與閱讀彼此是 distinct。

## 投影不是去重

`syncBestepScoresToExamAttempts` 用 `dedupeKey` 避免同一成績列重複插入 `exam_attempts`。那個 key 含學期、學號與成績列 id。它不是跨表合併政策。既有列若 `rawPayload.syncManualLock` 就跳過。證據：`syncService.js` 337–360 行。

`resolveBestepExamDate` 會在成績日空著時改讀出席日、再改讀 `importedAt` 的日期、最後寫 `1970-01-01`。這發生在同步程式，不在 assessment adapter。adapter 對沒有確認投影的 1970 仍保留為陳述日期；確認投影上的 1970 才當哨兵。證據：`syncService.js` 39–57 行；測試 H12、H13。

## 品質旗標

成績檔 adapter 在沒有 `examDate` 時標 `MISSING_ASSESSMENT_DATE`，且不把學期字串補成考試日。測試 A09、A10。

D11 Source Priority 維持 Pending。不得為了班級通過率或 KPI 提前把三張表加成一筆。
