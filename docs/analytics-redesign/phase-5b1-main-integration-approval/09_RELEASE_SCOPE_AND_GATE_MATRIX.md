# 發布範圍與 Gate

四個範圍分開。`main` 整合通過不會讓右邊的欄位變成完成。

| 範圍 | 現況 | 這次有沒有做 |
|---|---|---|
| Engineering Main Integration | 工程條件成立，核准狀態 `PENDING_APPROVAL` | 只寫 Runbook，沒有移動 `main` |
| Attendance UX Release | 程式在 `ab7a9f5` 與 `1a00599`：未確認出席與總分 0。瀏覽器是合成資料 | 沒有部署 |
| Activity Operations UX Release | 程式在 `087168e` 到 `da4d26e`。`englishPassRate` 留在報名補充區 | 沒有部署 |
| Official Analytics Reporting | F-BESTEP-01、D1–D11、L3 都未完成。治理旗標仍是 false | 沒有核准任何官方 KPI |

| Gate | 狀態 |
|---|---|
| 可請負責人核准快轉 | 是，`READY_FOR_APPROVAL` |
| 已核准並完成快轉 | 否 |
| Staging Accepted | `PENDING` |
| Production Approved | `PENDING` |
| Production Deployed | 否 |
| Data Validated | `PENDING` |
| Business Policy Approved | `PENDING` |
