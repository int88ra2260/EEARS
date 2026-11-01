# Shadow report

`evaluateBestepFileQuality(input)` 的回傳：

- `pilotId`: `bestep-file-quality`
- `evaluationScope`: `batch`
- `status`: `complete`、`partial`、`insufficient_evidence`、`conflicting`
- `batchQuality`、`currentStateQuality`、`historicalImportQuality`
- `dimensions`：Q1–Q6。技能列用 `accepted[0]` 這類索引，不含學號
- `counts`：每個計數有 `value`、`availability`、`denominator`
- `findings`：code、severity、count、verificationStatus `contract_only`
- `limitations`：固定說明四技能不是多次考試、缺席未知不是缺考、同步日不是來源日、歷史未還原、未提供的投影通道未檢查、此報告不是 L3
- `governance`：四個旗標都是 false
- `verificationStatus`: `contract_only`

沒有 0–100 品質分數。沒有學生能力高低。沒有 B2 達標判定。

`historicalImportQuality` 在歷史集合已提供時是 `not_claimed`。未提供時是 `not_observed`。兩種都不是 `complete`。

`insufficient_evidence` 用在完全沒有列，或只有學期而沒有任何集合。此時列數是 null，不是 0。

`conflicting` 用於 `PROJECTION_CONTENT_CONFLICT` 或 `DATE_CONFLICT`。確認連結仍留在 `projectionConsistency.checks`。

覆蓋率的 `denominatorDefinition` 寫明分子是本次 accepted rows、分母是本次提供的 success 人數。
