# 測試 Harness 與 Production 隔離

## 測試專用產物（僅 Phase 6C Candidate 內）

| 檔案 | 用途 |
|---|---|
| `browser-tests/app.html` | Application Integration 專用 HTML entry |
| `browser-tests/app-main.jsx` | 掛載真實 `BrowserRouter` + `AdminLayout` |
| `browser-tests/appAuth.js` | `encodeHarnessToken`／`applyHarnessAuth` 合成 JWT payload |
| `browser-tests/appIntegration.browser.mjs` | Playwright／browser 整合驗收 |
| `vite.analyticsBrowser.config.js` | 測試專用 Vite（port 3017、**無 API proxy**）＋ `analytics-app-spa-fallback` |

合成 token 格式：`e30.<base64url(payload)>.sig` — **非**後端簽章 JWT，不可當真實登入證據。

## Production 路徑

| 項目 | 證據 |
|---|---|
| 正式 Vite config | `vite.config.js`：**無** `browser-tests`／`app.html`／`app-main` 字樣 |
| 正式 entry | `index.html` → `src/index.js` → `App` |
| 正式 SPA fallback | **僅** Node `server.js`；測試 middleware 不在 production plugin |
| Build 輸出 | `build/` 無 `browser-tests/` 目錄；`index.html`／assets 無 harness 關鍵字 |

## Phase 6D 隔離測試

`reservation-frontend/browser-tests/productionBuildIsolation.test.mjs`（4 tests）：

1. 正式 `vite.config.js`／`index.html`／`package.json` build scripts 不指向 harness；測試 config 才含 SPA fallback。
2. `src/` 登入與 boot 路徑（含 Login／App／index）不引用合成 harness auth。
3. `build/` 無 `browser-tests/`／`app.html`；產出檔無 harness 符號。
4. 產出 `web.config` 為 IIS→Node `ReverseProxyToNode`，不是 Vite test SPA fallback。

**證據範圍：** 本機設定與 build 產物隔離。不證明遠端 IIS、真實 Staff Login 或 Staging E2E。

本機執行：`npx vitest run browser-tests/productionBuildIsolation.test.mjs` → **4 passed**（Phase 6D closure）。

## Credential safety

- Harness 使用者名：`syn-*`；無真實帳號、學生資料、API key、私鑰。
- 不得用 Synthetic JWT 宣稱 Staging Auth Gate PASSED。
- Staging 驗收必須真實 Staff Login（見 04）。

## Release Blocker 檢查

| 檢查 | 結果 |
|---|---|
| 測試 entry 是否進入 production bundle | 否（PASSED） |
| 使用者可觸發的合成登入 UI | 無（PASSED） |
| 測試 SPA fallback 影響正式 build | 否（僅 `vite.analyticsBrowser.config.js`）（PASSED） |

無 Release Blocker。
