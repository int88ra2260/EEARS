# 治理與旗標

`c811680` 相對 `15974e0` 沒有改 `analytics-contracts` 或 Shadow runtime。下面是 Phase 5B 在 Node v20.20.2 載入 registry 的結果，仍然有效。

- Metric ID：32，無重複
- Domain：7
- Temporal contract：9
- 未實作：`ops.participation.streak`、`roster.pair_pass.both_pairs`
- D1–D11：`pending`
- `officialUseAllowed`：沒有任何 true
- `causalClaimAllowed`：沒有任何 true

F-BESTEP-01 仍是 `decision_pending`。Legacy 150% 的比較留在 `tests/bestepClassPassRateDecision.test.js`。`bestepClassService.js` 的 `passRate` 仍只在 `registeredCount > 0` 時用 `passedCount / registeredCount`，否則為 0。沒有選定 A/B/C。B2+ 沒有還原。`bestep_exam_scores`、`exam_attempts`、`et_exam_attempts` 沒有合併。

三個 Shadow（活動營運、BESTEP 檔案品質、BESTEP 班級）仍是分開的 runtime：預設關閉、`production` 不執行、失敗不改 API、不寫資料庫、診斷不帶學生個資。這次沒有啟用它們，也沒有統一大小寫判斷。
