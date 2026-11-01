# 既有學習分析契約

以下以目前程式為準。本階段沒有新增後端 API，也沒有改 SQL。

## 路由

| 路徑 | 頁面 | 權限 |
|---|---|---|
| `/admin/analytics` | `AnalyticsHubPage` | 既有 Hub 規則 |
| `/admin/learning-analytics` | `LearningAnalyticsLayout`，導向 overview | `can_view_learning_analytics`，或 admin／executive |
| `/admin/learning-analytics/resources` | `LearningAnalyticsResourcesPage` | 同上 |
| `/admin/learning-analytics/skills` | `LearningAnalyticsSkillsPage` | 同上 |
| `/admin/learning-analytics/offerings` | `LearningAnalyticsOfferingsPage` | 同上 |
| `/admin/learning-analytics/overview` | `LearningAnalyticsOverviewPage` | 同上 |
| `/admin/learning-analytics/students` | `LearningAnalyticsStudentJourneyPage` | 同上 |
| `/admin/learning-analytics/raw-data` | `LearningAnalyticsRawDataPage` | 同上 |
| `/admin/learning-analytics/explore` | 學生探索。`student-explorer` 會導向這裡 | 同上 |
| `/admin/learning-journey` | 學習歷程主頁 | 既有歷程規則，與成效分析分開 |

Hub 的學習入口只有上面四條既有路徑：資源覆蓋、個人軌跡、課／師／活動、能力總覽。沒有第二個 Learning Hub，也沒有把學號放進 Hub。

## 這次用到的 API

`GET /api/admin/learning-analytics/meta`

`GET /api/admin/learning-analytics/resources`

控制器 `getResources` 組出 `resourceEffectiveness`、`skillExposure`，並固定 `causalClaimAllowed: false`。同一包還有準因果估計陣列；資源頁不渲染那些陣列。

`resourceEffectiveness` 一列的既有欄位包含 `participantCount`（該資源 `studentId` 的不重複集合大小）、`growthSampleSize`、`rawGrowthAverage`、`evidenceLevel`、`causalClaimAllowed`、`interpretation`、`mainSkills`。

`skillExposure.byResource[].events` 是事件次數。頁面只顯示這個次數，不顯示時數，避免把缺少時數時的內部計數講成授課時數。

`GET /api/admin/learning-analytics/skills` 仍由既有技能成長頁讀取。本階段沒有改它的計算。

## LVA

契約版本仍是 `lva.analytics.response.v1`。`causalClaimAllowed` 維持 false。校正後成長、預期成長、CEFR 對照、評量來源優先序都沒有改。

## 這支資源 API 沒有的東西

資源回應沒有排除原因明細，也沒有把匿名事件標成 `not_observed`。頁面因此不自造排除原因，也不把所有 null 標成未觀察。
