# EEARS 部署 Runbook（Windows IIS + Node）

正式維運入口：`scripts/ops/`（一鍵部署 / 重啟 / PM2 註冊）。  
**請勿再靠手動在 CMD 逐條輸入 build、複製、重啟。**

## 架構

- Node（PM2：`eears-backend`）監聽 `127.0.0.1:3000`
- 後端同時提供 API 與 SPA：`reservation-backend/build/`
- IIS reverse proxy：`public/web.config` → `http://127.0.0.1:3000/{R:0}`
- 時區：`Asia/Taipei`（`server.js` / PM2 `ecosystem.config.cjs`）

## 一次性設定（伺服器）

```bat
cd /d D:\EEARS
scripts\ops\setup-pm2.bat
```

確認：

```bat
pm2 status
pm2 logs eears-backend --lines 50
```

開機自啟（系統管理員，執行一次）：

```bat
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

### GitHub self-hosted runner（建議，自動部署）

見 [`scripts/ops/SELF_HOSTED_RUNNER.md`](../../scripts/ops/SELF_HOSTED_RUNNER.md)。

- Workflow：`.github/workflows/deploy-prod.yml`
- 條件：`main` 上 **CI** 成功 → 於 `D:\EEARS` 拉碼 → `scripts/ops/deploy.ps1`
- **不會**自動跑 migration；schema 變更仍須本節下方人工 migrate
- Runner 須與 PM2 使用**同一 Windows 使用者**，並帶 label `eears-prod`

## 日常上線

### A0. 自動部署（已裝 runner）

1. 開發機開 PR → CI 綠燈 → 合併到 `main`
2. GitHub Actions：`CI` 成功後觸發 `Deploy production (self-hosted)`
3. 手機／本機只需在 Actions 確認 deploy 成功

失敗或 runner 離線 → 改用下方 **A** 手動部署。

### A. 完整部署（程式碼已更新到本機目錄後）

```bat
cd /d D:\EEARS
scripts\ops\deploy.bat
```

流程：`frontend npm ci` → `npm run build` → `robocopy` 同步到 `reservation-backend/build` → `pm2 restart` → 就緒探測 → `npm run post-deploy-check`。

若需先對齊遠端 `main`：

```bat
cd /d D:\EEARS
git fetch origin
git checkout main
git reset --hard origin/main
scripts\ops\deploy.bat
```

### B. 只更新前端

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops\deploy.ps1 -FrontendOnly
```

### C. 只重啟後端（例如改了 `.env`）

```bat
scripts\ops\restart-backend.bat
```

### D. 後端依賴也要重裝

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ops\deploy.ps1 -InstallBackendDeps
```

## 部署前檢查（建議在開發機 / CI 先過）

```bash
cd reservation-backend && npm test -- --runInBand && npm run lint
cd reservation-frontend && npm test && npm run lint && npm run build
```

若有 schema 變更：

```bash
cd reservation-backend
npx sequelize-cli db:migrate
```

**生產環境禁止 `sequelize.sync()`。**

## 環境變數

- 以 `reservation-backend/.env.example` 為準
- 生產必填：`JWT_SECRET`（≥32）、`CORS_ORIGINS`、`DB_*`
- 部署腳本**不會**改寫 `.env`
- `reservation-backend/data/siteStats.json`（Footer 瀏覽人次）**不進版控**；自動部署會在 `git reset --hard` 前後備份／還原。手動拉碼請先備份該檔（見 `scripts/ops/README.md`）

## 部署後驗證

腳本已含 `post-deploy-check`。也可手動：

```bash
cd reservation-backend
npm run post-deploy-check
```

人工抽樣：

- [ ] 首頁 / 活動列表
- [ ] 學生預約（問卷 Gate / 黑名單若適用）
- [ ] Admin 登入

## 回滾

1. **功能開關**：優先用 Feature Flags 關閉問題功能（見 `FEATURE_FLAGS.md`）
2. **程式**：還原上一版碼後再跑 `scripts\ops\deploy.bat`
3. **程序**：`pm2 restart eears-backend`
4. **資料庫**：還原備份（見 `scripts/backup-db.bat`）；migration `down` 需確認可逆

## 故障排除

| 現象 | 檢查 |
|------|------|
| `PM2 is not installed` | 跑 `scripts\ops\setup-pm2.bat` |
| API 就緒逾時 | `pm2 logs eears-backend`；確認 `.env`、DB、port 3000 |
| 前端空白 | 確認 `reservation-backend/build/index.html` 存在；IIS proxy |
| `npm ci` 失敗 | 確認 `package-lock.json` 與 Node 20 |
| Deploy job 一直 Queued | Runner Offline；或缺少 label `eears-prod`（見 `SELF_HOSTED_RUNNER.md`） |
| Deploy 找不到 `eears-backend` | Runner 服務帳號與 PM2 使用者不一致 |

## 相關檔案

| 路徑 | 說明 |
|------|------|
| `scripts/ops/README.md` | 指令速查 |
| `scripts/ops/SELF_HOSTED_RUNNER.md` | Self-hosted runner 設定 |
| `scripts/ops/deploy.ps1` | 正式部署 |
| `scripts/ops/restart-backend.ps1` | 重啟 |
| `scripts/ops/setup-pm2.ps1` | PM2 註冊 |
| `.github/workflows/deploy-prod.yml` | CI 後自動部署 |
| `reservation-backend/ecosystem.config.cjs` | PM2 定義 |
| `reservation-backend/scripts/post_deploy_check.mjs` | 部署後檢查 |
