# 欄位層級契約

Phase 4D 的 pilot 仍把 `semester`、`totalEventCapacity`、`violationRate`、`capacityBreakdown` 標成 `mappingStatus: unmapped`，而且 `metricId` 維持 null。那個測試契約沒有改。Phase 4E 另外用語意類型說明它們，避免為了對到指標而改寫舊測試，也避免把非指標塞進登錄。

實作：`analytics-contracts/pilots/activityOpsFieldContract.js`。

## 類型

| semanticType | 這支 API 裡的用法 | 是否給正式 Metric ID |
|---|---|---|
| `metric` | 預約列數、名額率、簽到列比率 | 用既有 ID |
| `legacy_supplement` | `englishPassRate` | 用既有的報名標記率，並標成跨領域 |
| `query_context` | 學期代碼與含尾日日期 | 不給 |
| `dimension` | 類型、場次 id、名稱、原始活動日字串 | 不給 |
| `breakdown` | 分項物件與三個陣列 | 不給 |
| `derived_value` | 名額總數、違規率、類型與單場的切片數字 | 不給。違規率只留提案 |
| `unknown` | 這次沒有需要 | 不給 |

頂層 8 個鍵全部落在上表。巢狀 26 個路徑也全部落在上表。沒有欄位被標成 `unknown`。日期邊界與跨表同步仍是 `partial` 或文件中的 UNKNOWN，那是驗證狀態，不是語意類型。

## 已對到的既有指標

| 欄位 | Metric ID | 時間契約 | 母體 |
|---|---|---|---|
| `totalReservations` | `ops.reservation.row_count` | `TC-OPS-DATE-SEMESTER` | 活動日區間內的預約列 |
| `bookingRate` | `ops.capacity.reservation_over_seats` | `TC-OPS-DATE-SEMESTER` | 預約列 / 全部場次名額 |
| `attendanceRate` | `ops.reservation.checkin_row_rate` | `TC-OPS-DATE-SEMESTER` | 已簽到列 / 預約列 |
| `englishPassRate` | `ops.registration.legacy_has_cefr_b2` | `TC-BESTEP-FILE-SEMESTER` | 該學期報名列 |

`englishPassRate` 可以支持的結論只有：這批報名列裡，舊的 B2 標記有多少被填成肯定值。它不能支持「參加活動後英語變好」。前端營運頁目前也不顯示它。時間欄是報名表的學期標籤，與 `events.date` 不能直接比較。

## 不當成新指標的欄位

1. `semester` 與分項裡的學期、起迄日是查詢上下文。
2. `totalEventCapacity` 與各類型、各場名額是 `ops.capacity.reservation_over_seats` 的分母或切片。
3. `capacityBreakdown.items` 與 `byEventType` 是同一組類型數字的兩種形狀。
4. 類型與單場的預約列、比率，是既有列數與名額率的 breakdown。

## 提案，未進登錄

只有違規率屬於「獨立、而且登錄裡沒有」的量。

| 項目 | 內容 |
|---|---|
| Proposed Metric ID | `ops.reservation.violation_row_rate` |
| Status | `PROPOSED`，`registryStatus: not_registered` |
| Business Definition | 活動日區間內，已登記違規的預約列佔全部預約列的百分比 |
| Population | 與 `ops.reservation.row_count` 同一批預約列。一人多列則多計 |
| Calculation | `safePct(checkinStatus 為已登記違規的列數, 預約列數)` |
| Temporal Contract | `TC-OPS-DATE-SEMESTER` |
| Evidence | `getReservationOverview` 已有這段條件。沒有讀 `event_violations` |
| Reason | 它不是出席率或名額率的別名 |

Shadow 報告不會帶出這個提案 ID。`listMetricDefinitions()` 仍是 32 筆。

## 契約物件會帶的內容

每張卡片至少有 `fieldPath`、`semanticType`、`metricId`、`temporalContractId`、`population`、`sourceTables`、`verificationStatus`。有正式指標的欄位才填 `metricId`。其餘是 `null`。
