# Legacy 欄位與契約對照

試點 ID：`PILOT-OPS-OVERVIEW-RESERVATION`

業務問題：指定行政學期內，以活動日篩選的預約營運數字各在數什麼。

既有計算保持在 `analyticsService.getReservationOverview`。下表是說明，不是新的算法。

| 回應欄位 | 狀態 | Metric ID | Temporal Contract | 單位 | 時間欄位 |
|---|---|---|---|---|---|
| semester | unmapped | — | — | 參數回顯 | — |
| totalReservations | mapped | ops.reservation.row_count | TC-OPS-DATE-SEMESTER | 預約列 | events.date |
| totalEventCapacity | unmapped | — | — | 名額加總，只作分母 | events.date |
| bookingRate | mapped | ops.capacity.reservation_over_seats | TC-OPS-DATE-SEMESTER | 預約列 / 名額 | events.date |
| attendanceRate | mapped | ops.reservation.checkin_row_rate | TC-OPS-DATE-SEMESTER | 預約列 | events.date |
| violationRate | unmapped | — | — | 沒有對應指標 | events.date |
| englishPassRate | mapped | ops.registration.legacy_has_cefr_b2 | TC-BESTEP-FILE-SEMESTER | 報名列 | english_test_registrations.semester |
| capacityBreakdown | unmapped | — | — | 巢狀場次與類型 | — |

`ops.event.count` 沒有出現在這支回應的頂層欄位，所以沒有配上去。`ops.roster.distinct_checkin_students` 與 `ops.roster.distinct_checkin_rate` 屬於名單參與，時間契約是 `TC-OPS-DATE-STRING`，也不能拿來解釋這支 API。

## 114-2 的兩種終點

| 寫法 | 起點 | 終點 |
|---|---|---|
| 舊 SQL | `2026-02-01` 含當天 | `2026-07-31` 含當天 |
| 契約半開區間 | `2026-02-01T00:00:00+08:00` | `2026-08-01T00:00:00+08:00` 不含 |

`compatibilityStatus` 是 `legacy_inclusive_cast_vs_half_open_unverified`。`mysqlEquivalenceVerified` 是 false。

## 可以支持的說法

- `totalReservations` 是預約列數，不是學生人數。
- `attendanceRate` 是已簽到列除以全部預約列。
- 篩選用的是活動日，不是預約建立時間。
- 學期邊界來自 `shared/semesterConfig.js`。
- `englishPassRate` 是報名表標記，時間是檔案學期，不是上面的活動日區間。
- 這些指標的 `officialUseAllowed` 與 `causalClaimAllowed` 都是 false。`englishPassRate` 的治理狀態是 `deprecated_candidate`。

## 還不能說的話

- 不能說違規率已有契約指標。
- 不能說名額加總本身是一個 Metric ID。
- 不能說名額分項整包等於活動場次。
- 不能說半開區間已經在 MySQL 上得到與 CAST `BETWEEN` 相同的筆數。
- 不能把數字說成某個班級或某份名單的結果。
