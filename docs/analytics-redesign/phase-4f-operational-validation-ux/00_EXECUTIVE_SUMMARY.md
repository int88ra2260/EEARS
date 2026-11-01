# Phase 4F 摘要

本階段確認活動營運總覽每個主要數字在程式裡怎麼算，並為中心主任與行政人員起草之後的畫面結構。沒有改 SQL、沒有改前端、沒有查資料庫。

Phase 4E 已以本機 commit `ae76742` 固定。訊息是 `feat(analytics): integrate operational semantic shadow validation`。

## 現在可以確定的事

`GET /api/analytics/overview?semester=114-2&kind=reservation` 的母體是全中心、以活動日篩選的預約列與活動列。權限只決定誰看得到，不縮小母體。

- 總預約是還留在資料表上的預約列，不是學生人數。成功取消會刪掉該列。
- 名額率的分母是區間內所有場次的 `maxCapacity`，包含沒有人預約的場次，也包含對學生隱藏的場次。
- 簽到率與違規率的分母都是這批預約列。違規率看的是預約列上的 `checkinStatus`，不是 `event_violations` 的列數。
- `englishPassRate` 是另一段報名表查詢。它不是活動成效。
- `semester` 是查詢回顯。這支 API 只用 `shared/semesterConfig.js` 的 114-2（2026-02-01 到 2026-07-31，含尾日）。學習歷程另有一套會讀 `semesters` 與 `et_semesters` 的篩選，這支總覽不用。

## 還不能當成正式資料結果的事

含尾日 `CAST` 與半開區間在 MySQL 是否同一批活動、違規表與預約狀態是否每筆相符、頂層數字與分項在實際資料上是否一致、`semesters` 表的 114-2 日期是否與設定檔相同。這些都留在 L3 草案，本階段沒有執行。

## 畫面建議

維持現有 API 與頁面。下一輪若改介面，以主任的六個決策問題當第一屏，把現有的類型表、場次表、趨勢與班級排行留在第二層。報名 B2 標記不進入營運 KPI。

詳細口徑、Finding 狀態、SQL 草案與遷移步驟見同目錄 `01` 到 `09`。
