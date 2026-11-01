# 權限矩陣

判斷使用 `buildAccessProfile` 與 `canAccessAdminRoute`，沒有另一套規則。

| 身分 | 進入 Hub | 活動總覽 | 班級列表 | 學習成效 |
|---|---|---|---|---|
| admin | 可 | 可 | 可 | 可 |
| executive teacher | 可 | 可 | 可 | 可 |
| ET / IF / JT manager | 可 | 不可 | 可 | 不可 |
| regular teacher | 可 | 不可 | 可 | 不可 |
| 只有 `can_view_learning_analytics` | 可 | 不可 | 不可 | 可 |
| 有活動分析、沒有學習分析 | 可 | 不可 | 可 | 不可 |
| office staff `event_lead` | 不可，403 | 不可 | 不可 | 不可 |
| 沒有 role | 未登入 | 未登入 | 未登入 | 未登入 |

Hub 規則沿用 `allowAdminOrExecutive`，並接受既有權限：`can_view_analytics`、`can_export_reports`、`can_view_classes`、`can_view_learning_analytics`、`can_manage_learning_analytics_settings`。

無權限的項目顯示「沒有權限」，不是連結。後台 layout 仍會擋直接網址。前端隱藏不是授權。
