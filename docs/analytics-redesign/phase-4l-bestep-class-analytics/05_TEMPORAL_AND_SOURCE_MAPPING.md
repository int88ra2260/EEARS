# 時間與來源

查詢學期同時用於名冊、報名、出席與成績。它對得上 `TC-BESTEP-FILE-SEMESTER` 的檔案學期。

沒有被這個契約涵蓋、因此標成 gap 的是：

- `classInfo.semester`：班級資料上的學期，可以和查詢學期不同。
- `personalRegistration.updatedAt`：報名更新時間，不是考試日期。
- 成績列沒有 `examDate`。來源考試日期維持 unknown。出席列的 `examDate` 只屬於出席，不能填回成績。

相同的學期字串、出席日或分數，都不能當成同一筆測驗。Validator 看到多個允許的 source id 時只發 `MULTIPLE_SOURCES_NOT_MERGED`，`mergePerformed` 維持 false。`CONFIRMED_PROJECTION` 與 `POSSIBLE_DUPLICATE` 是兩條 warning。

本階段沒有新增 Temporal Contract ID。
