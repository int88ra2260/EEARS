# Git 與 Staging Candidate

## 現場證據（Phase 6D 結束時預期）

| Ref | SHA |
|---|---|
| `main` | `1f41dd5202c5672076ab3181e563effb172823fe` |
| `release/analytics-engineering-rc` | `174beebb84ced6d99ebd183a826c10b3ad30a512` |
| `release/analytics-product-rc` | `c2bfd447f5fbe00380c282214df68c3a0514eac9` |
| Phase 6C / Staging Candidate | `610495c5a9c9e0656f894ce19d81f381319d1ae8` |
| Work branch | `test/analytics-staging-readiness` @ Candidate SHA |

## Phase 6C Commit

- Message: `test(analytics): verify application integration and release readiness`
- Full SHA: `610495c5a9c9e0656f894ce19d81f381319d1ae8`
- Parent（Product RC）: `c2bfd447f5fbe00380c282214df68c3a0514eac9`

### Changed paths（Product RC → Candidate）

```
docs/analytics-redesign/phase-6c-product-acceptance/* (00–09)
reservation-frontend/browser-tests/app-main.jsx
reservation-frontend/browser-tests/app.html
reservation-frontend/browser-tests/appAuth.js
reservation-frontend/browser-tests/appIntegration.browser.mjs
reservation-frontend/src/pages/admin/AnalyticsHubPage.css
reservation-frontend/src/pages/admin/AnalyticsHubPage.jsx
reservation-frontend/src/pages/admin/AnalyticsHubPage.test.jsx
reservation-frontend/vite.analyticsBrowser.config.js
```

18 files, +741 / −1。無 lockfile、無 backend、無 `.env`、無 build artifact。

## Branch strategy

1. 於 `test/analytics-product-acceptance` 提交 Phase 6C。
2. `git branch release/analytics-staging-candidate 610495c5…`（新建，未強制移動既有 RC）。
3. `git switch -c test/analytics-staging-readiness` 承接 Phase 6D 未提交產物。

未覆寫：`main`、`release/analytics-engineering-rc`、`release/analytics-product-rc`。

## Commit range note

- Staging Candidate 相對 Product RC：僅 Phase 6C 一筆。
- 相對 `main`：含完整 Analytics Hub／Operations／BESTEP／Learning 體驗與工程 RC 文件鏈（見 `git log main..610495c5`）。

## Forbidden actions（本階段遵守）

- 無 Push、Merge、Rebase、Release Tag。
- Phase 6D 文件與 `productionBuildIsolation.test.mjs` **未**納入 Candidate。
