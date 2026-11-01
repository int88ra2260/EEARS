# Git 與 Release Candidate

現場結果：

- 分支 `analytics/phase-4b-temporal-context`
- HEAD `174beebb84ced6d99ebd183a826c10b3ad30a512`
- `main` `1f41dd5202c5672076ab3181e563effb172823fe`
- `git merge-base --is-ancestor` exit 0
- ahead 19、behind 0
- 已追蹤工作樹在檢查時是乾淨的。敏感未追蹤檔仍在 `D:/EEARS`，沒有進提交
- 沒有工作樹 checkout `main`

`main..HEAD` 的 19 個提交從 `b65e1df` 到 `174beeb`。清單見 `git log --oneline main..HEAD`。

Release Candidate：

| 項目 | 值 |
|---|---|
| 分支 | `release/analytics-engineering-rc` |
| SHA | `174beebb84ced6d99ebd183a826c10b3ad30a512` |
| Node | v20.20.2（使用者目錄的官方 zip，不是系統 Node 24） |
| npm | 10.8.2 |
| Lockfile | 與 `15974e0` 相同；其後只有文件 |
| 變更 | 活動分析文案、BESTEP 出席與總分 0、契約與三個預設關閉的 Shadow、文件與測試 |
| 部署 | 前端仍是 Vite build 後由既有後端／IIS 提供。沒有新 port、新權限、新資料表 |
| 回退 | 尚未快轉。若之後核准，合併前 SHA 是 `1f41dd5`。未推送時才可指回該點；已推送則 revert |

舊候選 `integration/analytics-phase5b-candidate` 保持 `15974e0`。
