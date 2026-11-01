# 主分支整合 Runbook

這份手冊現在不能執行。只有發布負責人以書面或同等明確方式核准，而且核准的 SHA 與當時的 `main` SHA 仍和下面預期一致時，才能做 Step 4。

本次 Phase 5B.1 沒有執行 Step 4 之後的任何寫入。

## Step 1 — Approval

- 狀態：`PENDING_APPROVAL`
- 核准者角色：發布負責人
- 尚未有核准紀錄

## Step 2 — 凍結 SHA

在核准當下重新抄寫，不要沿用過期數字。本次準備時的預期值：

- Expected Main SHA：`1f41dd5202c5672076ab3181e563effb172823fe`
- Approved Candidate SHA：`c811680ad2ac636851cae2f85fd5c24d40479136`

不要把 `15974e0` 當成目標，除非負責人明示只要程式、不要 Phase 5B 文件。

## Step 3 — 再檢查

```text
git rev-parse main
git rev-parse analytics/phase-4b-temporal-context
git merge-base --is-ancestor main analytics/phase-4b-temporal-context
git rev-list --left-right --count main...analytics/phase-4b-temporal-context
git worktree list --porcelain
git status -sb --untracked-files=no
git diff --name-only main...analytics/phase-4b-temporal-context
```

停止條件：

- `main` 不是預期 SHA
- ancestor 檢查不是 exit 0
- behind 不是 0
- 有工作樹正 checkout `main` 且有已追蹤修改
- 範圍裡出現 `.mysql-data`、`.env`、SQL dump、憑證或 `presentation-build`

## Step 4 — 受控快轉

`main` 目前沒有被任何工作樹 checkout。未來若仍是這樣，用比對舊值的更新，避免蓋掉期間新進的 `main`：

```text
git update-ref refs/heads/main c811680ad2ac636851cae2f85fd5c24d40479136 1f41dd5202c5672076ab3181e563effb172823fe
```

舊值不符時命令會失敗，這是預期的安全行為。失敗後停止，不要改用 `--force`，也不要 reset。

這個命令只移動 `main` 指標。它不應該改 `D:/EEARS` 的工作檔，因為那個目錄在 Analytics 分支上。執行前仍要用 Step 3 確認。

## Step 5 — 核對 main

```text
git rev-parse main
```

必須等於核准的 Candidate SHA。然後再看工作樹列表，確認沒有人的未提交修改被換掉。

## Step 6 — Node 20 回歸

在與新 `main` 相同的程式樹上，用 v20.20.2 重跑 `07_NODE20_EVIDENCE_AND_POST_MERGE_TESTS.md` 的命令。不要用系統預設的 Node 24 代替。

## Step 7 — 治理

確認 Shadow 環境變數沒有設成啟用，registry 仍是 32 / 7 / 9，`officialUseAllowed` 與 `causalClaimAllowed` 仍是 false，`passRate` 公式仍是舊的兩行，F-BESTEP-01 仍 pending。L3 與業務政策維持未完成。

## Step 8 — 紀錄與回退

記下最終 `main` SHA、測試摘要、日期與核准紀錄。

若整合後測試失敗：

- 不要自動 reset `main`
- 尚未 push：請發布負責人決定下一步
- 已經 push：用 revert 修復提交，不要 force push

回退目標可指回 `1f41dd5202c5672076ab3181e563effb172823fe`，但只有負責人明確要求且尚未推送時才能移動指標。
