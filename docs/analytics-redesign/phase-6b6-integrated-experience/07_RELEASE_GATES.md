# Release gates

| Gate | 狀態 | 依據 |
|---|---|---|
| Engineering | 本階段前端回歸通過，後端只跑契約與權限子集 | 見 `06_REGRESSION_REPORT.md`。完整後端 Jest 是 Pending |
| Route browser | ROUTE_BROWSER_ACCEPTED | Playwright 35 passed。MemoryRouter，合成 API |
| Full login E2E | 未做 | 沒有掛 AdminLayout，沒有登入 |
| Screen reader | 未做 | 沒有報讀器腳本 |
| Staging | STAGING_PENDING_EXTERNAL_APPROVAL | 沒有部署到 staging |
| Production | 未部署 | 沒有 push、沒有部署 |
| Official reporting | 未核准 | `officialUseAllowed` 與 `causalClaimAllowed` 仍為 false。既有通過率不是官方達標率 |

Shadow 仍預設關閉。本階段沒有開啟，也沒有顯示即時品質分數。

不可以把這次的路由驗收寫成正式環境已驗證，也不可以把契約測試寫成全後端回歸已通過。
