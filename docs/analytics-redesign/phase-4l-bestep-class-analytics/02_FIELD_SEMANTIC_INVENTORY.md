# 欄位清單

契約 73 條。API 頂層是 `classInfo`、`statistics`、`students`、`pagination` 四個鍵。其餘是巢狀或 `students[]` 元素。

語意類別：metric 26、derived_value 8、dimension 17、query_context 9、breakdown 7、legacy_supplement 6。

對應：mapped 11、unmapped 7、proposed 16、not_applicable 39。合成的現行形狀沒有未知欄位；多出來的鍵會進 `unknownFields`。

對上既有 Metric ID 的只有：

- 四科分數：`bestep.file.skill_score`
- 四科等級：`bestep.file.skill_level`
- `students[].score.passed`、`statistics.passedCount`、`statistics.passRate`：`bestep.file.four_skill_cefr_b2`

報考率、到考率與平均分沒有相容 ID。契約用 `PROPOSED:` 字串標出，沒有寫進 32 個 Metric ID。`bestep.file.attendance_lr_sw_avg` 與 `ops.roster.bestep_pass_over_attendance` 是別的 KPI，沒有拿來套這頁。

`pagination.*` 與查詢學期是 query context，不是指標。
