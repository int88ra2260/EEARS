# Finding codes

登錄：`bestepFileQualityFindings.js`。

| Code | Severity | 意義 |
|---|---|---|
| `FILE_SEMESTER_MISSING` | error | 批次沒有檔案學期，不能當成一個可定位的匯入批次 |
| `SOURCE_FILE_UNKNOWN` | warning | 來源檔不可追溯。成績內容仍可另判 |
| `IMPORT_RUN_UNKNOWN` | warning | 匯入執行不可追溯 |
| `IMPORT_TYPE_UNKNOWN` | warning | 不是 `bestep_score_import` |
| `SKILL_SCORE_MISSING` | warning | 技能分數空缺 |
| `SKILL_CEFR_MISSING` | warning | 技能 CEFR 空缺 |
| `SKILL_VALUE_INVALID` | warning | 非空值無法辨識 |
| `SOURCE_EXAM_DATE_MISSING` | warning | 來源 `examDate` 沒有可用日期 |
| `PROJECTED_DATE_INFERRED` | warning | 投影日期是推斷或哨兵，不是來源日期 |
| `DATE_PROVENANCE_UNKNOWN` | unknown | 投影上有日期，但不知道是陳述還是推斷 |
| `DATE_CONFLICT` | warning | 來源與 stated 投影日期不同，或 et 兩欄不一致 |
| `ATTENDANCE_UNKNOWN` | unknown | 沒有出席證據 |
| `ATTENDANCE_CONFIRMED_ABSENT` | informational | 出席列明確標缺考 |
| `IMPORT_ROW_SKIPPED_UNMATCHED` | warning | 跳過碼是 `STUDENT_NOT_FOUND` |
| `REGISTRATION_POPULATION_NOT_OBSERVED` | unknown | 沒有報名母體，不計算覆蓋率 |
| `PROJECTION_UNVERIFIED` | unknown | 沒有已確認連結，或連結不足以完成一致比對 |
| `PROJECTION_CONTENT_CONFLICT` | warning | 已確認投影的分數或 CEFR 不一致 |
| `POSSIBLE_DUPLICATE_UNMERGED` | informational | 可能同一坐次，保持未合併 |
| `SOURCE_INFORMATION_LOSS` | warning | raw 的加號沒有留在 accepted 列 |
| `REIMPORT_HISTORY_UNKNOWN` | unknown | 沒有匯入歷史，不能比較覆蓋前內容 |

error 與 warning、unknown 會讓整體狀態離開 `complete`。informational 只記錄事實。缺 source file 不會升級成整批成績無效。
