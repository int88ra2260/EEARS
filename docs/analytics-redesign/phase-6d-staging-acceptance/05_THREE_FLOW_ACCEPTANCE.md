# 三領域 Staging Acceptance Matrix

狀態：Staging 實測 **NOT_TESTED**。本機 Application Integration（合成認證）已於 Phase 6C PASSED，僅可作工程參考，不可替代 Staging。

## F1 — Operations

**流程：** `/admin/analytics` → `/admin/analytics/overview` → `/admin/operations`

| 檢查項 | 預期 | Staging |
|---|---|---|
| 有權管理者可進入 Hub／Overview | allowAdminOrExecutive | NOT_TESTED |
| 指標母體說明正確 | 不把預約筆數當學生人數 | NOT_TESTED |
| 學期 Filter | 與 API 一致 | NOT_TESTED |
| 營運觀察與 API 一致 | Network 對照 | NOT_TESTED |
| Loading／Error／Empty | 可辨識 | NOT_TESTED |
| 返回 Hub | 導覽正常 | NOT_TESTED |
| 活動列表可載入 | `/admin/operations` | NOT_TESTED |
| B2 標記位置 | 仍在報名補充區 | NOT_TESTED |

相關 API：營運／活動列表既有 admin analytics／events endpoints（以 Staging Network 為準）。

## F2 — BESTEP

**流程：** `/admin/analytics` → `/admin/classes` → `/admin/classes/:classId/bestep` → Student Modal

| 檢查項 | 預期 | Staging |
|---|---|---|
| 班級列表真實載入 | 非 mock | NOT_TESTED |
| `classId` 來自班級列 | 非硬編碼 | NOT_TESTED |
| Legacy Pass Rate 限制 | 存在且標示 | NOT_TESTED |
| 不將 150% 截斷 | 顯示真實百分比 | 資料不足則 NOT_OBSERVED；合成測試可作旁證 |
| 未確認／未匯入出席 | 正確語意 | NOT_TESTED |
| 總分 0／技能 0 | 正確顯示 | 無案例則 NOT_OBSERVED |
| 抵免與出席分開 | UI 分離 | NOT_TESTED |
| Student Modal | 正常開關 | NOT_TESTED |
| 返回班級與 Hub | 正常 | NOT_TESTED |
| Export | 權限閘 + 實際下載（授權允許時） | NOT_TESTED |

**禁止**為湊驗收修改正式／Staging 正式資料。

## F3 — Learning

**流程：** `/admin/analytics` → `/admin/learning-analytics/resources` → `/admin/learning-analytics/skills`

| 檢查項 | 預期 | Staging |
|---|---|---|
| 正確權限 | `can_view_learning_analytics` 等 | NOT_TESTED |
| 參與人數 ≠ 事件數 | 分開呈現 | NOT_TESTED |
| 學期切換 | 正確 | NOT_TESTED |
| 資料品質解讀 | Evidence Quality 可展開 | NOT_TESTED |
| 空資料 ≠ 沒有學習 | 文案正確 | NOT_TESTED |
| Growth 非因果 | `causalClaimAllowed=false` 限制可見 | NOT_TESTED |
| 返回 Hub | 正常 | NOT_TESTED |
| 未授權學生資料 | 不顯示 | NOT_TESTED |

## 本機旁證（不可升級為 Staging PASSED）

Phase 6C `appIntegration.browser.mjs`：三流程導覽、history、deep link、guard — 6 passed（合成 JWT）。
