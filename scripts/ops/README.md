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

## 日常指令

| 情境 | 指令 |
|------|------|
| 完整上線（前端 build → 同步到後端 `build/` → 重啟 → 健康檢查） | `scripts\ops\deploy.bat` |
| 只更新前端 SPA（不重啟 Node） | `powershell -File scripts\ops\deploy.ps1 -FrontendOnly` |
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
| `../reservation-backend/ecosystem.config.cjs` | PM2 程序定義 |

完整 runbook 見 `reservation-backend/docs/DEPLOYMENT_CHECKLIST.md`。
