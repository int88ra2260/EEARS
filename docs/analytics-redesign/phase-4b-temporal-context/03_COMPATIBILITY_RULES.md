# 時間相容規則

`evaluateTemporalCompatibility` 的 `status` 只會是 `compatible`、`incompatible`、`undetermined`、`unsupported`。

每次結果都帶 `scope: 'temporal_only'`。`fullAnalysisComparability` 不會是 `compatible`。時間窗相同不代表母體、工具、政策或達標口徑相同。

省略 `comparisonType` 時是 `undetermined`，原因 `comparison_type_required`。

## 狀態

| comparisonType | 結果 |
|---|---|
| `same_event_period`，同一指標、同一契約、同一半開窗、沒有決策門 | `compatible`，原因 `same_event_window` |
| `same_event_period`，同一窗但指標不同 | `undetermined`，`temporalBoundariesMatch` 仍可為 true |
| `same_event_period`，契約不同 | `incompatible`。CAST 與字串區間即使學期相同也是 incompatible |
| `same_event_period`，指標仍有 pending 決策門 | `undetermined`，原因 `policy_not_approved` |
| `policy_window` | 目前一律 `undetermined`。有決策門時原因是 `policy_not_approved` |
| `historical_as_of` | `unsupported`，原因 `asof_query_unsupported` |
| `full_analysis`、`cefr_label` | `undetermined`。相同 CEFR 標籤不會變成完整可比 |
| `assessment_precision`，任一邊只有學期或未知 | `undetermined`，原因 `insufficient_time_precision` |
| 未列出的 comparisonType | `undetermined` |
| 上下文不是 `valid` | `unsupported` |

`compatible` 只出現在上面第一列這種活動期間。它仍不宣稱正式成果，也不取代 Phase 4A 的 `checkComparison`。
