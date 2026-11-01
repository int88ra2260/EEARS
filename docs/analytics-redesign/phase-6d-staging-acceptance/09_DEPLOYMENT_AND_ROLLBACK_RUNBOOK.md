# Staging 部署與回退 Runbook（只準備，不執行）

**本文件為操作程序。Phase 6D 未執行任何遠端步驟。**

固定版本：**僅** `610495c5a9c9e0656f894ce19d81f381319d1ae8`（`release/analytics-staging-candidate`）。

## 步驟

1. **Staging 授權** — URL、帳號、允許操作、匯出政策、回退負責人書面確認。
2. **固定 Candidate SHA** — `git rev-parse` 確認等於 `610495c5…`；禁止「分支最新」口頭指定。
3. **確認 Lockfile** — frontend／backend `package-lock.json` 與 Candidate 一致（lockfileVersion 3）；`npm ci`。
4. **確認 Node** — `node -v` → v20.x（目標 20.20.2）。
5. **Build** — `cd reservation-frontend && npm ci && npm run build`；確認 `build/web.config`、`build/index.html`、無 `browser-tests/`。
6. **備份 Staging 現有部署** — 備份目前 `reservation-backend/build/`（或 IIS 實體路徑）與必要設定檔；保留可還原目錄名稱與時間戳。**不要**未授權 DB restore。
7. **驗證 IIS Rewrite** — URL Rewrite + ARR；`web.config` 與 repo 一致（非檔案 → `http://127.0.0.1:3000/{R:0}`）。
8. **驗證 API Proxy** — 呼叫不存在的 `/api/__staging_probe_not_found` → 404 JSON `API_NOT_FOUND`，`Content-Type` 含 json，**body 不是** `index.html`。
9. **驗證環境變數** — Staging `.env`：JWT／DB／CORS 指向 Staging；Shadow flags **關閉**；確認非 Production DB。
10. **發布** — 依站台慣例：同步 frontend build → backend `build/` → PM2 reload（參考 `scripts/ops/deploy.ps1`，但針對 Staging 路徑與授權；**勿**觸發 production `deploy-prod.yml`）。
11. **Smoke Test** — `/`、`/login`、靜態 asset 200、健康檢查。
12. **三領域驗收** — 執行 `05_THREE_FLOW_ACCEPTANCE.md`。
13. **Permission Test** — 執行 `04`／`06` 角色矩陣。
14. **Export Test** — 僅在授權允許時。
15. **問題發現** — 對照下方回退條件；任一命中 → 停止驗收並回退。
16. **Rollback** — 還原步驟 6 備份的靜態／build 目錄並重啟 Node／PM2；記錄時間與操作者。禁止未授權 `git reset --hard` 於共用伺服器、禁止未授權 DB 回復。
17. **最終驗收簽核** — 更新 Gate Matrix；通過項才改 PASSED。

## 回退條件（立即停止驗收並回退）

- Route 404（深層 SPA 重整失敗）
- API JSON 被 SPA／IIS 吞成 HTML 200
- Login 失敗／Token 異常
- Permission Regression（越權可見）
- Student Data Exposure
- Backend 500 叢集
- Frontend Blank Screen
- Shadow 意外啟用
- Export Regression（未授權仍可下載或檔案損毀）
