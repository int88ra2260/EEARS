# 三條管理流程

| 流程 | 真實路由 | 真實元件 | 合成 API | 驗收 |
|---|---|---|---|---|
| 營運 | `/admin/analytics` → `/admin/analytics/overview` → `/admin/operations` | Hub、`AdminAnalyticsPage`、`AdminHome`／`EventReportTable` | `/api/analytics/*`、`/api/reports/summary`、`/api/event-types` | Application Integration：看到「合成活動」與活動概況 |
| BESTEP | Hub → `/admin/classes` → `/admin/classes/SYN-CLASS/bestep` → 學生 modal | `ClassOverview`、`ClassBestepOverview` | classes overview、bestep-overview | 150% 未被截斷；未確認出席；返回班級與 Hub |
| 學習 | Hub → resources → skills | Resources／Skills 頁 + `LearningAnalyticsLayout` | meta／resources／skills | 非因果說明可展開；返回 Hub |

舊 MemoryRouter harness（35 題基準，現為完整套件的一部分）仍保留。新套件共 41 題。
