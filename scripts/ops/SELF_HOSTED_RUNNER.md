# GitHub Self-hosted Runner（生產機一次性設定）

這台 Windows 生產機安裝 runner 後，`main` 的 CI 通過會自動在 `D:\EEARS` 拉碼並執行 `deploy.ps1`。  
手機 Cursor 只需合併 PR／查看 Actions，**不必**開公網 RDP／SSH。

Workflow：`.github/workflows/deploy-prod.yml`  
Runner label：`eears-prod`

## 先決條件

1. `D:\EEARS` 已是此 repo 的 git clone，且追蹤 `origin/main`
2. `reservation-backend/.env` 已就緒（**永不**提交版控）
3. PM2 已註冊：`scripts\ops\setup-pm2.bat`，程序名 `eears-backend`
4. 已安裝 Node.js 20+、Git、npm

## 安裝步驟

1. 開啟 GitHub repo → **Settings** → **Actions** → **Runners** → **New self-hosted runner**
2. 選擇 **Windows** / **x64**，依頁面下載並解壓（建議目錄如 `C:\actions\actions-runner`，勿放在 `D:\EEARS` 內）
3. 在該目錄以**與平常執行 PM2 相同的 Windows 使用者**開啟 CMD／PowerShell，執行頁面上的 `config.cmd`：
   - Runner name 建議：`eears-prod-pc`
   - 額外 labels：務必加上 `eears-prod`（workflow 用 `runs-on: [self-hosted, Windows, eears-prod]`）
4. 安裝為服務並啟動（建議，開機自啟、不依賴登入桌面）：

```bat
.\svc.cmd install
.\svc.cmd start
```

若暫時用互動模式：`.\run.cmd`（關閉視窗即離線，不建議生產長期使用）。

5. 回 GitHub Runners 頁確認狀態為 **Idle / Online**，且 labels 含 `self-hosted`、`Windows`、`eears-prod`

## 重要注意

| 項目 | 說明 |
|------|------|
| 同一 Windows 使用者 | Runner 服務帳號必須能執行 `pm2` 並看到 `eears-backend`；換使用者會變成「空的」PM2 |
| 工作目錄 | Deploy job 在 `D:\EEARS` 做 `git reset --hard`，**不用** Actions 預設 `_work` 當正式目錄 |
| `.env` | 已被 `.gitignore`；reset 不會刪本地 ignored 檔，但仍勿把 `.env` 加入版控 |
| 安全 | Deploy **只**在 `main` 的 CI 成功後觸發；**不要**對 `pull_request`／fork 跑 self-hosted |
| Schema | Workflow **不會**自動跑 migration；有 migration 仍依 checklist 人工執行 |

## 驗證

1. 合併一筆無害變更到 `main`（或手動 re-run CI）
2. Actions：`CI` 綠燈後出現 `Deploy production (self-hosted)`
3. Job 成功後：`pm2 status` 顯示 `eears-backend` online；必要時跑 `npm run post-deploy-check`

## 手動 fallback

Runner 離線或自動部署失敗時，在本機：

```bat
cd /d D:\EEARS
git fetch origin
git checkout main
git reset --hard origin/main
scripts\ops\deploy.bat
```

只重啟後端（不拉碼）：

```bat
scripts\ops\restart-backend.bat
```

## 移除 Runner

```bat
cd C:\actions\actions-runner
.\svc.cmd stop
.\svc.cmd uninstall
.\config.cmd remove
```

並在 GitHub Runners 頁移除該 runner。
