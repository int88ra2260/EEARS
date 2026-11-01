# 6B.2 驗收條件

下一個實作只做分析首頁。完成時要同時滿足：

- 路由是 `/admin/analytics`，`/admin/analytics/overview` 與 `/admin/analytics/risk` 仍開得到。
- 沒有權限的角色看不到營運卡，直接打總覽 API 仍是 403。
- 首頁不呼叫會重算 KPI 的新端點，也不改 `passRate`。
- 頁上能讀到：報名 B2 標記不是活動成效、班級通過率尚未核定、未知出席不是缺席。
- 學習成效連結只在已有 `can_view_learning_analytics` 時出現。
- 學期下拉不放在這頁。
- 空的權限集合顯示說明，不顯示 0 分。
- 桌面與 390 寬度沒有整頁橫向溢出。
- 既有活動總覽與班級 BESTEP 測試仍通過。

不在 6B.2 驗收：L3、F-BESTEP-01 選定、Shadow 開啟、新圖表、因果句、正式部署。
