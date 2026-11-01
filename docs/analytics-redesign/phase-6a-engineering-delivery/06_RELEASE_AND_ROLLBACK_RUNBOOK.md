# 發布與回退

現在不能執行。需要發布負責人同時寫明來源 SHA、目標 SHA，以及只要 fast-forward。

預期：

- 來源：`174beebb84ced6d99ebd183a826c10b3ad30a512`（`release/analytics-engineering-rc`）
- 目標現值：`1f41dd5202c5672076ab3181e563effb172823fe`
- 條件：`merge-base --is-ancestor` exit 0，behind 0，沒有工作樹正 checkout 且弄髒 `main`

比較舊值再移動指標的做法寫在 `docs/analytics-redesign/phase-5b1-main-integration-approval/06_MAIN_INTEGRATION_RUNBOOK.md`。那份文件裡的核准 SHA 是較早的 `c811680`。若要包含 Phase 5B.1 與本階段文件，核准對象應改成當時的 Analytics HEAD，而不是照抄 `c811680`。

快轉後用 Node 20 重跑 `02_NODE20_REGRESSION.md` 的命令。Shadow 變數保持不設。

失敗時不要自動 reset。未推送則請負責人決定是否回到 `1f41dd5`。已推送則 revert，不要 force push。

本階段沒有 push，沒有部署。
