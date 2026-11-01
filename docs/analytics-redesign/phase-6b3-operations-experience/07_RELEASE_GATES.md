# 放行閘門

| 閘門 | 狀態 |
|---|---|
| Engineering | 本分支已用 Node 20 跑過上列測試與 build。尚未併入 `main`。不是已上線版本 |
| Browser | Harness 元件路徑 24 項通過。不是正式登入、不是正式活動管理頁 E2E |
| Staging | `STAGING_PENDING_EXTERNAL_APPROVAL`。沒有部署到 staging |
| Production | 未核准、未部署 |
| Official reporting | 仍 pending。`officialUseAllowed=false`，不可當正式報表 |

`main` 維持 `1f41dd5202c5672076ab3181e563effb172823fe`。`release/analytics-engineering-rc` 維持 `174beebb84ced6d99ebd183a826c10b3ad30a512`。沒有 push、merge、rebase 或資料庫操作。
