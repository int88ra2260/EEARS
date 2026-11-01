# 未決事項

- D1、D10、D11 仍是 pending。沒有核准新的官方指標。
- `PROPOSED:bestep.class.domestic_registration_component_rate`、`PROPOSED:bestep.class.domestic_component_attendance_rate`、`PROPOSED:bestep.class.mean_total_score` 只存在於這份契約。
- 同一學生多筆 `bestep_exam_scores` 時，哪一列留下仍是 UNKNOWN。
- 名冊是否保證一人一列，程式沒有在這裡去重。正式數字要等 L3。
- `passRate` 的分子含非本國生、分母不含。落差沒有用正式資料量過。
- 出席 null 在率裡留在分母、在畫面 falsy 時顯示成缺席。契約只記錄，沒有改。
- 成績來源日期仍 unknown。出席日期不能補上。
