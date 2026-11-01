# 重複候選與衝突

`compareAssessmentObservations` 不修改兩筆觀測，不刪列，不選較高分、較新匯入或 et。

`conflicts` 只列欄位與排序後的值，所以左右對調後結果相同。

| relationship | 條件 |
|---|---|
| same_source_record | 同一張表、同一個非空主鍵、同一技能，而且分數與 CEFR 沒有衝突 |
| conflicting | 同一身分或已確認的投影連結，但分數或 CEFR 不同。沒有連結時，若學生、工具、技能、實測日期都相同而結果不同，也是 conflicting |
| confirmed_projection | 上游主鍵對得上、技能相同、結果沒有衝突 |
| possible_duplicate | 來源主鍵都存在且不同、沒有確認連結、學生／工具／技能／實測日期相同、結果也沒有衝突 |
| distinct | 學號不同、技能不同、實測日期不同，或兩邊工具都已知且不同 |
| undetermined | 缺主鍵、缺學號或技能、工具未知、日期不是實測（含只有學期、推估、哨兵） |

`requiresReview` 在 possible_duplicate、conflicting、undetermined 為 true。

實測日期只接受精度 `date`，而且出處是欄位本身：`stated_column`、`exam_attempts.exam_date`、`et_test_date`、`et_exam_date_fallback`。推估日期不能用來宣稱同一場。

不同工具即使 CEFR 相同也是 distinct，並帶 `INSTRUMENT_NOT_COMPARABLE`。

投影連結若同時有結果衝突，關係是 conflicting，不是 confirmed_projection。連結不會蓋過不一致。
