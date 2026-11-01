# Phase UX-1 — Open Issues

本階段只重構 `/admin/analytics/overview`。下列刻意未做：

1. `/admin/analytics` Hub 視覺精修（僅確認回歸通過）。
2. `/admin/analytics/risk` UI/UX。
3. `/admin/reports` 報表頁。
4. `/admin/classes` 與 `/admin/classes/:classId/bestep` 畫面重構。
5. `/admin/learning-analytics/*`（上呈／找人／看資源／比較與資料）資訊架構與視覺重構。
6. Activity Type 篩選：原頁／API 未支援，本次不新增假篩選器。
7. 正式 Staging／Production 視覺驗收（僅合成 harness）。
8. `englishPassRate` 官方語意決策（仍為補充資訊，非主 KPI）。
9. Metric Registry／`officialUseAllowed`／`causalClaimAllowed`／Shadow 旗標（維持 false／關）。

建議下一階段：擇一做 **BESTEP 班級頁** 或 **Learning Analytics 總覽** 的同等 UX-1 級重構，勿一次並行。
