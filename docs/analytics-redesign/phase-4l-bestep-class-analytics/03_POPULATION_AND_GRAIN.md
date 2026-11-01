# 粒度

程式在 `computeClassBestepExportSummary` 與 `buildClassBestepOverviewStatistics`。

| 欄位 | 粒度 | 母體 |
|---|---|---|
| `totalStudents` | 名冊列 | 查詢學期的 `ClassMembership` 列數。程式沒有先做不重複學生 |
| `domesticStudentCount` | 學生 | 名冊上、該學期 snapshot 在冊，且 `isDomestic !== false`。不在冊排除。snapshot 的 null 仍算本國生 |
| `registeredCount` | 學生 | 上面的本國生，去掉報名失敗，且最新報名成功。一人一筆 |
| `totalExamCount` | 報考項目 | 成功項目的 L/R/S/W，再加已核准抵免項目 |
| `registrationDenominator` | 項目空位 | 本國生且非報名失敗的人數 × 4。未報名仍在分母 |
| `totalRegistrationExamSlots` | 到考項目分母 | 只有成功報名展開的項目。抵免不在這裡 |
| `attendedSlots` | 到考項目分子 | `resolveComponentAttended === true` |
| `fullAttendanceCount` | 學生 | 每個應考項目都是 true |
| `passedCount` | 成績列 | 全部名冊列裡 `score.passed` 為真，含非本國生 |
| `passRate` | 混用 | `passedCount / registeredCount`。分子與分母不是同一母體 |
| 四科分數 | skill observation | 一列成績的一科。不是一次考試，也不是一位學生 |

一位學生的 LR 加 SW 仍是一位學生、最多四個項目。班級人數不是報考人數。本國生不是全班。
