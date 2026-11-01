# 權限與隱私

沿用 `auth/permissions.js` 與 `adminNavigation.js`。前端隱藏不是授權。

| 角色或權限 | 看得到 | 看不到 |
|---|---|---|
| admin、executive（`hasAdminRights`） | 活動總覽、風險 | 不因這次新增個人名冊 |
| `can_view_analytics` | 分析選單、教學儀表板 | 全中心總覽仍要 admin 權 |
| 老師且 `can_view_classes` | 自己的教學儀表板、有權限的班級 BESTEP | 別人的學生列 |
| `can_view_learning_analytics` | 學習成效各頁 | 設定頁要另一個權限 |
| `can_manage_learning_analytics_settings` | 設定 | |
| `can_export_reports` | `/admin/reports` | |
| `can_view_survey_analytics` | 問卷分析 | |
| `bestep_ops` 工讀 | 英檢管理 | 中心營運總覽 |
| 副主任、行政人員 | 依既有 `opsDashboard` 規則被排除 | 不要用新 Hub 把他們放進來 |
| 學生 | 自己的預約與紀錄 | 管理分析 |

班級 API 已有 `assertCanAccessClass`。學生層明細維持現有 scope guard。Hub 若只放連結，不新增個人資料回應。匯出仍走原本的 export 權限。
