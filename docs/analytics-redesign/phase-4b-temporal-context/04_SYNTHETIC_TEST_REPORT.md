# 合成測試報告

指令（於 `reservation-backend`）：

```text
npx eslint analytics-contracts tests/analytics-contracts
npm test -- --runInBand tests/analytics-contracts
```

ESLint 通過。Jest 6 個 suite、45 個測試通過，其中包含 Phase 4A 的 registry integrity 與語意測試。沒有連資料庫，沒有真實學生。測試沒有讀取 `new Date()` 當學期或窗的終點。

T19 以 `TZ=UTC` 與 `TZ=Pacific/Kiritimati` 各跑一次同一個建立函式，114-2 的起迄字串相同。

## T01–T20

| ID | 結果 |
|---|---|
| T01 | 114-2 活動窗是 2026-02-01 含、2026-08-01 不含 |
| T02 | 活動日與匯入時間語意不同；`cutoffAt` 無法對應 |
| T03 | 只有工具與快照版本時，測驗精度是 `unknown` |
| T04 | 名冊學期的安全邊界沒有起迄，也沒有 data as of |
| T05 | `historical_as_of` 是 unsupported；帶 `asOfDate` 會丟錯 |
| T06 | baseline 晚於 follow-up 為 `INVALID_TIME_RANGE` |
| T07 | `2026-03-31T16:30:00Z` 成為 `2026-04-01T00:30:00+08:00` |
| T08 | 7 月 31 日晚間在 114-2 內，8 月 1 日零時與對應的 UTC 瞬間不在窗內 |
| T09 | 快照時間若 role 是 `data_as_of` 則拒絕 |
| T10 | 不同工具的 `cefr_label` 比較是 undetermined |
| T11 | 只有檔案學期時精度是 `semester` |
| T12 | CAST 與字串契約的活動窗比較是 incompatible |
| T13 | 未知指標是 `METRIC_NOT_FOUND` |
| T14 | 未知契約是 `TEMPORAL_CONTRACT_NOT_FOUND` |
| T15 | 活動場次指標配滾動 30 日契約被拒絕 |
| T16 | 成對政策窗是 undetermined，原因 `policy_not_approved` |
| T17 | 沒有時區的 timestamp 被拒絕 |
| T18 | `2026-02-30` 被拒絕 |
| T19 | 兩個 TZ 的輸出相同 |
| T20 | 改輸入物件不會改已建立的上下文；改凍結結果會丟 TypeError |

另外確認：不在設定表的 `090-1` 不會被月曆補上；滾動窗缺 `windowEnd` 會缺邊界；匯入欄位不能塞進測驗日。

## 沒有測到的能力

沒有對真實 `events.date` 列做 CAST 與字串比對。沒有讀 `et_semesters`。沒有證明舊 SQL 的含尾日與這份半開區間在資料庫上的筆數相同。那些要等以後的 adapter，不能用這次的通過來代替。
