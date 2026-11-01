# Legacy 映射

程式：`reservation-backend/analytics-contracts/legacyMappings.js`。

`mappingStatus`：`verified` 只用於 Phase 2 已對到函式與口徑的入口。未逐式核對的 SQL 是 `partial`。沒有 Metric ID 的頁面是 `unmapped`。本階段沒有 `ambiguous`。

## verified（7）

| legacyId | 入口 | Metric |
|---|---|---|
| LM-OP-KPI | `kpiService` 參與、培力出席、培力通過 | 名單簽到人數／率／頻率、`bestep.file.attendance_lr_sw_avg`、`ops.roster.bestep_pass_over_attendance` |
| LM-BT-01 | `bestepClassService.buildClassBestepOverviewStatistics` | 培力分數、等級、單科、四項 |
| LM-BT-04 | `learningPartnerOutcomeService` | `partner.score_gap` |
| LM-LA-02 | `kpiReportService.runKpiReport` | 聽讀成對、說寫成對。`policyKey` 區分 CEFR 與分數合計 |
| LM-LJ-01 | `b2ReportService.getSemesterB2Report` | `roster.best_skill_rank_b2`、`roster.best_skill_state` |
| LM-LA-03 | b1-plus 路由 | `snapshot.near_b2_gse` |
| LM-LA-10 | `lvaAnalyticsService.estimatePolicy` | `snapshot.resource_effect` |

## partial（7）

| legacyId | 原因 |
|---|---|
| LM-OP-01 | 預約總覽的列、簽到列、名額、legacy `hasCEFRB2` 已讀到；活動場次未逐欄對完前端 |
| LM-BT-02 | 培力報名統計 SQL 未重讀，沒有新 Metric ID |
| LM-LA-08 | 前後梯與校正成長的頁面欄位未逐欄核對 |
| LM-LA-SNAPSHOT | 考試格旗標已讀；學生層 `b2plusRate` 分子仍部分驗證，不另造 ID |
| LM-LA-13 | 成長段計數存在；模型執行契約未重讀 |
| LM-TRACE-30 | 前端 `days: 30` 已讀；聚合 SQL 未逐式核對 |
| LM-ET-GSE | 重算腳本用途已讀；分組頁公式未逐式核對 |

## unmapped（3）

`LM-SURVEY`、`LM-WEEKLY`、`LM-SPEAKING`。頁面仍在，不在 32 個 ID 裡，也不標成已消失。

## 明確分開的口徑

出席率沒有收成一筆：

- `ops.reservation.checkin_row_rate` → LM-OP-01
- `ops.roster.distinct_checkin_rate` → LM-OP-KPI
- `bestep.file.attendance_lr_sw_avg` → LM-OP-KPI

達標沒有收成一筆：

- 培力四項 → LM-BT-01
- 行政通過率（分母是出席） → LM-OP-KPI
- 名冊成對 → LM-LA-02（CEFR 與分數合計靠 `policyKey`）
- 歷史最佳 → LM-LJ-01
- 快照考試格 → LM-LA-SNAPSHOT

`englishTestsRouter` 未掛在 `server.js`。本映射沒有把它標成活著的 verified 指標。
