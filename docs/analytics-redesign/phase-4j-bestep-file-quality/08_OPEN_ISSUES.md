# 未決事項

D1–D11 仍是 pending。這份報告不判斷單科 B2、學生達標、來源優先權或加號政策。

仍開放：

- 檔案學期、LR 日、SW 日哪一個可以代表一次施測。validator 不代選。
- 舊出席模板把無法辨識的文字存成 false。那是匯入行為。本報告只在輸入已經是 false 時標 informational，不把 null 改成 false。
- 班級通過率的分母不能從這個 pilot 推成中心覆蓋率。
- `resolveBestepExamDate` 仍會在同步時推日期。品質報告只在呼叫端把該筆標成 `inferred`，或既有哨兵規則成立時，才標推斷。
- `et_exam_attempts` 沒有在成績匯入的自動同步裡寫入。未放入 `projectionRecords` 就是未檢查。
- 空的 `priorVersions` 只表示這次輸入沒有較早版本，不表示正式環境沒有重匯。
- Phase 4K 的旁路回應尚未實作，也尚未決定是否給管理員看 finding。
