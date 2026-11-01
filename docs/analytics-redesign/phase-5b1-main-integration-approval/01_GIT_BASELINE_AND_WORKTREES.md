# Git 基準與工作樹

檢查命令包含 `git worktree list --porcelain`、`git branch -vv`、`git rev-parse` 與各工作樹的 `git status -sb --untracked-files=no`。

| Path | Branch | HEAD | 已追蹤修改 | 暫存 | 未追蹤 | 敏感檔 | 可否當整合來源 |
|---|---|---|---|---|---|---|---|
| `D:/EEARS` | `analytics/phase-4b-temporal-context` | `c811680`（提交 Phase 5B 文件之後） | 無 | 無 | 有：`.mysql-data/`、`eears_2026-09-18_18-29.sql.gz`、`presentation-build/`，以及本階段新增的 5B.1 文件 | 有，未進提交 | 是。這是最新整合 SHA 的所在分支 |
| `D:/EEARS-phase5b` | `integration/analytics-phase5b-candidate` | `15974e0` | 無 | 無 | 依賴與 build 在 gitignore 內，已追蹤狀態乾淨 | 無進提交 | 工作樹安全，但 SHA 比 Analytics 舊一個文件提交 |
| `D:/EEARS-phase15` | detached | `33eb21b` | 無 | 無 | 本次未逐檔展開；已追蹤狀態乾淨 | 未見進入分支 | 否。不要拿它做整合 |
| `D:/EEARS-phase2a` | `consolidation/phase-2a-ux-fixes` | `a0b45e1` | 無 | 無 | 已追蹤狀態乾淨 | 未見 | 否。已是 main 祖先 |
| `D:/EEARS-phase2b` | `consolidation/phase-2b-empty-state` | `3d9f205` | 無 | 無 | 已追蹤狀態乾淨 | 未見 | 否。已是 main 祖先 |
| `D:/EEARS-phase2c` | `consolidation/phase-2c-empty-state-adoption` | `e2ab111` | 無 | 無 | 已追蹤狀態乾淨 | 未見 | 否。已是 main 祖先 |

沒有工作樹正在 checkout `main`。`main` 只是指向 `1f41dd5` 的分支。因此目前沒有一份 main 工作目錄會被快轉覆寫；未來執行前仍要再確認這件事。

沒有執行 clean、reset、stash、worktree remove 或刪分支。
