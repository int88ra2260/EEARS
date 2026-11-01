# Registry 契約

程式位置：`reservation-backend/analytics-contracts/`。版本字串一律 `phase2.v1`。

## Metric

`metricRegistry.js` 的 `getMetricDefinition(metricId)` 回傳：

| 欄位 | 意義 |
|---|---|
| metricId | Phase 2 原 ID |
| version | `phase2.v1` |
| displayName | 顯示名。與 CSV 短名有差異的列在 `05_OPEN_QUESTIONS.md` |
| domainId | 七個領域之一 |
| businessQuestion | 這個 ID 在回答什麼 |
| analysisUnit | 分析單位 |
| populationDefinition | 母體 |
| temporalContractIds | 既有時間契約 ID |
| sourceIds | 來源表或來源名，不是 SQL |
| calculationReference | 既有檔案路徑，不複製公式 |
| implementationStatus | `implemented`、`partial`、`not_implemented`、`unknown` |
| governanceStatus | `proposed`、`pending_decision`、`approved`、`deprecated_candidate` |
| decisionGateIds | D1–D11。有門時治理狀態必為 `pending_decision` |
| evidenceClassification | `descriptive`、`comparative_to_threshold`、`comparative_to_policy`、`descriptive_state`、`longitudinal`、`adjusted`、`associational` |
| claimRestrictions | 不能說的事 |
| legacyReferences | `LM-*` |
| causalClaimAllowed | 目前全部 false |
| officialUseAllowed | 目前全部 false |
| supportsAsOfQuery | 目前全部 false |
| disambiguators | 成對指標為 `['policyKey']`，其餘為空 |
| conflictGroup | `attendance_rate`、`attendance_unit`、`attainment`、`cefr_plus`、`resource`，或 null |
| legacyActive | 舊程式是否仍在產出這個數 |

其他函式：`listMetricDefinitions(filters)`、`getMetricTemporalContracts`、`getMetricDecisionGates`、`getMetricLegacyReferences`。

未實作且維持未實作：

- `ops.participation.streak`：沒有時間契約、沒有來源、治理 `proposed`。
- `roster.pair_pass.both_pairs`：治理 `pending_decision`，門是 D1。

`ops.registration.legacy_has_cefr_b2` 是唯一的 `deprecated_candidate`。

## Temporal Contract

`temporalRegistry.js` 的九個 ID：

1. `TC-OPS-DATE-SEMESTER`：活動日加學期，CAST 日期。
2. `TC-OPS-DATE-STRING`：字串區間，不是 CAST。
3. `TC-BESTEP-FILE-SEMESTER`：名冊／檔案學期。匯入時間不是測驗日。
4. `TC-ROSTER-LIFETIME-DEFAULT`：內建時間窗是 lifetime。
5. `TC-ROSTER-BEST-ASOF-NOW`：讀取當下的最高 rank。指定截止日不支援。不是單次測驗。
6. `TC-EXAM-SESSION`：同工具相鄰梯。學測排除。
7. `TC-EXPOSURE-BEFORE-EXAM`：上一梯結束到這次考試。不是全學期簽到。
8. `TC-SNAPSHOT-VERSION`：快照版本。產生時間不是資料截止。同日版本會覆寫。
9. `TC-TRACE-ROLLING-30D`：近 30 日軌跡。不進分析快照。

每個契約含 `requiredBoundaries`、`optionalBoundaries`、`sourceTimeFields`、`distinguishedTimes`、`asOfPolicy`、`asOfQuerySupported`、`observationWindowPolicy`、`historicalRecalculationPolicy`、`comparisonEligibility`、`limitations`。

`getTemporalContract` 找不到就丟錯。`listTemporalContracts` 回複本。

## Domain 與 Decision Gate

`domainRegistry.js`：`listDomains()`、`getDomain()`。找不到回 `null`。

`decisionGateRegistry.js`：D1–D11，`status: 'pending'`。`getDecisionGate()` 找不到回 `null`。

## 驗證器行為

`contractValidator.js`：

- `validateRegistry()` 回 `{ ok, errors }`。不連資料庫。
- `checkComparison(left, right)`：
  - 同衝突組、不同 ID → `incompatible`
  - 不同 ID、不同衝突組 → `undetermined`（不猜成可比）
  - 同一成對 ID 但缺 `policyKey` → `undetermined`
  - `policyKey` 不同 → `incompatible`
  - 時間契約不同 → `incompatible`
  - 其餘同 ID、同契約 → `compatible`
- `requestAsOf(metricId)`：目前全部 `unsupported`。
- `claimOfficial(metricId)`：未實作回 `not_implemented`；其餘回 `not_approved`。不會回 `allowed: true`。
