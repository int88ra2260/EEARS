# IIS 與 SPA 相容性

## 現有設定（repo 證據，非推測）

### `reservation-frontend/public/web.config`

單一規則 `ReverseProxyToNode`：

- Match：`url=".*"`
- Condition：`{REQUEST_FILENAME}` **不是**實體檔案（`IsFile` negate）
- Action：Rewrite → `http://127.0.0.1:3000/{R:0}`（保留 query）

正式 build 會把 `public/web.config` 複製到 `build/web.config`（本機 `npm run build` 已確認存在）。

### 架構（`scripts/ops/README.md`）

```
IIS（靜態檔直接服務；其餘 → Node :3000）
  → PM2 eears-backend
    → express.static(build/)
    → SPA fallback / API JSON 404
```

部署路徑：`deploy.ps1` 前端 build → robocopy 至 `reservation-backend/build/` → 重啟 PM2。

## 請求分類

| 請求類型 | IIS | Node |
|---|---|---|
| 靜態資產（實體檔存在於網站根） | 直接回檔 | 不經 Node |
| `/admin/analytics` 等深層 SPA | 非檔案 → 代理至 Node | `app.get('*')` → `index.html` |
| `/api/*` 已註冊路由 | 代理至 Node | 對應 router |
| `/api/*` 不存在 | 代理至 Node | **404 JSON** `API_NOT_FOUND`（非 HTML） |
| 遺失的 hashed asset path | 代理至 Node | `isMissingFrontendAssetPath` → 純文字 404 |

證據：`reservation-backend/server.js` L203–218。

## Deep Link 預期（目標環境語意）

下列路徑在 IIS 上應為「非檔案 → Node → SPA `index.html`」，再由 `BrowserRouter` 匹配：

- `/admin/analytics`
- `/admin/analytics/overview`
- `/admin/classes`
- `/admin/classes/:classId/bestep`
- `/admin/learning-analytics/resources`
- `/admin/learning-analytics/skills`

| 層級 | 行為 |
|---|---|
| 1. 前端 Route | React Router + `adminRouteAccess` Guard |
| 2. IIS HTTP | Reverse proxy（非 IsFile） |
| 3. Static asset | IsFile 直接服務 |
| 4. Backend API | `/api/*` 永不回 `index.html` |

## 已確認風險

| 風險 | 評估 | 緩解 |
|---|---|---|
| IIS 未安裝 URL Rewrite／ARR | 遠端未驗證 → Staging 部署前必查 | Runbook 步驟 7–8 |
| IIS 直接服務 SPA 而無 Node fallback | 現行設計依賴 Node SPA；若誤改成純靜態 IIS rewrite 到 `index.html` 且誤含 `/api`，會吞 API | 維持「非檔案全代理 Node」；勿在未驗證下改 Production proxy |
| `/api` 回 HTML | 現行 Node 已 fail-close JSON 404 | Staging smoke：對不存在 `/api/...` 檢查 `Content-Type: application/json` |
| Basename／asset base | Vite 預設 `/`；未見特殊 basename | 若 Staging 掛子路徑需另核 | 

## 遠端實測狀態

`SPA Deep Link` / `API Rewrite Isolation` **本機盤點 PASSED；Staging／Production 伺服器實測 NOT_TESTED**（無部署授權）。

## 最小修正方案（僅備案，未套用）

若 Staging IIS 缺少 Rewrite：

1. 確認 IIS URL Rewrite + Application Request Routing。
2. 網站根放置與 repo 相同之 `web.config`。
3. 確認實體 `build`／網站實體路徑對齊，使 IsFile 對 assets 生效。
4. 禁止把 `/api` 改寫成靜態 `index.html`。

**不得**在本次直接更改正式 IIS 站台。
