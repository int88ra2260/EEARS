# 既有營運契約

總覽以 `kind=reservation` 呼叫既有前端服務。時間欄位是 `events.date`。日期區間來自既有 `SEMESTER_RANGES`；沒有對照時顯示「此學期尚未列入共用日期設定」，不另寫死日期。

| 指標 | 現有來源 | 統計單位 | 時間範圍 | 管理問題 | 可用性 |
|---|---|---|---|---|---|
| 活動總名額 | `GET /api/analytics/overview` 的 `totalEventCapacity` | 名額加總，不是場次數 | 所選學期的活動日期 | 供給名額有多少 | 沿用 API。含零預約與學生端隱藏場次 |
| 預約筆數 | 同端點 `totalReservations` | 預約列。取消成功會刪列 | 同上 | 預約列出現在哪裡 | 可比較類型。不是不重複學生人數 |
| 預約名額比 | 同端點 `bookingRate` | 預約列 ÷ 名額 | 同上 | 名額被預約列佔用的比例 | 直接顯示 API 值。分母含隱藏場次。不解讀成供給不足 |
| 預約列簽到率 | 同端點 `attendanceRate` | 已簽到預約列 ÷ 全部預約列 | 同上 | 預約列有沒有被簽到 | 沒有數值就顯示無法判斷。不分活動類型 |
| 預約列違規狀態比 | 同端點 `violationRate` | 已標違規的預約列 ÷ 全部預約列 | 活動日期，不是違規登錄日 | 是否要再看行政例外 | 不是違規事件表的比例 |
| 類型預約列 | `GET /api/analytics/reservation-capacity-breakdown` 的 `items[].eventType`、`totalReservations`（也接受既有別名 `reservedCount`） | 各類型預約列 | 與總覽同一學期參數 | 預約列集中在哪一類 | 只取現有筆數的最大值；並列就明說沒有單一類型 |
| 報名 B2 標記 | 總覽 `englishPassRate`，僅報名補充區 | 報名列的 `hasCEFRB2` | 報名學期標籤 | 報名背景 | 非成效。不與活動 JOIN，不寫成能力提升 |

趨勢與明細表仍用既有 `/api/analytics/trends`、`/events`、`/classes`。觀察不把這些表加總成第二個總數。

類型表沒有各類型出席數。因此「哪些活動出席較高」沒有可用分母，本階段不計算。
