# 未決事項

- D1–D11 仍是 pending。沒有核准新的官方指標。
- Metric registry 仍是 32 個。Temporal contract 仍是 9 個。Domain 仍是 7 個。未實作指標仍是 2 個。
- `officialUseAllowed`、`causalClaimAllowed`、`sourcePriorityApplied`、`mergePerformed` 維持 false。
- `PROPOSED:bestep.class.domestic_registration_component_rate`、`PROPOSED:bestep.class.domestic_component_attendance_rate`、`PROPOSED:bestep.class.mean_total_score` 仍不是正式 metric id。
- 班級到考率沒有對應到 `bestep.file.attendance_lr_sw_avg`。班級通過率沒有對應到 `ops.roster.bestep_pass_over_attendance`。
- 同一學生多筆 `bestep_exam_scores` 時，哪一列留下仍是 UNKNOWN。
- 名冊是否保證一人一列，這次沒有去重，也沒有跑 L3。
- F-BESTEP-01 的官方母體尚未決定。合成案例證明可以超過 100%，也證明分母為 0 時公布率會被寫成 0。沒有用正式班級量過頻率。
- F-BESTEP-02 已由現行 UI 測試確認，但畫面尚未修正。
- 成績來源日期仍是 unknown。本階段沒有補出席日期，也沒有合併 assessment source。
