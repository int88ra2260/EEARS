# 連結與權限

五個目標都已掛在 `App.js`，並有既有 `adminRouteAccess` 規則。連結由 `canAccessAdminRoute(buildAccessProfile(...))` 決定。沒有放寬權限定義。卡片隱藏不是授權；進頁仍走既有 route guard。

這些頁不讀總覽的查詢字串。活動列表與簽到頁的活動類型是頁內 state。因此連結不帶 `semester` 或 `eventType`。

| 連結文字 | 路徑 | 既有權限重點 | 傳遞 |
|---|---|---|---|
| 開啟活動列表 | `/admin/operations` | 活動管理 | 不傳。提示自行篩選 |
| 開啟簽到參與統計 | `/admin/operations/participation` | 同上 | 不傳活動類型 |
| 開啟違規管理 | `/admin/violations` | 黑名單／違規 | 不傳活動日期 |
| 開啟高風險行政追蹤 | `/admin/analytics/risk` | 管理員或行政主管 | 該頁自有學期控制 |
| 開啟營運報表 | `/admin/reports` | 匯出報表。行政主管身分本身不夠 | 不傳活動類型 |
| 返回成效分析中心 | `/admin/analytics` | Hub 既有規則 | 無查詢 |

管理員與行政主管看得到全部五個連結。一般教師看得到觀察與返回中心，看不到上述管理連結。單元測試用的未解析 token 沒有任何連結。

Hub 仍是入口。側欄沒有新增第二個營運選單。BESTEP 與學習成效導覽沒有改。
