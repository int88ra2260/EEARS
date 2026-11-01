# Shadow 整合

程式：`reservation-backend/analytics-contracts/pilots/activityOpsOverviewPilot.js`

`analytics-contracts/index.js` 會一併匯出它。`server.js` 沒有載入這條路徑，`getOverview` 仍是 `res.json(data)`。

## 用法

```js
const { describeActivityOpsOverview } = require('./analytics-contracts');

const metadata = describeActivityOpsOverview({
  semesterId: '114-2',
  legacyResult,
  populationScope: 'full_center',
});
```

`legacyResult` 可省略。有傳入時只用來標記欄位是否存在，不抄數值，也不寫回原物件。

回傳重點：

- `pilotId`
- `legacyApi`、`legacyService`、`access`
- `populationScope` 固定 `full_center`
- `timeComparison`：舊的含尾日與契約半開區間，以及 `mysqlEquivalenceVerified: false`
- `fields[]`：每個回應欄位的 `mappingStatus`、`metricId`、`temporalContractId`、`analysisUnit`、`timeField`、`populationDefinition`、`temporalContext`
- `verificationStatus: synthetic_contract_only`
- `sqlExecuted: false`
- `countsRecomputed: false`

活動日欄位的 `temporalContext` 由 `buildTemporalContext` 產生，契約是 `TC-OPS-DATE-SEMESTER`，邊界是 `{ eventSemesterRange: { semesterId } }`。`englishPassRate` 用 `TC-BESTEP-FILE-SEMESTER` 與 `{ fileSemester: { semesterId } }`，避免把報名學期標籤放進活動日區間。

缺少 `semesterId` 會丟 `MISSING_REQUIRED_BOUNDARY`。指標與時間契約不配對會丟 `UNSUPPORTED_TEMPORAL_CONTRACT`。未知 Metric ID 會丟 `METRIC_NOT_FOUND`。`reservations.createdAt` 不能通過 `assertEventTimeField`。

未知回應欄位由 `resolveResponseField` 回 `unmapped`，`metricId` 為 null。
