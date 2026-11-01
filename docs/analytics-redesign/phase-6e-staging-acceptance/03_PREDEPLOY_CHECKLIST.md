# Pre-deploy Checklist（靜態／本機）

**`STAGING_EXECUTION_NOT_AUTHORIZED`** — 本清單可勾選準備項；遠端步驟全部 `NOT_EXECUTED`。

## IIS（repo 靜態審查）

| 檢查 | 本機狀態 | 遠端 |
|---|---|---|
| `public/web.config` ReverseProxy → `127.0.0.1:3000` | PASSED | NOT_EXECUTED |
| SPA Deep Link 語意（非檔案→Node→index.html） | PASSED（程式） | NOT_EXECUTED |
| Static Assets IsFile | PASSED（設定） | NOT_EXECUTED |
| `/api/*` JSON 404（Node） | PASSED（`server.js`） | NOT_EXECUTED |
| HTTPS／Rewrite Order／環境分離 | 需目標機確認 | NOT_EXECUTED |
| Node／PM2 process | 依 SOP | NOT_EXECUTED |

靜態通過 ≠ 遠端 IIS 通過。

## Production Build（相對 Application Candidate 內容）

| 檢查 | 狀態 |
|---|---|
| 正式 `vite.config.js` | PASSED |
| 無 Test Harness Entry／Synthetic Auth 於 build | PASSED（isolation 4） |
| 無公開 browser-tests 路由於產出 | PASSED |
| `web.config` 進入 `build/` | PASSED |
| Lockfile 未授權變更 | PASSED（無變更） |
| 工作樹額外 6E 文件不進部署包 | 政策：只從乾淨 Candidate tree／備份產物發布 |

**不得**從含未確認變更的工作樹直接發布。

## Rollback 涵蓋面（程序就緒／環境未確認）

前端靜態、IIS Rewrite、Node／PM2、Backend 相容、環境變數、版本識別（SHA）、資料保護、驗收日誌。  
**禁止**以伺服器上 `git reset --hard` 當正式回退唯一手段。詳見 Phase 6D `09_DEPLOYMENT_AND_ROLLBACK_RUNBOOK.md`。
