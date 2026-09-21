# EEARS 維運腳本（Windows IIS + Node）

本目錄是**正式上線入口**，取代手動在 CMD 逐條輸入 build / 複製 / 重啟。

## 先決條件（伺服器只做一次）

1. 已安裝 Node.js 20+、npm
2. `reservation-backend/.env` 已就緒（見 `.env.example`）
3. 註冊 PM2：

```bat
scripts\ops\setup-pm2.bat
```

或：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops\setup-pm2.ps1
```

開機自啟（建議以系統管理員執行一次）：

```bat
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

4. （建議）安裝 GitHub self-hosted runner，讓 `main` CI 通過後自動部署：見 [SELF_HOSTED_RUNNER.md](./SELF_HOSTED_RUNNER.md)

## GitHub 自動部署

| 項目 | 說明 |
|------|------|
| 觸發 | `.github/workflows/deploy-prod.yml`：`main` 上 **CI** 成功完成後 |
| 行為 | 於 `D:\EEARS`：`git fetch` → `reset --hard origin/main` → `deploy.ps1` |
| Runner | label `eears-prod`（僅這台生產機） |
| 不自動做 | migration、改寫 `.env`、對 PR／fork 部署 |

手機 Cursor：合併 PR 到 `main` → 等 Actions 綠燈即可；無需遠端登入本機。

Runner 離線或失敗時的手動 fallback：

```bat
cd /d D:\EEARS
git fetch origin
git checkout main
git reset --hard origin/main
scripts\ops\deploy.bat
```

## 日常指令

| 情境 | 指令 |
|------|------|
| 完整上線（前端 build → 同步到後端 `build/` → 重啟 → 健康檢查） | `scripts\ops\deploy.bat` |
| 只更新前端 SPA（不重啟 Node） | `powershell -File scripts\ops\deploy.ps1 -FrontendOnly` |
| 桌面捷徑啟動／重啟後端（有 PM2 用 PM2，否則 foreground `node server.js`） | `scripts\ops\start-backend.bat` |
| 只重啟後端 | `scripts\ops\restart-backend.bat` |
| 首次 / 重建 PM2 | `scripts\ops\setup-pm2.bat` |

進階參數（PowerShell）：

```powershell
# 略過 npm ci（依賴未變時較快）
.\scripts\ops\deploy.ps1 -SkipInstall

# 沿用已存在的 frontend/build，只同步 + 重啟
.\scripts\ops\deploy.ps1 -SkipBuild -SkipInstall

# 後端也跑 npm ci --omit=dev
.\scripts\ops\deploy.ps1 -InstallBackendDeps

# 重啟但不跑 post-deploy-check
.\scripts\ops\restart-backend.ps1 -SkipHealthCheck
```

## 架構對應

```
reservation-frontend  npm run build
        │
        ▼ robocopy /MIR
reservation-backend/build/   ← Express 靜態 + SPA fallback
        │
        ▼
PM2: eears-backend (ecosystem.config.cjs)  →  :3000
        │
        ▼
IIS reverse proxy (public/web.config)
```

## 檔案一覽

| 檔案 | 用途 |
|------|------|
| `_common.ps1` | 共用函式（路徑、同步、PM2、就緒檢查） |
| `deploy.ps1` / `deploy.bat` | 正式部署 |
| `restart-backend.ps1` / `.bat` | 只重啟後端 |
| `setup-pm2.ps1` / `.bat` | 一次性程序註冊 |
| `SELF_HOSTED_RUNNER.md` | 生產機 GitHub runner 一次性設定 |
| `../reservation-backend/ecosystem.config.cjs` | PM2 程序定義 |
| `../../.github/workflows/deploy-prod.yml` | CI 成功後自動拉碼部署 |

完整 runbook 見 `reservation-backend/docs/DEPLOYMENT_CHECKLIST.md`。
