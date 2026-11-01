# 來源身分與內容一致性

程式：`reservation-backend/analytics-contracts/assessmentComparison.js`。

舊的 `relationship` 把「是不是同一筆來源」和「分數一不一致」合成一個標籤。同源但分數不同時，來源關聯會消失。現在這兩件事分開。

## 結構

`compareAssessmentObservationsDetailed(left, right)` 回傳：

- `identity.relationship`：`same_source_record`、`confirmed_projection`、`possible_same_assessment`、`distinct`、`undetermined`
- `identity.confidence`：`confirmed`、`candidate`、`none`
- `identity.evidence`：排序後的證據碼
- `consistency.status`：`consistent`、`conflicting`、`insufficient_data`、`not_comparable`
- `consistency.differences`：只含雙方都有值且不同的 `rawScore`、`cefrLevel`
- `consistency.comparedFields`：實際比過的欄位
- `duplicateAssessment.status`：`possible` 或 `not_applicable`

分數相同不會把 `candidate` 提升成 `confirmed`。分數不同也不會改掉已確認的 `same_source_record` 或 `confirmed_projection`。

## 組合

| Identity | Consistency | 意義 |
|---|---|---|
| same_source_record | consistent | 同一來源列、同一技能，成績一致 |
| same_source_record | conflicting | 同一來源列、同一技能，成績不同 |
| confirmed_projection | consistent | 投影鍵對得上，成績一致 |
| confirmed_projection | conflicting | 投影鍵仍在，成績不一致 |
| possible_same_assessment | consistent | 同人、同日、同工具、同技能，沒有來源鍵 |
| possible_same_assessment | conflicting | 疑似同場，但成績不同 |
| undetermined | insufficient_data | 證據不夠 |
| distinct | not_comparable | 已能分開，不把分數拿來比 |

`distinct` 包含不同技能、不同學生、不同工具、不同已觀測日期。不同工具的原始分數不進 `differences`。

## 舊介面

`compareAssessmentObservations()` 不再自有一套判斷。它呼叫詳細結果後映射：

- 內容 `conflicting` 時，舊 `relationship` 仍是 `conflicting`，`identity.relationship` 保留來源關聯。
- `possible_same_assessment` 映射成舊的 `possible_duplicate`。
- 其餘沿用身分關係。
- `reasons` 來自 `identity.evidence`；內容衝突再加 `result_mismatch`。
- `mergePerformed` 與 `sourcePriorityApplied` 固定為 false。

A01–A20 與此映射相容。交換左右比較時，證據與差異值都先排序，語意相同。
