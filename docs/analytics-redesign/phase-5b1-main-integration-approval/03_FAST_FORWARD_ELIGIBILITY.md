# Fast-forward 資格

檢查時間：Phase 5B 文件提交之後。

```text
git merge-base main analytics/phase-4b-temporal-context
= 1f41dd5202c5672076ab3181e563effb172823fe

git merge-base --is-ancestor main HEAD
exit 0

git rev-list --left-right --count main...HEAD
0	18
```

Exit 0 只表示當下 `main` 是 Analytics HEAD 的祖先。Ahead 18、behind 0。`main` 沒有新提交。

舊的候選分支 `integration/analytics-phase5b-candidate` 在提交前是 ahead 17。它沒有跟著前進，所以相對 `main` 仍是 ahead 17。整合目標改看 Analytics HEAD 的 18。

## Commit range

Base：`1f41dd5202c5672076ab3181e563effb172823fe`

Head：`c811680ad2ac636851cae2f85fd5c24d40479136`

1. `b65e1df` 研究基線
2. `6a4215a` 契約
3. `640b2e0` 活動語意試點
4. `ae76742` 活動 Shadow
5. `c1129f7` 活動 UX 藍圖
6. `087168e` 活動 UX
7. `b44692e` UX 測試
8. `da4d26e` 活動瀏覽器
9. `27c8d5b` BESTEP 盤點
10. `ccbd12c` 檔案品質契約
11. `0949ec7` 匯入 Shadow
12. `6e72f1e` Shadow 硬化
13. `499be06` 班級契約
14. `b9cee83` 班級 Shadow
15. `ab7a9f5` 出席語意與通過率決策包
16. `1a00599` 出席瀏覽器
17. `15974e0` Phase 5A 稽核
18. `c811680` Phase 5B Node 20 驗收文件

`main...15974e0` 的程式 diff 是 284 files，+22905 / −170。其後 `c811680` 只加 11 個 Markdown。範圍裡沒有 `.mysql-data`、`.env`、SQL dump、`presentation-build` 或 `test-results`。

依賴差異仍是前端 devDependency：`@playwright/test` 1.64.1 與 `@testing-library/user-event`。lockfile 在 `c811680` 沒有再變。

預期影響：活動分析頁文案、班級出席「未確認」與總分 0 會進入 `main` 的程式。三個 Shadow 仍預設關閉。通過率公式不變。這不是部署。
