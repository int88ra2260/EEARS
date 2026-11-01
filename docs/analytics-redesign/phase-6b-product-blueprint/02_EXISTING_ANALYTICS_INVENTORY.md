# 現有分析入口

以下都在 `App.js` 掛載，不是文件裡的草稿。舊網址會導向新頁，不當成第二套功能。

| 畫面 | 路由 | 權限 | API | 時間 |
|---|---|---|---|---|
| 活動營運總覽 | `/admin/analytics/overview` | `adminOnly`／`requireFullCenterAnalytics` | `GET /api/analytics/overview?semester&kind=reservation`，另有容量明細 | 查詢學期是活動學期標籤；活動列用活動日。`englishPassRate` 是報名學期的 B2 標記 |
| 高風險追蹤 | `/admin/analytics/risk` | admin／executive | 既有風險 API | 未在這次重審 |
| 營運報表 | `/admin/reports` | `can_export_reports` | `reportsRouter` | 既有報表 |
| 教學儀表板 | `/admin/teachers/dashboard` | `can_view_analytics` 或老師的 `can_view_classes` | 教師範圍 | 本人，不是全中心 |
| 班級 BESTEP | `/admin/classes/:classId/bestep` | 班級存取 | `GET /api/admin/classes/:id/bestep-overview` | 畫面上的學期篩選不是考試日。成績匯入的 `examDate` 仍是 null |
| 學習成效 | `/admin/learning-analytics/overview` 及 kpi、cohorts、offerings、resources、skills、b1-plus、explore、tracking、students、raw-data | `can_view_learning_analytics` | `/api` 下的 `learningAnalyticsRouter`，`ljView` | 各頁自己的學期與快照，不等於活動日 |
| 成效設定 | `/admin/learning-analytics/settings` | `can_manage_learning_analytics_settings` | settings 路由 | 設定頁 |
| 學習歷程 | `/admin/learning-journey` | `can_view_english_test_tracking` 或管理權 | `learningJourneyRouter` | 歷程學期 |
| 問卷分析 | `/admin/survey-analytics` | `can_view_survey_analytics` | `adminSurveyAnalyticsRouter` | 問卷自己的時間 |
| 學生舊查詢 | `/admin/analytics/students` | 隱藏 | 導向學習歷程 | 不要再做成新分析 |

`/admin/analytics/trends` 與 `teacher-impact` 已導回總覽。趨勢資料仍可由總覽以 `kind=reservation` 讀取，不是獨立產品。
