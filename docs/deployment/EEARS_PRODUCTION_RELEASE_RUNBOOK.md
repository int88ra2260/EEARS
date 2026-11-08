# EEARS 正式發版 Runbook

日期：2026-11-04。這份文件只描述既有部署方式與發版前停止條件。本輪沒有執行部署、沒有登入正式主機、沒有還原備份。

候選版本：

- Commit：`2d9d40e7da4a809757e0ee47d534b536e698f77b`
- 分支：`integration/analytics-final-acceptance`
- main：`404dac6993fb17e7a96608c330c593e25c35a502`
- 差異說明：`docs/deployment/EEARS_DEPLOYMENT_READINESS_ASSESSMENT.md`

唯讀檢查腳本：`scripts/ops/production-preflight-readonly.ps1`。寫好腳本不等於正式主機已經檢查通過。狀態只能是 `PREFLIGHT_SCRIPT_PREPARED`，不能寫成 `SERVER_PREFLIGHT_PASSED`。

## D1. 發版前條件

全部成立才進入維護窗口。缺一項就停。

| 條件 | 依據 | 本輪狀態 |
|---|---|---|
| 候選 commit 固定為 `2d9d40e` | Git | 已固定 |
| `404dac6...2d9d40e` 沒有 migration、model、新依賴、權限鍵或排程變更 | 前次 diff | 已核對 |
| BESTEP analytics 多三個欄位，路徑不變 | `englishTestRegistrationRouter.js` | 前後端要一起上 |
| CI 在合併進 main 之前已通過 | `.github/workflows/ci.yml` | 先前工程驗收已記錄；合併本身會再跑 CI |
| `.env` 的 `DB_*` 為有值，且不印出內容 | preflight 的 `ENV-*` | 尚未在正式主機執行 |
| `ENABLE_DB_SYNC` 不是正好 `true` | `server.js` 只在 `=== 'true'` 時 `sequelize.sync` | 尚未在正式主機執行 |
| IIS 實體路徑是 `D:\EEARS\reservation-backend\build`，`web.config` 與 `reservation-frontend/public/web.config` 一致 | preflight 的 `IIS-*` | 尚未在正式主機執行 |
| 只有一個 `reservation-backend\server.js` 的 Node 程序 | preflight 的 `NODE-BACKEND-COUNT` | 尚未在正式主機執行 |
| 備份檔存在且時間可接受 | preflight 的 `BACKUP_FILE_PRESENT`、`BACKUP_RECENT` | 尚未在正式主機執行 |
| 還原演練 | 腳本故意不做還原 | `RESTORE_VERIFIED=UNKNOWN` |
| 維護窗口與正式部署授權 | 人工 | 尚未授權 |

`post-deploy-check` 只打 `/api/events`、黑名單、問卷列表與預約。它不能代替上表。

## D2. 自動部署風險

`.github/workflows/deploy-prod.yml` 的觸發是：名為 `CI` 的 workflow 在 **main** 完成，而且結論是 success。Runner 是 `self-hosted`、`Windows`、`eears-prod`。

因此，把整合分支合併或推上 main，不是普通的程式整理。CI 一綠，在線的 runner 就會在 `D:\EEARS` 執行 `git reset --hard origin/main`，然後跑 `scripts/ops/deploy.ps1`。失敗時只印 PM2 日誌，不會自動退回上一版，也不會跑 migration。

PR 不會觸發這支 deploy。追蹤 `origin/main` 本身也不會部署。

停止新的 push，不會取消已經在排隊或正在執行的 Deploy job，也不會取消別人對舊 run 按下的 Re-run。發版協調者要在 GitHub Actions 看 `CI` 與 `Deploy production (self-hosted)` 的 queued 與 in-progress，確認沒有會改 `D:\EEARS` 的 job。未授權時不要合併 main，也不要手動重跑 Deploy workflow。

發版前要再看 GitHub 上的 workflow 檔是否仍是這份。

## D3. 發版方式

使用既有完整流程，不要用 `-FrontendOnly`。`-FrontendOnly` 不重啟 Node，BESTEP 的 `registrationSummary`、`attendance`、`scores` 不會出現。

這次不需要新的 migration。Node 重啟會有短暫停機。學習有伴過期檢查、活動結束檢查、寫作工坊同步與每日備份會隨 `server.js` 重新載入。不要另外再啟動第二份 backend。

授權後的順序：

1. 指定一位部署協調者。協調者先記下上一個穩定 commit，並確認 Actions 沒有 queued 或 in-progress 的 CI／Deploy，也沒有待重跑的舊 workflow。不要在未授權下改 workflow。
2. 管理員審過 `production-preflight-readonly.ps1` 後，在允許的時段執行。腳本只印主控台摘要，不會寫報告檔。Exit 0 只代表這次沒有 FAIL、WARN、UNKNOWN 或 NOT_AVAILABLE，不是正式發布許可。
3. 對照第 D4 節。任一停止條件成立就不要合併。
4. 把 `2d9d40e` 經由已審查的 PR 合併進 main。這一步會啟動 CI，CI 成功就會部署。合併本身就是發布動作。
5. 既有 deploy 會做：前端 `npm ci`、`npm run build`、`robocopy /MIR` 到 `reservation-backend/build`、`pm2 restart eears-backend --update-env`、探測 `http://127.0.0.1:3000/api/events`、`npm run post-deploy-check`。見 `scripts/ops/deploy.ps1` 與 `deploy.bat`。
6. 若 deploy 失敗、健康檢查失敗，或 D5 出現阻擋問題，就停止後續變更，不要再推 main，並改走 D6。視窗期間持續看 Deploy job 是否又被排入。

手動 fallback 只在 runner 離線且已另外授權時使用，順序仍是 `scripts/ops/README.md` 記載的：備份 `siteStats.json`、對齊已授權的 commit、再跑 `deploy.bat`。本輪不執行。

## D4. 發版前停止條件

下列任一項成立，就不發版：

- `ENABLE_DB_SYNC` 是 `true`，或 preflight 無法判斷。
- `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD` 為 `MISSING` 或 `EMPTY`。`NOT_LOOPBACK` 也先停，除非人工已確認那就是這台主機上的正式實例，而且報告沒有印出實際字串。
- `BACKUP_FILE_PRESENT` 不是 PASS，或 `BACKUP_RECENT` 不被維護負責人接受。`RESTORE_VERIFIED` 仍是 `UNKNOWN` 時，至少要有書面接受「這次沒有 schema 變更，但資料庫還原未經演練」。沒有這句接受，就停。
- 沒有可執行的程式回復約定，或上一個穩定 commit 沒有記下來。
- Runner 狀態不明，或已經有 process 的命令列指向 `deploy.ps1`。
- IIS 實體路徑不是 `reservation-backend\build`，或 live `web.config` 與 repository 不一致。
- `NODE-BACKEND-COUNT` 大於 1。
- TCP 3000 聽在 `0.0.0.0` 或 `::`。防火牆查不到指定埠的 Allow，也不能當成已經關閉；那種結果是 `UNKNOWN`，不是通過。
- preflight 結束代碼是 2，或有 `WARN`／`UNKNOWN`／`NOT_AVAILABLE` 尚未由協調者接受。Exit 0 也仍然不是 Production Approved。
- 正式 schema 與 main 是否一致仍是 `UNKNOWN`，而且負責人沒有另行確認既有 migration 已經跟上 main。這次 diff 本身沒有新 migration。
- 候選 commit 不再是 `2d9d40e`，或又出現未審查的 API 變更。
- 沒有維護窗口，或沒有正式部署授權。

`UNKNOWN` 不是通過。

## D5. 部署後驗收

使用已授權的最小測試帳號。不要把真實學號、姓名、Email 或成績寫進報告。只記頁面是否開啟、是否出現錯誤，以及 BESTEP 新區塊是否有資料形狀而不是空值。

| 項目 | 看什麼 |
|---|---|
| 首頁 | 活動列表開得起來 |
| 管理員登入 | 能進後台 |
| 活動預約 | 既有預約流程沒有 5xx |
| 學期選擇 | 學期控制仍可用 |
| BESTEP 數據分析 | `/admin/english-test?tab=analytics` 有報名、出席、分數區塊 |
| 學習成效概況 | 導覽名稱與頁面一致 |
| 學期 B2 KPI | 頁面可開。政策仍未核定，不把數字當成正式達標 |
| 找學生 | 查詢頁可開 |
| 資源與開課 | 頁面可開 |
| 群體與技能比較 | 頁面可開 |
| 活動營運總覽 | 名額與預約列仍分開顯示 |
| 高關注名單 | 頁面可開，且不是全中心以外的角色也能看到不該看的範圍 |
| Excel 報表 | 有匯出權限的帳號能下載；無權限帳號被拒絕 |
| 權限不足 | 無權限帳號得到拒絕，而不是另一個人的資料 |
| Node／IIS log | 重啟後沒有連續 5xx 或資料庫連線失敗 |
| 定時排程 | PM2 仍只有一個 `eears-backend`。log 出現既有排程載入訊息，而不是兩份 |

`npm run post-deploy-check` 可以當技術探測，不能取代上表。

## D6. Rollback

現況是 `ROLLBACK_NOT_VERIFIED`。Git 可以指回舊 commit，不代表這件事在正式機上演練過，也不代表資料庫可以回復。這次沒有 migration，所以程式退回不需要 `migration down`。資料庫若在窗口內被日常排程改過，Git 不會把那些列還原。

尚未演練的應用程式回復順序，僅供已授權的失敗窗口使用：

1. 協調者先確認沒有 queued、in-progress 或即將 Re-run 的 Deploy job。只禁止新的 push 不夠，已經在跑的 job 仍會 `reset --hard origin/main` 並覆蓋 `D:\EEARS`。
2. 使用發版前寫下的上一個穩定 commit，不要等失敗才臨時找。失敗當下的 commit 也要記下。
3. 在手動改 `D:\EEARS` 之前，再確認沒有 process 正在跑 `deploy.ps1`。若還有，先等它結束或由協調者決定中止那個 job，不要兩個程序同時改同一個目錄。
4. 依 `scripts/ops/README.md` 先複製 `reservation-backend\data\siteStats.json`。自動部署會保留它；手動退回也要保留。
5. 把程式對齊穩定 commit 後，再跑完整 `scripts\ops\deploy.bat`。`robocopy /MIR` 會刪掉新 build 裡多出來的檔，不能只換幾個 js 檔。這一步本身也會重啟 Node。
6. 回復完成後，main 若仍指著失敗的新 commit，下一次 CI 成功或 Re-run 會再次覆蓋舊版。協調者必須維持「main 不再前進，而且沒有殘留 Deploy」直到另一次授權。不要靠改 workflow 來做這件事，除非另有變更授權。
7. `git rev-parse HEAD` 應是穩定 commit。PM2 程序仍應只有一份，cwd 在 `D:\EEARS\reservation-backend`。再做 D5 的縮小版：首頁、管理員登入、活動列表，以及 BESTEP 是否回到舊行為。

沒有版本化的舊 build 目錄。上一版靜態檔要靠舊 commit 重新 build。Workflow 不會自動做以上步驟。這些步驟還沒有在正式機上演練，所以狀態維持 `ROLLBACK_NOT_VERIFIED`。Git revert 不是已驗證的回復程序。

## 發版閘門

| Gate | 狀態 |
|---|---|
| Source Ready | PASS。候選是 `2d9d40e`。 |
| Build Ready | PASS。沿用先前 Mock 工程驗收，本輪沒有重跑。 |
| Environment Preflight | NOT_STARTED。腳本已備妥，正式主機尚未執行。 |
| Database Validation | PENDING。沒有 DB-backed SQL 證據。 |
| Backup Verified | NOT_STARTED。連檔案是否存在都還沒在正式主機看過。還原是 UNKNOWN。 |
| Rollback Verified | BLOCKED。`ROLLBACK_NOT_VERIFIED`。 |
| Deployment Authorized | NOT_STARTED。 |
| Production Approved | NOT_STARTED。 |

通過本文件的審查，仍然不是上線許可。

## Production Preflight Administrator Handoff

這一段只說明移交方式。本輪沒有把腳本拷到正式機，也沒有執行。

### F1. 移交前

- 腳本是整合工作樹裡的 `scripts/ops/production-preflight-readonly.ps1`，不是 main 上的檔案。
- 靜態審查已確認它不呼叫 SQL、部署、服務重啟或 `server.js`。
- 合成測試只載入判斷函式，不跑正式主機檢查。
- 審查用複本的 SHA-256 是 `274FA46690CAB31621A486AACFA94F83AD707F68B54E1F31B70F2A3A1FC2AD51`。雜湊對的是 `production-preflight-readonly.ps1` 的檔案位元組，不是分支名稱。正式機收到的檔案必須與這個值一致。
- 不要把腳本合併進 main 來送到正式機。那樣會在 CI 成功後觸發部署。
- 不要為了傳送腳本去重跑 GitHub Actions。

### F2. 傳輸

用管理員已經核准的檔案傳輸，只送這一個 `.ps1`。測試檔不必送到正式機。腳本不依賴自己放在 `scripts/ops/`，也不使用 `$PSScriptRoot` 尋找專案。

在正式機的獨立管理目錄執行時，必須明示專案路徑：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\AdminTools\production-preflight-readonly.ps1 -RepoRoot D:\EEARS
```

`-RepoRoot` 不存在，或裡面沒有 `reservation-backend\server.js`，相關檢查是 `UNKNOWN`，不會改去搜尋磁碟。路徑存在也不代表 IIS 或 PM2 正在使用那一份程式。不要把正式 `.env` 或密碼拷回開發電腦。

### F3. 執行前

管理員要先讀過腳本，核對 SHA-256 與核准複本一致，並確認當下沒有 Deploy job 或 `deploy.ps1` 在跑。執行身分只需能讀取要查的項目；腳本不會因為權限不足就自行提升或安裝工具。畫面上的摘要可以轉交，完整 `.env`、PM2 dump 與備份內容不行。

### F4. 執行後

回報腳本雜湊、執行時間、Exit Code，以及每個檢查 ID 的狀態。特別標出 `UNKNOWN`、`WARN`、`FAIL`。不要回傳 `.env`、資料庫密碼、Runner token、PM2 dump、備份內容或學生資料。

### F5. 如何解讀

`PREFLIGHT_SCRIPT_PREPARED` 只表示腳本已寫好。管理員跑完腳本也不等於 `SERVER_PREFLIGHT_PASSED`，更不是部署核准。Exit 0 只表示這次沒有 FAIL、WARN、UNKNOWN 或 NOT_AVAILABLE。只要還有 UNKNOWN，就要由有權限的人補證據。`BACKUP_SCHEDULED_*` 與 `BACKUP_LEGACY_*` 不能併成一句「備份正常」。`RESTORE_VERIFIED` 在沒有還原演練前記錄前維持 `UNKNOWN`。

## 校外手動執行唯讀 Preflight

Workflow 草案在整合工作樹：

`.github/workflows/production-preflight-readonly.yml`

它只接受 `workflow_dispatch`。checkout 發生在 Runner 自己的工作目錄，並以 `-RepoRoot D:\EEARS` 讀取正式目錄。它不呼叫 `deploy.ps1`，也不在 `D:\EEARS` 執行 `git reset`。

GitHub 只有在這個 workflow 檔位於預設分支 `main` 時，才會顯示手動執行。把整個 `integration/analytics-final-acceptance` 合併進 `main` 會一併發布 Analytics，CI 成功後現有 `deploy-prod.yml` 會部署正式站。啟用方式是另做一個只含這個 yaml 的 commit，父 commit 必須是當時的 `main`。

推送任何 commit 到 `main` 都會啟動 `ci.yml`。CI 成功會啟動 `Deploy production (self-hosted)`，並在正式機執行 `deploy.ps1`。推送這個 workflow 之前，先在 GitHub 網頁停用該 Deploy workflow。不要改 `deploy-prod.yml` 的內容來達到停用。只把 Runner 下線不夠，已經排隊的 Deploy 會在 Runner 恢復後繼續跑。

腳本目前還沒有 commit。校外執行前還要：

1. 在 `integration/analytics-final-acceptance` commit 並推送 Preflight 腳本與測試。不要開向 `main` 的 pull request。
2. 在 GitHub 建立 environment `production-preflight-readonly`，要求審核者，且不要放入資料庫密碼或 Runner token。
3. 停用 Deploy workflow，確認沒有 queued 或 in progress 的 Deploy。
4. 把 workflow 檔單獨推上 `main`。
5. 從 Actions 手動執行 `Production preflight readonly`。預設 ref 是 `integration/analytics-final-acceptance`，目錄是 `D:\EEARS`，SHA-256 是 `274FA46690CAB31621A486AACFA94F83AD707F68B54E1F31B70F2A3A1FC2AD51`。

日誌裡看 `SCRIPT_SHA256`、`PREFLIGHT_EXIT` 與每個檢查狀態。Exit 2 使這次 Actions job 顯示失敗，代表仍有 WARN、UNKNOWN 或 NOT_AVAILABLE，或當時有 Deploy 在跑。這不是部署失敗，也不是上線核准。不要從日誌索取 `.env`、密碼、PM2 dump、備份內容或學生資料。
