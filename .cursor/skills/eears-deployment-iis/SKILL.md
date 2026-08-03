---
name: eears-deployment-iis
description: EEARS Windows IIS + Node 部署與回滾護欄（避免 script 斷裂/錯誤 env）
license: MIT
---

# eears-deployment-iis（IIS 部署）

## When to Use This Skill

- 你要做上線前檢查、部署步驟、回滾 runbook
- 你要修 CI/CD 或調整部署相關腳本
- 你需要確保 SPA fallback、build 目錄、TZ 與 envValidation 正確

## Background You Need（這個 repo 的部署方式）

- 後端 `reservation-backend/server.js` 同時提供：
  - API（`/api/...`）
  - SPA 靜態檔（`reservation-backend/build`）
  - fallback（未匹配 API 時回 `build/index.html`）
- IIS 將流量 reverse proxy 到 Node：
  - `public/web.config`
  - `reservation-frontend/public/web.config`
- **正式維運入口（Windows）**：`scripts/ops/`
  - 首次：`setup-pm2.bat`（`reservation-backend/ecosystem.config.cjs`）
  - 上線：`deploy.bat`
  - 重啟：`restart-backend.bat`
  - Runbook：`reservation-backend/docs/DEPLOYMENT_CHECKLIST.md`

## Hard Constraints（重要）

1. 不要建議執行「不存在」的 npm scripts

- 你可以在「分析」階段比對 `reservation-backend/package.json` scripts 與 `reservation-backend/scripts/` 實際檔案。
- 若發現 package.json 指向缺失檔案（維運腳本斷裂），你的輸出必須改成：
  - 「需補齊該檔案或調整 package.json」，而不是要求立即跑。

2. 不要在生產做 `sequelize.sync()`

- migration 走 `reservation-backend/migrations/`
- rollback 需依既有 migration `down` 與必要備份/恢復策略

3. TZ 與 envValidation

- `server.js` 會強制 `TZ=Asia/Taipei`（若環境未設）
- 必須通過 `reservation-backend/config/envValidation.js`（JWT/CORS 等）

## Suggested Checklist（上線前）

- 檢查：
  - 後端：`npm run lint`、`npm test -- --runInBand`
  - 前端：`npm run lint`、`npm test -- --watchAll=false`、`npm run build`
- 準備：
  - 確保 `.env` 以 `.env.example` 為依據
- 部署：
  - **優先**使用 `scripts/ops/deploy.ps1`（或 `deploy.bat`）：build → 同步到後端 `build/` → PM2 restart → post-deploy-check
  - 不要建議手動逐條 CMD 複製路徑，除非腳本不存在或環境例外
  - 確認 IIS web.config 指向正確 upstream

## Suggested Workflow Prompt

> 請先列出「這次變更」預計影響哪些部署步驟（IIS、SPA fallback、env、migration、post-deploy 腳本），並先比對 `package.json` scripts 是否存在對應 `scripts/` 檔案。確認腳本完整後，才提出最小上線步驟與 rollback 計畫。

