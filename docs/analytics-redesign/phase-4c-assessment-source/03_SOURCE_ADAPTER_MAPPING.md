# 來源欄位對應

對應來自 model 與 `syncBestepScoresToExamAttempts`。標 UNKNOWN 的項目沒有在這次用資料庫核對。

## bestep_exam_scores

| 觀測 | 欄位 |
|---|---|
| 主鍵 | `id` |
| 學號 | `studentId` |
| 工具 | 固定 BESTEP |
| 檔案學期 | `semester` |
| 考試日 | `examDate`，可空 |
| 四科分數 | `listeningScore`、`readingScore`、`speakingScore`、`writingScore` |
| 四科等級 | 對應的 `*Level` |
| 批次 | `importBatchId` |
| 上游 | 無 |

匯入程式 `normalizeCefrLevel` 在寫入前去掉加號。adapter 若還看到 `B2+`，會把原文放在 `originalCefrLevel`。已經存成 B2 的列，原文是 null。

## exam_attempts 與 exam_attempt_skill_scores

| 觀測 | 欄位 |
|---|---|
| 主鍵 | `exam_attempts.id` |
| 學號 | `student_id`。`student_pk` 只放在 provenance，不拿來跨表比對 |
| 工具 | `exam_vendor`。沒有時，`source_type=BESTEP` 才記 BESTEP，否則 UNKNOWN |
| 學期標籤 | `semester_id` |
| 考試日 | `exam_date` |
| 技能 | 子表 `skill`、`raw_score`、`raw_level` |
| 正規化等級 | 子表 `cefr_level` 只在呼叫端把它放進 `rawLevel` 或 `cefr` 時才讀到。adapter 不另外查子表 |
| 連結 | `source_ref` 與 `raw_payload.bestepExamScoreId` |

`dedupe_key` 不進觀測身分。

## et_exam_attempts 與 et_exam_attempt_skill_scores

| 觀測 | 欄位 |
|---|---|
| 主鍵 | `id` |
| 學號 | `studentId` |
| 工具 | `examType`，沒有才用 `testType`。都沒有則 UNKNOWN |
| 考試日 | `testDate`，沒有才用 `examDate`。這跟 `bestSkillService` 的讀法相同，不是新的優先政策 |
| 技能 | 子表 `skill`、`rawScore`、`rawLevel` 或 `cefr` |
| 批次 | `importBatchId` |
| 連結 | 只有 `rawPayload.bestepExamScoreId` |

兩個日期欄都有值而且不同時，採用 `testDate`，另一個放進 `provenance.alternateAssessmentDate`。哪一個才是對外成績日，若兩欄長期不一致：UNKNOWN。

唯一鍵是否允許 `testDate` 為 null 的重複列：UNKNOWN。這次沒有連資料庫。
