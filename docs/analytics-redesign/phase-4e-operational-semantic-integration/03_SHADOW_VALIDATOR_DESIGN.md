# Shadow Validator

檢查器在 `analytics-contracts/pilots/activityOpsShadowValidator.js`。開關與錯誤隔離在 `activityOpsShadowRuntime.js`。兩者都不載入 `analyticsService`、Sequelize 或模型。

## 執行位置

```text
getReservationOverview 回傳
        │
        ├─ res.json(原本的物件)
        └─ 僅 kind=reservation 且 flag 開啟
              runActivityOpsShadow
                    └─ validateActivityOpsOverview
```

Validator 不參加計算。它不呼叫 `getReservationOverview`，不發 SQL，也不寫回 legacy 物件。

## 啟用

環境變數 `ANALYTICS_SEMANTIC_SHADOW_ENABLED` 必須是字串 `true`（大小寫不拘）。除此之外還要同時滿足：

- `NODE_ENV` 不是 `production`
- `NODE_ENV` 是 `test`、`development` 或 `staging`

少了 flag、flag 不是 `true`、沒有 `NODE_ENV`，或 `NODE_ENV=production`，都回傳 `null`，而且不會呼叫 validator。正式的 PM2 設定 `ecosystem.config.cjs` 把 `NODE_ENV` 設成 `production`，且沒有這個 flag。因此正式程序預設不會跑 shadow。以後若要在正式環境做，要另外核准，不能只靠把 flag 打開。

`NODE_ENV` 只用來擋正式環境與限制允許名單。真正的開關是 flag。

## 讀什麼

- 這次請求的 `semesterId`
- 已經取得的 legacy 物件
- 記憶體裡的 Metric Registry 與欄位卡片

靜態卡片在模組載入時讀一次。沒有另外做快取服務，也沒有背景工作。陣列最多看前 200 列的鍵，超過會記一筆 `UNVERIFIED_LEGACY_CALCULATION`，仍然不查資料庫。

## 報告

```js
{
  pilotId: 'PILOT-OPS-OVERVIEW-RESERVATION',
  status: 'partial',
  validatedFieldCount: 8,
  unmappedFields: ['violationRate'],
  warnings: [],
  errors: [],
  metricContractVersion: 'phase2.v1',
  temporalContractId: 'TC-OPS-DATE-SEMESTER',
  semesterId: '114-2',
  fields: []
}
```

`fields` 只含頂層、而且這次物件裡真的有的欄位。內容是路徑、語意類型、Metric ID、時間契約與驗證狀態，沒有統計數字。

`semesterId` 只接受 `114-2` 這種三碼加學期別。其他字串改記 `null`，避免把任意查詢字串抄進診斷。

正常的八欄物件會是 `partial`，因為固定會有兩類警告：含尾日 CAST 尚未證明等於半開區間，以及公式只讀過程式、沒有重算。`englishPassRate` 另有跨領域警告。`violationRate` 出現在 `unmappedFields`。

## 診斷碼

| 碼 | 何時出現 |
|---|---|
| `FIELD_UNMAPPED` | 違規率沒有已核准的 Metric ID |
| `METRIC_CONTRACT_NOT_FOUND` | 綁定指向登錄裡沒有的 ID。提案 ID 走這條時也不會被寫進登錄 |
| `TEMPORAL_CONTRACT_MISMATCH` | 指標宣告的時間契約不含這次指定的契約 |
| `POPULATION_DEFINITION_MISSING` | 綁定沒有母體說明 |
| `CROSS_DOMAIN_LEGACY_FIELD` | `englishPassRate` 出現時 |
| `UNVERIFIED_LEGACY_CALCULATION` | 結果不是物件、分項型別不對、列數超過檢查上限，以及「尚未重算」這條固定警告 |
| `UNSUPPORTED_TIME_COMPARISON` | 活動日指標配上非 `events.date` 的時間欄，以及含尾日與半開區間尚未證明 |
| `UNKNOWN_RESPONSE_FIELD` | 契約清單外的鍵，包含分項裡多出來的鍵 |

`status` 在有 error 時是 `error`，否則有 warning 或 unmapped 時是 `partial`。這個狀態只留在程序內部。

每筆診斷只有 `code`、`fieldPath`、`contractId`、`verificationStatus`、固定 `detail`。不複製欄位值、活動名稱、學號、email 或 Authorization。

日誌預設關閉。只有 `ANALYTICS_SEMANTIC_SHADOW_LOG=true` 時才打一行 `console.info`，而且只有 pilot、status 與診斷碼。不會 `console.log` 整包回應。

Validator 自己丟出例外時，runtime 改回一筆 `SHADOW_INTERNAL_ERROR`，不把原始例外訊息往外送。
