# Schema 與資料流程驗證

狀態：`VERIFIED_BY_CODE` 表示模型、migration 或服務程式對得上。`REQUIRES_DATA_VALIDATION` 表示要看正式資料才能下結論。本階段沒有連線資料庫，也沒有改 model、migration 或 importer。

## bestep_exam_scores

| 項目 | 結果 | 證據 |
|---|---|---|
| Primary Key | VERIFIED_BY_CODE | `models/BestepExamScore.js`；migration `20250203000002` 的 `id` 自增主鍵 |
| Student | VERIFIED_BY_CODE | 欄位 `studentId`。唯一索引 `uk_student_semester` 是學號加檔案學期 |
| Instrument | VERIFIED_BY_CODE | 這張表沒有工具欄。adapter 固定 `BESTEP` |
| Skill | VERIFIED_BY_CODE | `listening` / `reading` / `speaking` / `writing` 各一組分數與等級。一列變成四個觀測 |
| Score | VERIFIED_BY_CODE | `*Score` 為 DECIMAL。adapter 的 `normalizedScore` 固定 null |
| CEFR | VERIFIED_BY_CODE | `bestepImportService.normalizeCefrLevel` 去掉加號後才寫入。契約只在輸入本身帶加號時保留 `originalCefrLevel` |
| Date | VERIFIED_BY_CODE | `examDate` 可空 DATEONLY。註解寫 LR 與 SW 可能不同日，但資料表只有一個日期欄 |
| Import batch | VERIFIED_BY_CODE | `importBatchId` 可空 |
| Projection | VERIFIED_BY_CODE | 這張表是上游，`upstreamSource` 為 null |
| Uniqueness | VERIFIED_BY_CODE | 主鍵唯一。學號加學期也唯一，所以同一學期再匯入會撞同一列，不是以考試日分列 |
| Update | REQUIRES_DATA_VALIDATION | 程式允許同一學期更新該列。正式環境覆寫次數未查 |

## exam_attempts

| 項目 | 結果 | 證據 |
|---|---|---|
| Primary Key | VERIFIED_BY_CODE | migration `20260420180000`：`id` BIGINT 自增主鍵。`models/ExamAttempt.js` 對應 `exam_attempts` |
| Student | VERIFIED_BY_CODE | `student_id` 與 `student_pk`。契約比對只用學號字串 |
| Instrument | VERIFIED_BY_CODE | `exam_vendor` 可空。BESTEP 同步寫 `BESTEP`。空著時工具為 `UNKNOWN`，比較結果是 `undetermined` |
| Skill | VERIFIED_BY_CODE | 子表 `exam_attempt_skill_scores`，唯一鍵 `attempt_id + skill` |
| Score | VERIFIED_BY_CODE | 子表 `raw_score`。同步另寫 `cefr_level`，adapter 讀呼叫端給的 `rawLevel` 或 `cefr` |
| CEFR | VERIFIED_BY_CODE | 子表等級是不含加號的 ENUM。加號若只出現在 `raw_level`，要由呼叫端傳入才保留 |
| Date | VERIFIED_BY_CODE | `exam_date` DATEONLY 且 NOT NULL。同步缺日期時才可能寫入 `1970-01-01` |
| Import batch | VERIFIED_BY_CODE | 同步路徑沒有匯入批次欄。adapter 只在 metadata 有 `importBatchId` 時填上，否則 `UNKNOWN_IMPORT_BATCH` |
| Projection | VERIFIED_BY_CODE | 建立時 `source_ref=bestep_exam_scores:{id}`，`raw_payload.bestepExamScoreId` 相同。兩者衝突則不連線 |
| Uniqueness | VERIFIED_BY_CODE | `dedupe_key` 唯一。培力同步的 key 是 `bestep_exam_score|學期|學號|列 id` 的 sha256。這是冪等鍵，不是跨來源合併政策 |
| Update | VERIFIED_BY_CODE | 已存在且未上 `syncManualLock` 時，只更新不同的 `examDate`。不改 `sourceRef`。鎖上的列整筆跳過 |

## et_exam_attempts

| 項目 | 結果 | 證據 |
|---|---|---|
| Primary Key | VERIFIED_BY_CODE | migration `20260224000001`：`id` 自增主鍵。後續 migration 加欄，沒有改掉主鍵 |
| Student | VERIFIED_BY_CODE | `studentId` |
| Instrument | VERIFIED_BY_CODE | 匯入寫 `testType`。追蹤服務 `examAttemptService.create` 寫 `examType`。adapter 讀 `examType`，沒有才讀 `testType` |
| Skill | VERIFIED_BY_CODE | 兩張子表。匯入寫 `EtExamAttemptScore`（關聯 `scores`）。追蹤服務寫 `EtExamAttemptSkillScore`（關聯 `skillScores`）。`bestSkillService` 只 include `skillScores` |
| Score | VERIFIED_BY_CODE | 分數在子表，不在嘗試主表。adapter 不自己查表，只映射呼叫端傳入的技能列 |
| CEFR | VERIFIED_BY_CODE | 與其他來源相同：不從 `B2` 還原 `B2+` |
| Date | VERIFIED_BY_CODE 加 UNKNOWN | 兩欄都可空：`testDate`、`examDate`。誰是對外正式測驗日期：UNKNOWN。見日期文件 |
| Import batch | VERIFIED_BY_CODE | 匯入寫 `importBatchId`。追蹤服務另有 `sourceBatchId`。adapter 讀 `importBatchId` |
| Projection | VERIFIED_BY_CODE | 沒有程式把 `bestepExamScoreId` 寫進這張表。adapter 只在 payload 已經有這個鍵時才連到培力列 |
| Uniqueness | VERIFIED_BY_CODE 加 UNKNOWN | migration `20260430161000` 建立 `studentId + testType + testDate` 唯一索引，重複資料會讓 migration 失敗。`testDate` 為 NULL 時 MySQL 能否存多列：UNKNOWN |
| Update | VERIFIED_BY_CODE | 自然鍵 `examAttemptNaturalKey.buildCanonicalAttemptWhere` 用 `COALESCE(examDate, testDate)`。這和歷史最佳的 `testDate || examDate` 順序不同 |

KPI 與歷史最佳讀 `et_exam_attempts`，不讀 `exam_attempts`。這是現行程式，D11 仍是 pending，契約不把它當成優先權。
