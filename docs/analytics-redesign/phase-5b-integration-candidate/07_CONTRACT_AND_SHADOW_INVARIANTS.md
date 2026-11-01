# 契約與 Shadow 不變項

候選樹 `15974e0`，用 Node v20.20.2 載入 registry。本階段沒有改這些檔案。

## Registry

- Metric ID：32，重複 0
- Domain：7
- Temporal contract：9
- 未實作：`ops.participation.streak`、`roster.pair_pass.both_pairs`
- `officialUseAllowed`：0
- `causalClaimAllowed`：0
- D1–D11：全部 `pending`

## BESTEP

`bestepClassService.js` 217–219 行仍是：`registeredCount > 0` 才把 `passedCount / registeredCount * 100` 取兩位小數，否則 `0`。決策測試在這次 256 項裡通過，所以 Legacy 與候選公式的合成比較仍在測試內，正式服務沒有 `optionA`。

出席：`attended === true` 才是「出席」。表格總分只把 `null` 與 `''` 顯示成 `-`，數字 0 會顯示。匯出 `getAttendanceExportCell` 在未報到該科或 `attended === null` 時回傳 `''`。三個評量來源沒有合併。B2+ 沒有還原程式。成績匯入的考試日缺失維持未知，本階段沒有指定日期優先順序。

## Shadow

活動營運、BESTEP 檔案品質、BESTEP 班級分析仍是三個 runtime。預設要精確或小寫後的 `true` 才開，`production` 不開，失敗不改回應，不寫資料庫。本階段沒有統一大小寫，也沒有合成一個框架。256 項後端測試含這三條的回歸。
