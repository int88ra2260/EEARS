# Release Gate Matrix（Phase 6D）

| Gate | 意義 | 狀態 |
|---|---|---|
| Phase 6C Commit | 安全固定 | PASSED（`610495c5…`） |
| Staging Candidate | 唯一 SHA | PASSED（`release/analytics-staging-candidate` = `610495c5…`） |
| Node 20 Regression | 實際驗證 | PASSED（前端關鍵／build／eslint；Backend 1608 為歷史證據綁定前 SHA，見 07） |
| IIS Compatibility | 設定盤點 | PASSED（repo `web.config` + Node SPA／API JSON）；遠端實測 NOT_TESTED |
| SPA Deep Link | 目標環境實測 | NOT_TESTED（語意盤點 PASSED） |
| API Rewrite Isolation | `/api` 不回 HTML | PASSED（程式證據）；Staging 實測 NOT_TESTED |
| Synthetic Auth Isolation | 與正式建置分離 | PASSED |
| Staging Deployment Approval | 核准部署 | PENDING_APPROVAL／BLOCKED |
| Real Staff Login E2E | 真實登入 | STAGING_AUTH_E2E_PENDING／NOT_TESTED |
| Three Management Flows | Staging 實測 | NOT_TESTED |
| Backend Authorization | Staging 實測 | NOT_TESTED（本機 Jest 歷史 PASSED） |
| Excel Export | 實測 | NOT_TESTED |
| Screen Reader | 實測 | NOT_TESTED（`SCREEN_READER_PENDING`） |
| Official Reporting | 官方指標核准 | NOT_APPLICABLE／Pending（政策未放行） |
| Production | 另行核准 | NOT_APPROVED |

不可將未驗證 Staging 項目標為 Passed。
