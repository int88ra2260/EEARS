# EEARS 部署架構與 Staging 可行性評估

日期：2026-11-04。本文件只根據 Repository 與已確認的環境事實。沒有連線正式主機、沒有讀取 `.env`、沒有部署。

證據等級：

- `CONFIRMED_FROM_REPOSITORY`：程式或設定檔可直接核對。
- `USER_CONFIRMED`：本次任務已說明、Repository 無法再證明。
- `SERVER_VERIFICATION_REQUIRED`：必須登入正式 Windows Server 才能確認。

## A. Confirmed Architecture

### 開發環境

`USER_CONFIRMED`：Windows 開發機有 Cursor、Git、React、Node.js、Jest、Vitest、Playwright。沒有 MySQL，沒有 Docker。不是正式伺服器。

### 正式伺服器

`USER_CONFIRMED`：只有一台 Windows Server。IIS、Node.js、MySQL 與現有 EEARS 在同一台。沒有第二台伺服器、VM、Staging 網站或獨立測試資料庫的證據。

`CONFIRMED_FROM_REPOSITORY`：維運文件把正式目錄寫成 `D:\EEARS`。見 `scripts/ops/README.md`、`scripts/ops/SELF_HOSTED_RUNNER.md`、`.github/workflows/deploy-prod.yml`。

### Frontend

`CONFIRMED_FROM_REPOSITORY`：

- 建置指令是 `reservation-frontend` 的 `npm run build`。`reservation-frontend/vite.config.js` 的 `build.outDir` 是 `build`。
- 正式 API 沒有獨立 base URL。`src/utils/axiosClient.js` 不設 `baseURL`。`src/services/englishTestApi.js` 使用相對路徑 `/api/english-test/registrations`。開發機才把 `/api` proxy 到 `http://localhost:3000`（`vite.config.js` 的 `server.proxy`）。
- React Router 的非檔案路徑靠後端 `server.js` 的 `app.get('*')` 回 `build/index.html`。API 未匹配時回 JSON 404，不回 HTML。
- IIS rewrite 只存在 `reservation-frontend/public/web.config`。規則名稱 `ReverseProxyToNode`：磁碟上已存在的檔案由 IIS 直接回應；其餘改寫到 `http://127.0.0.1:3000/{R:0}`。Repository 沒有另一份 `public/web.config`。Vite 會把 `public/` 複製進 `build/`，所以部署後這份 `web.config` 會出現在 `reservation-backend/build/web.config`。
- `scripts/ops/_common.ps1` 的 `Sync-EearsFrontendBuild` 使用 `robocopy /MIR`，把 `reservation-frontend/build` 鏡像到 `reservation-backend/build`。目標裡上一版多出來的檔案會被刪除。
- `server.js` 對 `.html` 設 `Cache-Control: no-cache`，對 `/assets/` 設一年 immutable。這只在 **Node 親自送出檔案** 時有效。若 IIS 網站根目錄就是 `reservation-backend/build`，已存在的 `index.html` 與 hashed asset 會先被 IIS 送出，Express 的快取標頭不會套用。

`SERVER_VERIFICATION_REQUIRED`：IIS 網站實體路徑、Bindings、App Pool、是否快取 `index.html`。Runbook 寫「`public/web.config`」，與實際檔案位置不一致。

### Backend

`CONFIRMED_FROM_REPOSITORY`：

- 入口是 `reservation-backend/server.js`。`package.json` 的 `start` 是 `node server.js`。
- PM2 程序名 `eears-backend`，`instances: 1`，`exec_mode: 'fork'`，`autorestart: true`。見 `reservation-backend/ecosystem.config.cjs`。它只注入 `NODE_ENV=production` 與 `TZ=Asia/Taipei`，資料庫變數仍來自 `reservation-backend/.env`（`server.js` 與 `db.js` 都呼叫 `dotenv.config()`）。
- 程式實際是 `app.listen(port, '0.0.0.0')`，`port = process.env.PORT || 3000`。`reservation-backend/docs/DEPLOYMENT_CHECKLIST.md` 寫的是監聽 `127.0.0.1:3000`。兩者不一致。IIS 只轉到 `127.0.0.1:3000`，不代表 Node 沒有聽其他介面。
- 部署入口是 `scripts/ops/deploy.ps1`：前端 `npm ci`、`npm run build`、`robocopy /MIR`、`pm2 restart eears-backend --update-env`、探測 `http://127.0.0.1:3000/api/events`、再跑 `npm run post-deploy-check`。`-FrontendOnly` 會略過重啟與健康檢查。預設部署腳本不跑 `npm ci` on backend，除非 `-InstallBackendDeps`。
- `post_deploy_check.mjs` 只打 `/api/events`、黑名單狀態、`/api/surveys/enabled`、`/api/reservations`。沒有分析頁、BESTEP analytics、權限或排程檢查。

啟動後會自動做這些事（同一個 `server.js` 程序）：

- `sequelize.authenticate()`。只有 `ENABLE_DB_SYNC=true` 才 `sync({ alter: false, force: false })`。Runbook 禁止正式環境使用 `sync()`。
- `survey_rules` 筆數為 0 時，把 legacy 設定寫入問卷規則。
- 重新載入活動類型目錄快取。
- 若環境有設定，啟動 MFA 與 Whisper 常駐程序。
- 每 15 分鐘，以及啟動當下，執行學習有伴過期檢查。
- 每日活動結束檢查、每日約 06:00 的寫作工坊同步、每日約 02:00 的資料庫備份。備份可用 `BACKUP_DAILY_ENABLED=false` 關掉（`scripts/backupDailyScheduler.js`）。

因此第二個 Node 程序會再跑同一組排程與啟動寫入。PM2 設定成單一 instance，正式重啟是替換同一個程序，不是再加一個。

### Database

`CONFIRMED_FROM_REPOSITORY`：

- 執行期連線在 `reservation-backend/db.js`。未設定環境變數時，會退回 `localhost`、使用者 `root`、資料庫 `activity_reservation`。`config/database.js` 的 development／test 也有同樣退回；production 區塊沒有預設值，但執行期用的是 `db.js`，不是 production 區塊。
- `db.js` 與 `config/database.js` 含有已進版控的預設密碼。本報告不複述該值。正式環境必須依賴 `.env`，不能依賴這些預設。
- 連線池 `max: 120`、`min: 20`。
- Schema 變更走 `reservation-backend/migrations/`。這次整合 diff 沒有新增 migration。
- 備份腳本存在：`scripts/backup-database.js`、`backup-database.ps1`、`backup-database.bat`，以及每日排程。`backup-database.js` 把輸出寫死到 `G:\資料夾備份`。是否有近期成功備份、該磁碟是否存在，Repository 無法證明。

`SERVER_VERIFICATION_REQUIRED`：正式 `DB_HOST`、`DB_NAME`、`DB_PORT`、MySQL 是否只聽本機、`max_connections`、最近一次可還原備份。本次沒有讀 `.env`，也沒有連線。

### GitHub Actions

`CONFIRMED_FROM_REPOSITORY`：

- `.github/workflows/ci.yml`：`push` 或 `pull_request` 目標為 `main` 時，在 `ubuntu-latest` 跑後端測試／lint、前端測試／lint／build。CI 不部署。
- `.github/workflows/deploy-prod.yml`：監聽名為 `CI` 的 workflow，在 **`main` 完成且結論為 success** 時才跑。不是 tag，不是手動，也不是 PR。PR 與 fork 不會進這支 deploy。
- Runner 是 `self-hosted`、`Windows`、`eears-prod`。Job 在 `D:\EEARS` 執行：確認 `.env` 存在、備份並還原 `reservation-backend/data/siteStats.json`、`git fetch`、`git checkout main`、`git reset --hard origin/main`、再呼叫 `deploy.ps1`。
- 不會跑 migration，不會改 `.env`。失敗時只印 PM2 狀態與日誌，**沒有自動把 git 或 build 退回上一版**。
- 追蹤 `origin/main` 本身不會部署。會部署的條件是：變更已經在 `main`，而且該次 CI 成功，而且這台 runner 在線上。

`SERVER_VERIFICATION_REQUIRED`：runner 目前是否 Online、服務帳號是否與 PM2 同一個 Windows 使用者。

## B. Release Diff

| 項目 | 值 |
|---|---|
| main HEAD | `404dac6993fb17e7a96608c330c593e25c35a502` |
| integration HEAD | `2d9d40e7da4a809757e0ee47d534b536e698f77b` |
| 分支 | `integration/analytics-final-acceptance` |
| 比較 | `404dac6...2d9d40e` |

後端只有 4 個檔案：

- 修改 `reservation-backend/routes/englishTestRegistrationRouter.js`（+7 / -1）。`GET /api/english-test/registrations/stats/analytics` 額外回傳 `registrationSummary`、`attendance`、`scores`。既有 `infoSource`、`department`、`grade`、`activeSemester`、`availableSemesters`、`semesterCounts` 仍在。
- 新增 `reservation-backend/services/bestepAnalyticsAggregateService.js`。它讀既有 `EnglishTestRegistration`、`BestepAttendance`、`BestepExamScore`，沒有新表。
- 兩個測試檔。不是 runtime。

其餘都是前端頁面、導覽標籤、樣式與測試。`adminRouteAccess.js` 只改顯示名稱（例如「高風險行政追蹤」改為「高關注名單」），沒有改權限鍵。`reservation-backend/auth/permissions.js` 不在 diff 裡。

| 檢查 | 結果 |
|---|---|
| 新的 runtime dependency | 未發現。兩邊 `package.json` 都不在 diff。 |
| Backend API | 有。BESTEP analytics 回應多三個欄位，路徑不變。 |
| Database model | 未發現。 |
| Migration | 未發現。 |
| SQL 字串或統計公式檔 | 未發現。新服務用既有 Sequelize `findAll`。 |
| 環境變數 | 未發現。 |
| Build／Start script | 未發現。 |
| 權限模型 | 後端未發現。前端只有標籤。 |
| Cron／背景工作 | 未發現。 |
| IIS／部署設定 | 未發現。 |

### API 相容

不能把這次當成「只更新前端就等於六階段功能完整上線」。

- 新前端對缺欄位有退路：`englishTestApi.js` 在沒有 `registrationSummary`、`attendance`、`scores` 時設成 `null`。舊後端配新前端時，其他既有分析頁仍打 main 上已有的 API；BESTEP 新數字會是空的，不應把整站打掛。
- 舊前端配新後端時，多出來的 JSON 欄位可被忽略。既有欄位還在。這方向相容。
- 要讓 BESTEP 新面板有數字，前後端必須一起切換。`deploy.ps1` 預設就是 build 後重啟 Node，符合這個需求。`-FrontendOnly` 不夠。
- 短暫只更新前端不會改資料庫。它只會讓 BESTEP 新區塊先顯示空值，直到後端換成 `2d9d40e`。

### Schema

這次不需要新資料表、新欄位、新索引，也沒有改既有資料格式或 Sequelize model。不依賴一份「只為這次整合」的 migration。

正式資料庫是否已經跟上 **main 既有** migration，仍是 `SERVER_VERIFICATION_REQUIRED`。那不是這次 diff 新加的阻擋，但不能因此假設正式 schema 與 main 完全一致。

## C. Single-server Risks

| 風險 | 等級 | 成立條件 |
|---|---|---|
| 合併到 `main` 就自動部署 | High | runner 在線上，且 CI 成功。`deploy-prod.yml` 會在 `D:\EEARS` 執行 `reset --hard` 與 `deploy.ps1`。沒有人工閘門。 |
| 部署失敗不自動回復 | High | `reset --hard` 已完成後，`deploy.ps1` 或健康檢查失敗。Workflow 只印 PM2 日誌。 |
| `robocopy /MIR` 刪除舊靜態檔 | Medium | 新舊 `index.html` 同時存在於瀏覽器或 IIS 快取。舊 HTML 指向的 hashed 檔已被鏡像刪除。Express 的 `no-cache` 管不到 IIS 直接送出的檔案。 |
| Node 聽 `0.0.0.0:3000` | Medium | 主機防火牆沒有擋住 3000。文件寫 127.0.0.1，程式不是。 |
| 第二個 Node 重複排程 | High | 在同一台再啟動一份 `server.js` 做平行 Staging。學習有伴過期、活動結束檢查、寫作工坊同步、每日備份與問卷規則啟動寫入都會再跑一次。 |
| 共用 MySQL | High | 平行環境使用同一個 MySQL 服務。即使另建資料庫，仍共用 `max_connections`、磁碟、備份與高權限帳號。`db.js` 連線池每個程序最少 20、最多 120。誤設 `DB_NAME` 會碰到正式庫。 |
| 預設連線退回 | High | `.env` 缺少 `DB_*` 時，`db.js` 退回 `localhost` / `activity_reservation`。正式與任何測試程序都不能依賴這個退回。 |
| 啟動寫入 | Medium | `survey_rules` 為 0 時會寫入。正常正式庫已有規則時不會重跑。空庫或連錯庫時會寫。 |
| 健康檢查範圍窄 | Medium | `post-deploy-check` 通過不代表分析頁、BESTEP 新欄位或權限正常。 |
| 備份路徑無法從 Git 證明 | High | 腳本指向 `G:\資料夾備份`，但伺服器上有沒有可還原的近期備份尚未確認。 |

CDV 未完成項目不得算進已驗證：

- 驗證工作樹的矩陣曾被說成 28 項，磁碟上的文件是 24 項。
- `safePct` 的匯出只存在驗證工作樹的未提交修改，不在 `2d9d40e`。公式沒有改，也還沒進整合候選。
- DB Guard 沒有連上 MySQL。沒有 `DB_BACKED_SYNTHETIC`。CDV-DB 沒有執行 SQL。
- KPI 政策仍缺正式核准證據。

這些都留在 `D:\EEARS-analytics-data-validation`，本評估沒有改那些檔案。

## D. Staging Options

### 1. 獨立主機或 VM

開發機目前不能做資料庫驗證。未來若有獨立 VM、獨立 Node、獨立 MySQL 與合成資料，才能做 schema、SQL 與 API 核對，而且不碰正式服務。現在沒有這台機器，也不得為了這次評估安裝 MySQL 或 Docker。這條是資料驗證的目標環境，不是現在就能執行的步驟。

### 2. 正式主機平行 Staging

同一台 Windows Server 上再加一個 IIS Site，**不等於**安全隔離。至少要同時滿足：另一個 Site 與 App Pool、另一個 hostname、另一個 Node port、另一個程序、另一個目錄、另一份環境變數與 log、排程全部關閉、不能使用正式 `DB_NAME`、測試身分與對外存取分開。即使另建一個 MySQL database，仍共用同一個 MySQL 服務與主機資源。第二個 `server.js` 會重複正式排程。Repository 沒有 CPU、RAM、磁碟或 `max_connections` 的餘裕數據。現階段不建議在正式主機做平行 Staging，也不要在正式 MySQL 建測試 schema。

### 3. 不建長期 Staging，改離線驗證與受控發版

這符合目前只有一台正式主機、開發機沒有 MySQL 的限制。

可用的部分：

- 已完成的 Mock／契約測試與先前的 production build。
- CI 在合併進 `main` 之前先跑。注意：一旦合併進 `main` 且 CI 成功，就會觸發正式部署。
- 這次沒有 migration，應用程式可以整包切換。
- `deploy.ps1` 有就緒探測。回復方式是把 `D:\EEARS` 指回上一個 commit 再跑一次 `deploy.bat`。這只回復程式與靜態檔。

不能代替的部分：

- 不能代替資料庫支援的合成 SQL 驗證。
- 不能標記 Staging Accepted 或 Data Validated。
- 不能在正式站寫入合成資料。
- 不能把 `post-deploy-check` 當成分析功能驗收。

### 建議

現況採用方案 3 作為**應用程式發版路徑**，並把方案 1 訂為資料驗證的前置條件。方案 2 現在不做。

理由：這次 diff 沒有 schema 變更，正式機只有一台，開發機沒有隔離 MySQL。六階段的畫面與導覽可以在受控窗口整包切換；BESTEP 新數字必須後端一起上。統計是否與原始資料一致，仍是 Pending，不能靠這次發版補做。

在取得人工授權、確認可還原備份、並確認 runner 不會在審查完成前自動部署之前，不要把 `integration/analytics-final-acceptance` 合併進 `main`。

## E. Deployment Gates

| Gate | 狀態 | 解除條件 |
|---|---|---|
| 1 Source Ready | Ready | 候選已固定在 `2d9d40e`。本文件已對 `404dac6...2d9d40e` 做過 diff。沒有 migration，API 是附加欄位。仍等待人工審查這份報告。 |
| 2 Build Ready | Ready | 先前驗收已記錄 Playwright 59/59、Vitest 83/83、選定後端 Jest、production build。本輪沒有重跑。`package.json` 無變更。Artifact 是部署當下在正式機 build，Git 沒有保存版本化的 `dist`。 |
| 3 Database Validation | Pending | 要有獨立 MySQL、`eears_cdv_*`、Guard 通過後的真實 SQL。目前沒有。KPI 政策核准也仍缺證據。 |
| 4 Environment Ready | Not Started | 需在正式主機核對 IIS 實體路徑、3000 埠防火牆、`.env` 沒有空的 `DB_*`、`ENABLE_DB_SYNC` 不是 `true`、runner 與 PM2 同一使用者、磁碟與 `G:\資料夾備份`。 |
| 5 Deployment Readiness | Blocked | 還沒有已驗證的還原、維護窗口、發版負責人與正式授權。合併 `main` 會自動部署。 |
| 6 Post-deployment Validation | Not Started | 授權發版之後才做登入、預約、BESTEP、學習歷程、分析頁、高關注名單、Excel、排程與 log。本輪不執行。 |

## F. Minimal Next Actions

1. 不要把整合分支合併進 `main`。目的是避免 CI 成功後自動部署。不需現在登入伺服器。不影響正式服務。需要團隊遵守，不需要新的系統授權。
2. 登入正式主機，只讀確認 runner 是否 Online、IIS 網站路徑、Node 是否只被本機防火牆允許、最近一次備份檔是否可辨識。目的是補上 `SERVER_VERIFICATION_REQUIRED`。需要伺服器存取。只讀時不應影響服務。需要人工授權。
3. 確認 `ENABLE_DB_SYNC` 在正式 `.env` 不是 `true`，且 `DB_NAME` 有值。目的是避免啟動時 sync 或退回預設庫。需要看環境變數名稱與是否為空，不需要把密碼抄出。可能無影響。需要授權。
4. 在維護窗口前做一次可還原演練的備份檢查，不在本輪執行還原。目的是分開「程式可 Git 回復」與「資料庫能否回復」。需要伺服器。備份本身會增加磁碟負載。需要授權。
5. 發版時使用完整 `deploy.ps1`，不要用 `-FrontendOnly`。目的是讓 BESTEP 三個新欄位與新前端一起生效。會重啟正式 Node。需要授權與窗口。
6. 發版後除了 `post-deploy-check`，另以人工看分析入口、BESTEP 新區塊、高關注名單與一份既有報表。目的是補健康檢查的盲點。會讀正式資料，不寫合成資料。需要授權。
7. 若要宣告資料驗證，另備獨立 MySQL。目的是完成 CDV-DB。現在不要安裝到開發機，也不要使用正式 MySQL。需要新環境與授權。
8. 保留驗證工作樹的未提交 CDV 成果，不要把它們混進這次發版。目的是避免把未完成的 Guard 與未執行的 SQL 說成已驗證。不影響正式服務。
9. 記錄回復指令：上一版 commit、`git reset --hard` 該 commit、再跑 `scripts\ops\deploy.bat`。目的是應用程式回復。這會再次中斷正式服務。只有在已授權的失敗窗口使用。資料庫不靠這一步回復。
10. KPI 政策在取得正式核准證據前，維持 `PENDING_POLICY_APPROVAL`。目的是避免合成計算被當成核定口徑。不需要動正式服務。

## G. Preflight handoff

後續文件，本輪仍未登入正式主機：

- 唯讀腳本：`scripts/ops/production-preflight-readonly.ps1`
- 發版步驟：`docs/deployment/EEARS_PRODUCTION_RELEASE_RUNBOOK.md`

狀態是 `PREFLIGHT_SCRIPT_PREPARED`。不是 `SERVER_PREFLIGHT_PASSED`。`RESTORE_VERIFIED` 在腳本裡固定為 `UNKNOWN`。不完整的 `.env`、防火牆、IIS、PM2 與備份證據不會再被判成 PASS。腳本 Exit 0 也不是 Production Approved。

## H. Backup provenance

Repository 能分出產生備份、排程與健康檢查。正式主機有沒有真的在跑，是 `SERVER_VERIFICATION_REQUIRED`。`OPS_BACKUP_SCRIPT` 可以改掉預設腳本，這次沒有讀正式環境變數。

| 欄位 | 排程使用的產生器 | 手動／舊產生器 | 健康檢查 |
|---|---|---|---|
| Producer | `scripts/backup-db-dump.ps1`，由 `scripts/backup-db.bat` 呼叫 | `reservation-backend/scripts/backup-database.js`，另有同目錄 `.ps1` / `.bat` | 不產生備份 |
| Scheduler | `server.js` 呼叫 `startBackupDailyScheduler`；它呼叫 `opsScriptsService.startBackupJob`，預設執行 `scripts/backup-db.bat` | 沒有掛在 `server.js`。`package.json` 的 `backup` 會手動跑 `backup-database.js` | 排程在備份過期時會再呼叫 `startBackupJob`，不是自己寫檔 |
| Expected Directory | `D:\EEARS_backup\local`。成功後可複製到 `E:\EEARS_backup` | `G:\資料夾備份` | 預設也是 `D:\EEARS_backup\local`，可用 `BACKUP_HEALTH_DIR` 改 |
| Filename Pattern | `eears_yyyy-MM-dd_HH-mm.sql.gz` | `activity_reservation_backup_YYYY-MM-DD_HH-MM-SS.sql` | 預設任何以 `.sql.gz` 結尾的檔，比產生器的檔名寬 |
| Compression | `tar -czf` 後刪除中間 `.sql` | 未壓縮 `.sql` | 不壓縮 |
| Health Checker | 不負責檢查 | 不負責檢查 | `reservation-backend/utils/backupHealthCheck.js` |
| Repository Evidence | `scripts/backup-db.bat`、`scripts/backup-db-dump.ps1`、`services/opsScriptsService.js` 的 `getBackupScriptPath` | `reservation-backend/scripts/backup-database.js` | `utils/backupHealthCheck.js` 的 `getBackupHealthConfig` |
| Runtime Confirmed | NO | NO | NO |
| Risk | 正式機若設定 `OPS_BACKUP_SCRIPT`，預設目錄就不是證據。Repository 沒有 Windows 工作排程器 XML | 文件 `DATABASE_BACKUP_GUIDE.md` 仍把這支當成主要備份，和 `server.js` 不一致。Preflight 只把它當 legacy，不當成排程健康 | 預設 pattern 會把不是 `eears_` 開頭的 `.sql.gz` 也算進去 |

`scripts/ops/` 沒有備份腳本。沒有在 Repository 找到工作排程器設定。Preflight 會分開報告 `BACKUP_SCHEDULED_*` 與 `BACKUP_LEGACY_*`，而且 `BACKUP-RUNTIME` 維持 `UNKNOWN`。
