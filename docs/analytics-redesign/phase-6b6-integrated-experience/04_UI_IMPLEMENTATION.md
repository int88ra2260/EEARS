# 介面實作

改的是既有 `AnalyticsHubPage`，加上 `AnalyticsHubReturn`。

## Hub

- 三個領域都是 `h2`，下面一段簡介、一段範圍、然後「主要入口」與「其他入口」。
- 主要入口是活動營運總覽、班級列表、資源覆蓋。其餘維持次要入口。
- 沒有權限的項目是文字「標籤：沒有權限」，不是連結。
- 資料品質卡沒有連結。
- 所有 Hub 連結都不含 `?`。

## 返回

`AnalyticsHubReturn` 先呼叫 `canAccessAdminRoute(profile, '/admin/analytics')`。沒有權限就不會出現。連結是 `<Link to="/admin/analytics">`，不呼叫 `navigate(-1)`。

| 頁面 | 返回 |
|---|---|
| 營運總覽 | 原有 `operationsObservation.hubPath`，沒有再加一顆 |
| 班級列表 | 工具列上方的 Hub 返回 |
| 班級 BESTEP | 標題列下方的 Hub 返回；「返回班級列表」仍在 |
| 資源覆蓋、技能成長 | 頁框 actions 的 Hub 返回 |

學習頁用 outlet token，沒有時才用既有 localStorage token。正式環境的 `LearningAnalyticsLayout` 本來就不轉傳 outlet，所以這個 fallback 讓既有頁也能判斷 Hub 權限。Harness 有 outlet token。這不是新的登入方式。

## 沒有改的呈現

營運、BESTEP、學習頁的數字、空狀態與錯誤警示維持前幾階段。沒有新的 dashboard 框架，也沒有假的全域學期控制。
