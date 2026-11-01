# 待核准與未決

- 發布負責人尚未核准把 `main` 從 `1f41dd5` 快轉到 `c811680`。在那之前不能執行 Runbook Step 4。
- `integration/analytics-phase5b-candidate` 仍是 `15974e0`。不要把它強制改到 `c811680`。核准對象應寫 Analytics 分支上的 `c811680`。
- Phase 5B.1 文件尚未提交。
- `D:/EEARS` 仍有未追蹤的 `.mysql-data/`、SQL dump 與 `presentation-build/`。它們不在 18 個提交裡。
- Node 20 測試對應程式樹 `15974e0`。文件提交沒有改 lockfile，所以沒有要求立刻重跑；一旦有人再改程式或 lockfile，證據就失效。
- F-BESTEP-01、D1–D11、DG-BESTEP-01–05、L3、Staging、Production 都還沒有。
- 沒有 push，沒有部署，沒有資料庫操作。

下一步：發布負責人決定是否核准 `c811680`。核准前若 `main` 或 Analytics HEAD 變了，要重做祖先檢查，必要時重跑 Node 20。
