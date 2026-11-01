# 放行門檻

| 門檻 | 狀態 |
|---|---|
| Engineering | 前端單元、Playwright、LVA 契約子集、ESLint、build 已在 Node 20 跑過。完整後端 Jest 未重跑。 |
| Browser | 30 passed。等級是 harness 內的真實元件與路由，不是正式環境登入。 |
| Full route E2E | 未做。Harness 沒有 AdminLayout，也沒有正式 API。 |
| Screen reader | 未測。不標已驗收。 |
| Staging | 未部署。仍待外部核准。 |
| Production | 未部署。 |
| Official reporting | 未核准。資源覆蓋與校正後進步都不是官方成效結論。 |

Shadow 預設關閉。沒有讀 Shadow 日誌，也沒有做 L3 真實資料驗證。
