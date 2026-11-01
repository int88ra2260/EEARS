# Phase 4L 是否適合把結果給管理員

Shadow 在 flag 關閉，以及非 production 的失敗隔離下，不會改寫入、跳過碼、HTTP JSON 或 sync 排程。這個內部診斷可以留在測試與開發。

還不適合把 finding 放到管理端：

- 每筆寫入的 `examDate` 都是 null，診斷會穩定出現 `SOURCE_EXAM_DATE_MISSING`。那是匯入政策，不是這一批臨時壞掉。
- 超過 200 列時，畫面上的缺漏只描述前綴。
- 出席、投影、報名母體與重匯歷史都是 `not_observed`。
- `officialUseAllowed` 與 `causalClaimAllowed` 仍是 false。Finding 不是 B2 達標，也不是學生能力。
- 沒有 L3，不知道正式檔的 null 比例。

若要做下一刀，應先決定管理員看到的是「這次前綴的匯入診斷」，並繼續不放進現有 `res.json`。在 L3 與日期政策之前，不建議做 Dashboard。
