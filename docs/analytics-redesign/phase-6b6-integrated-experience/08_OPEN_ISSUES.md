# 未完事項

- Phase 6B.6 保持未提交，等驗收。沒有 push、merge、rebase 或部署。
- 完整後端 Jest 標為 `FULL_BACKEND_REGRESSION_NOT_RUN`。
- 直接輸入被拒絕的網址，仍須在掛了 AdminLayout 的環境確認。Harness 會把頁面直接掛上。
- 活動列表在整合測試裡是標題替身。簽到、違規、報表與班級明細頁沒有納入這次的點擊流程。
- 螢幕報讀器、正式登入 E2E、staging 與正式環境都還沒做。
- 班級 BESTEP 的 `updatedAt` 缺值仍可能顯示 Invalid Date。本階段沒有改。
- F-BESTEP-01 與 D1–D11 仍是政策待決。沒有新的官方 KPI。
- 一般教師的活動分析權限不能打開活動營運總覽。這是既有 `allowAdminOrExecutive` 規則，不是這次要放寬的項目。

下一階段若要做，應是正式登入下的三條流程與 route guard，而不是再加統計或跨領域聚合 API。
