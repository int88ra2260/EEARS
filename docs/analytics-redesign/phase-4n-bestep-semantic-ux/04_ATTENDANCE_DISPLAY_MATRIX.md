# 出席狀態與畫面

資料來自 API 的 `students[].attendance`。每個項目是 `{ attended, examDate, absentReason }`，`attended` 可以是 `true`、`false` 或 `null`。沒有匯入時，該生的 `attendance` 是空物件。

| 資料 | 修正前 | 修正後 | 這次是否猜測報名或抵免 |
|---|---|---|---|
| `attended === true` | 出席 | 出席 | 否 |
| `attended === false` | 缺席 | 缺席 | 否 |
| `attended === null` | 缺席 | 未確認 | 否 |
| 物件在，但沒有 `attended` | 缺席 | 未確認 | 否 |
| `undefined`、`null` 或 `{}` | 未匯入 | 未匯入 | 否，不顯示不適用或抵免 |
| 未報名，且沒有出席物件 | 未匯入 | 未匯入 | 否 |
| 已核准抵免，且沒有出席物件 | 未匯入 | 未匯入 | 否；抵免仍只出現在抵免欄 |

L、R、S、W 使用同一套規則。只有 L/R 都不存在時才顯示 LR；只有 S/W 都不存在時才顯示 SW。

匯出仍是：未報到的項目空白、`null` 空白、`true` 為 `✓`、`false` 為「缺席」。匯出沒有改成「未確認」。
