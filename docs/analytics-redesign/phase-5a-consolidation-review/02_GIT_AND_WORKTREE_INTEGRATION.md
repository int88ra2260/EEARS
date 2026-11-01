# Git 與工作樹

檢查時間：Phase 4N.1 提交之後。只讀，沒有 merge、rebase、cherry-pick、刪分支或 push。

## 現況

- 分支：`analytics/phase-4b-temporal-context`
- HEAD：`1a005991685d0e05c4d119092064d97cdac77b52`
- `main`：`1f41dd5202c5672076ab3181e563effb172823fe`
- `git rev-list --count main..HEAD` = 16
- `git rev-list --count HEAD..main` = 0
- `main` 是 HEAD 的祖先
- 這條分支在 `git branch -vv` 沒有上游

16 個提交從 `b65e1df` 到 `1a00599`，訊息依序是研究基線、契約、活動試點、活動 Shadow、UX 藍圖、UX、UX 測試、瀏覽器驗收、BESTEP 盤點、檔案品質、匯入 Shadow、Shadow 硬化、班級契約、班級 Shadow、出席語意、出席瀏覽器。

## 工作樹

| 路徑 | HEAD | 分支 | 與本線的關係 |
|---|---|---|---|
| `D:/EEARS` | `1a00599` | analytics 分支 | 本稽核工作樹 |
| `D:/EEARS-phase15` | `33eb21b` | detached | `git merge-base --is-ancestor` 為真，是本歷史上的舊提交，不是未合併的分析工作 |
| `D:/EEARS-phase2a` | `a0b45e1` | `consolidation/phase-2a-ux-fixes` | 另一條 UX 工作，未納入本盤點的實作 |
| `D:/EEARS-phase2b` | `3d9f205` | `consolidation/phase-2b-empty-state` | 同上 |
| `D:/EEARS-phase2c` | `e2ab111` | `consolidation/phase-2c-empty-state-adoption` | `git diff --name-only main...該分支` 沒有 analytics、bestep、AdminAnalytics、ClassBestep 路徑 |

`codex/speaking-diagnostic-20261001` 追蹤 origin，與本分析線無關。本階段沒有清理這些工作樹。

## 建議整合方式（未執行）

1. 策略：整條快轉 `main..analytics/phase-4b-temporal-context`。不要只挑 4N.1，否則出席修正會脫離它依賴的 4N 顯示函式。
2. 範圍：上述 16 個提交。
3. 順序：已是線性歷史，不需重排。
4. 衝突：以目前 `main` 為準，沒有反向提交，快轉不會產生衝突。若 `main` 先收到別的提交，重疊熱點是 `AdminAnalyticsPage`、班級 BESTEP 表格、`bestepImportService.js`、`analyticsController.js`、`bestepClassController.js`。目前的 consolidation 2c 沒有這些路徑。
5. 測試門檻：本文件 `06_CROSS_MODULE_TEST_MATRIX.md` 的命令再跑一次，並在目標環境用 Node 20。
6. 回退：合併後以 revert 該合併提交回復，不使用 hard reset。Shadow 旗標維持未設定即可停用診斷。
7. 核准：需要負責人同意使用者可見的文案與出席顯示進入整合分支。通過率公式沒有變，這次合併不是 KPI 政策核准。

未提交變更只應是本 Phase 5A 文件。敏感未追蹤路徑維持不加入。
