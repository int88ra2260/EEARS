# EEARS Agent 指南

本文件是索引。不變條件在 `.cursor/rules/core.mdc`，路徑限制在 Scoped Rules，執行步驟在 `.cursor/skills/`。

## 指令來源優先級

衝突時依序採用。下層不複製上層全文。專案規則不能覆蓋 Cursor 的系統層或使用者層指令。

| 層級 | 位置 | 放什麼 |
|------|------|--------|
| Core Rules | `core.mdc` | 不變條件。`eears-business-rules.mdc` 只保留舊路徑，不常駐 |
| Scoped Rules | `.cursor/rules/` 中 `alwaysApply: false` 且有 globs 的規則 | 該路徑的技術限制 |
| Skills | `.cursor/skills/*/SKILL.md` | 相關任務才讀的執行步驟 |
| Architecture Docs | `docs/` 中標成現行的契約與設計說明 | 技術依據 |
| Historical Reports | `docs/analytics-redesign/` | 當時證據，不是現行狀態 |

`.agents/skills/` 是外部技能。EEARS 不採用其中的 Next.js、Vercel 部署或 React Canary 要求。

## 專案與技術棧

EEARS 是成大英語中心的活動預約與教學管理平台，包含預約與違規、問卷、培力英檢與班級、英檢報名、學習歷程 v3、學習成效分析、學習有伴與公告。加入候補已停用，契約見 `core.mdc`。

| 層級 | 技術 |
|------|------|
| 後端 | Node.js 20、Express 4、Sequelize 6、MySQL、Jest |
| 前端 | React 18、Vite、React Router 7、Bootstrap 5、axios/fetch |
| 部署 | Windows IIS + Node；SPA fallback |
| CI | GitHub Actions（`.github/workflows/ci.yml`） |

## 目錄

```
EEARS/
├── reservation-backend/     # API、models、migrations、tests
├── reservation-frontend/    # Vite + React。頁面在 src/pages/
├── scripts/ops/             # 部署與 PM2 腳本
├── docs/                    # 契約與歷史報告
├── .cursor/rules/           # 規則
└── .cursor/skills/          # 任務步驟
```

## 任務入口

| 任務 | 先看 |
|------|------|
| 業務底線 | `core.mdc`、`eears-domain-core` |
| 前端 | `frontend.mdc` |
| API 與權限 | `backend-api.mdc`、`backend-auth.mdc`、`eears-permission` |
| 上傳與 PII | `security-owasp.mdc` |
| Excel 匯入 | `data-import-excel.mdc`、`eears-data-import-excel` |
| Migration | `database-migrations.mdc` |
| 成效分析 | `learning-analytics.mdc`、`eears-learning-analytics` |
| 測試 | `backend-testing.mdc`、`eears-testing` |
| 部署 | `eears-deployment-iis`。步驟見 `scripts/ops/README.md` 與 `reservation-backend/docs/DEPLOYMENT_CHECKLIST.md` |
| 週報草稿 | `eears-weekly-ai-workflow` |
| 詞彙庫 | `docs/micro-learning/vocabulary-bank-maintenance.md` |

環境變數見 `reservation-backend/.env.example`。生產秘密要求見 `core.mdc`。

## 規則

| 規則 | 適用範圍 |
|------|----------|
| `core.mdc` | 常駐不變條件 |
| `eears-business-rules.mdc` | 舊路徑，指向 `core.mdc`，不常駐 |
| `frontend.mdc` | `reservation-frontend/src` 的 js、jsx、css，以及 `vite.config.js` |
| `admin-nav-placement.mdc` | 後台側欄大標題、次標題與新頁面放置 |
| `backend-api.mdc` | server、routes、controllers、services、middlewares、utils |
| `backend-auth.mdc` | auth、middlewares、accessControl、routes、security tests、前端權限常數 |
| `security-owasp.mdc` | config、server、middlewares、遮罩，以及含上傳的 route／controller |
| `data-import-excel.mdc` | 檔名含 import 的匯入程式、model、測試與前端檔 |
| `database-migrations.mdc` | migrations、models |
| `learning-analytics.mdc` | 成效分析 service、route、controller 與前端分析頁 |
| `backend-testing.mdc` | `reservation-backend/tests` |
| `eears-deployment-iis.mdc` | server、ecosystem、`.env.example`、`web.config`、`scripts/ops` |

## Skills

| Skill | 用途 |
|-------|------|
| `eears-system` | 跨模組定位與影響面盤點 |
| `eears-domain-core` | 業務底線（登入綁學號、`cutoffHours`、黑名單、Gate） |
| `eears-reservation` | 預約／取消流程 |
| `eears-survey-gate` | 問卷 Gate fail-close |
| `eears-permission` | RBAC／scope |
| `eears-learning-journey-v3` | LJ v3 canonical／讀模型／匯入 |
| `eears-learning-analytics` | 成效分析步驟。量尺與非因果限制見 `learning-analytics.mdc` |
| `eears-data-import-excel` | Excel 匯入去重／稽核 |
| `eears-testing` | 補測策略 |
| `eears-deployment-iis` | IIS＋Node 部署 |
| `eears-weekly-ai-workflow` | 週報 blocks 草稿 |
