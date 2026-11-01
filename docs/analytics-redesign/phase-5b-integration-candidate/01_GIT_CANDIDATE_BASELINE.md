# Git 候選基準

檢查發生在 Phase 5A 提交之後。

## 提交

Phase 5A 只加入 `docs/analytics-redesign/phase-5a-consolidation-review/` 的 11 個檔案。暫存檢查是 11 個 `A`，`git diff --cached --check` 沒有空白錯誤。提交：

`15974e04a6c02bcb145048c626dd2aa137a1a513`

訊息：`docs(analytics): audit consolidation and release readiness`

提交前 HEAD 是 `1a005991685d0e05c4d119092064d97cdac77b52`。`main` 當時與現在都是 `1f41dd5202c5672076ab3181e563effb172823fe`。

## 候選工作樹

建立前：分支 `integration/analytics-phase5b-candidate` 不存在（`git show-ref` exit 1），`D:/EEARS-phase5b` 不存在。

```text
git worktree add -b integration/analytics-phase5b-candidate D:/EEARS-phase5b HEAD
```

結果：候選 HEAD 與分支名正確，`main` 的 SHA 沒有變。沒有覆寫 `D:/EEARS`、`D:/EEARS-phase15`、`D:/EEARS-phase2a`、`D:/EEARS-phase2b`、`D:/EEARS-phase2c`。

`git rev-list --count main..HEAD` = 17。`HEAD..main` = 0。`main` 是候選的祖先。Analytics 分支與候選分支目前指向同一個提交。沒有 upstream，沒有 tag，沒有 push。

## 其他工作樹

以 `--untracked-files=no` 檢查，phase15、phase2a、phase2b、phase2c 都沒有已追蹤檔的未提交修改。phase2a 尖端仍是 `a0b45e1`，phase2c 仍是 `e2ab111`。

敏感未追蹤路徑（`.mysql-data/`、SQL dump、`presentation-build/`）留在 `D:/EEARS`，沒有進 Phase 5A 提交，也沒有複製進候選的 Git 物件。
