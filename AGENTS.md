# EEARS Agent 指南

本文件供 AI agent 與開發者快速理解專案結構與工作方式。詳細規則見 `.cursor/rules/`。

## 專案簡介

EEARS（English Enhancement and Activity Reservation System）是成大英語中心活動預約與教學管理平台，包含：

- 活動預約、候補名單、簽到與違規管理
- 問卷系統（含 gate、修復、分析）
- 培力英檢（BESTEP）匯入與班級概況
- 英檢報名審核
- 學習歷程 v3（Learning Journey canonical read model）
- 學習有伴、公告、分析報表

## 技術棧

| 層級 | 技術 |
|------|------|
| 後端 | Node.js 20、Express 4、Sequelize 6、MySQL、Jest |
| 前端 | React 18、CRA、React Router 7、Bootstrap 5、axios/fetch |
| 部署 | Windows IIS + Node；SPA fallback |
| CI | GitHub Actions（`.github/workflows/ci.yml`） |

## 目錄結構

```
EEARS/
├── reservation-backend/     # API 伺服器
│   ├── server.js            # 入口、路由掛載
│   ├── ecosystem.config.cjs # PM2 程序定義（生產）
│   ├── routes/              # HTTP 路由（*Router.js）
│   ├── controllers/         # 複雜 admin 邏輯
│   ├── services/            # 業務邏輯
│   ├── models/              # Sequelize 模型
│   ├── migrations/          # DB schema 變更
│   ├── middlewares/         # auth、errorHandler 等
│   ├── auth/                # 權限鍵、存取輪廓
│   ├── tests/               # Jest 測試
│   └── scripts/             # 維運腳本
├── reservation-frontend/    # React SPA
│   └── src/
│       ├── pages/           # 頁面（admin/ 為後台）
│       ├── components/      # 可重用元件
│       ├── hooks/           # 自訂 hooks
│       ├── services/        # API 薄層
│       ├── constants/       # 權限、路由、翻譯
│       └── utils/           # fetchClient、accessControl
├── scripts/ops/             # 正式部署／重啟／PM2（Windows）
└── .cursor/rules/           # Cursor AI 規則
```

### 生產部署（Windows）

| 動作 | 指令 |
|------|------|
| 首次 PM2 | `scripts\ops\setup-pm2.bat` |
| 完整上線 | `scripts\ops\deploy.bat` |
| 只重啟後端 | `scripts\ops\restart-backend.bat` |

細節：`scripts/ops/README.md`、`reservation-backend/docs/DEPLOYMENT_CHECKLIST.md`。
## 關鍵慣例

### 後端

- 新 API：route → service →（必要時）controller
- 管理端必加 `authMiddleware` + `requirePermission(P.XXX)`
- Schema 變更只用 migration，不用 `sync()`
- 權限鍵在 `auth/permissions.js`，前後端須同步

### 前端

- 新頁面放 `pages/`（`.jsx`）；後台路由同步 `adminRouteAccess.js`
- API 用相對路徑 `/api/...`；token 存 `localStorage`
- 無全域狀態庫；用 hooks + context

### 測試

- 後端：`tests/**/*.test.js`；權限測試放 `tests/security/`
- 前端：CRA Jest；目前覆蓋率偏低，新功能建議補測試
- CI 要求兩端 test + lint；前端額外 build

## 常見任務指引

### 新增管理端功能

1. `auth/permissions.js` 加權限鍵（若需新權限）
2. `routes/` + `services/` 實作 API
3. `server.js` 掛載路由
4. `pages/admin/` 建頁面 + `App.js` 加路由
5. 更新 `adminRouteAccess.js`、`adminNavigation.js`
6. 補 `tests/security/` 或 service 單元測試

### 新增資料表

1. `migrations/YYYYMMDDHHMMSS-*.js`
2. `models/NewModel.js` + `models/index.js` 關聯
3. 執行 `npx sequelize-cli db:migrate`

### 修 CI 失敗

1. 本機重現：`npm test -- --runInBand`（backend）或 `npm test -- --watchAll=false`（frontend）
2. 修復後跑完整 CI 檢查鏈
3. 勿跳過 pre-commit hooks

### 字彙庫與微學習題庫

Canonical 詞彙與 Vocabulary Depth / Word Bridge / Listening Ladder 衍生題庫由腳本產生，**勿手改** `*Generated.js` 或 `canonicalVocabulary.js`。

| 指令（於 `reservation-frontend`） | 用途 |
|------|------|
| `npm run vocab:build` | 完整重建（canonical → 微學習題庫 → CEFR 稽核） |
| `npm run vocab:check` | 僅驗證、不寫檔（CI 使用） |
| `npm run vocab:verify` | 稽核 + 相關 Jest |

Runbook：`docs/micro-learning/vocabulary-bank-maintenance.md`；目錄說明：`reservation-frontend/src/data/learningContent/vocabulary/README.md`。

### 用 AI 生成本週週報草稿

1. 複製 `.cursor/skills/eears-weekly-ai-workflow/PROMPT-TEMPLATE.md` 填寫靈感
2. 請 AI 依 `eears-weekly-ai-workflow` skill 產出 `blocks` JSON（預設 `draft`）
3. 匯入後台（擇一）：
   - **腳本**：`cd reservation-backend && npm run weekly:import-draft -- --file ../.cursor/skills/eears-weekly-ai-workflow/drafts/<檔名>.json --fill-events`
   - **手動**：`/admin/weekly-reports` 建立或編輯 → 貼上 blocks
4. 預覽 → 補媒體／活動 → 人工確認後發布
5. 範例見 `examples.md`；完整草稿見 `drafts/`

## 環境變數

參考 `reservation-backend/.env.example`。生產必填：

- `JWT_SECRET`（≥32 字元）
- `CORS_ORIGINS`
- `DB_*` 連線資訊

## 相關規則檔

| 規則 | 適用範圍 |
|------|----------|
| `project-overview.mdc` | 全域 |
| `development-workflow.mdc` | 全域（開發流程） |
| `backend-api.mdc` | `reservation-backend/**` |
| `backend-auth.mdc` | 權限相關檔案 |
| `database-migrations.mdc` | migrations、models |
| `backend-testing.mdc` | tests |
| `frontend-react.mdc` | `reservation-frontend/**` |
| `.cursor/skills/eears-weekly-ai-workflow/` | 週報 AI 輔助工作流（指令範本、範例） |
