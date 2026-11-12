# 學生回報正式發布前檢查

- 日期：2026-11-12
- PR：https://github.com/int88ra2260/EEARS/pull/7（Draft #7）
- 分支：`feature/student-feedback-management`
- Head：`7195ab051b2418a08de4d1e0eeb638bc4050e387`
- Base：`main` / `e066a07373228aeb3151077f58cf62cf44fbf017`
- 本文件沒有連正式庫、沒有執行 migration、沒有合併、沒有部署。
- Production Migration Status：UNKNOWN。UNKNOWN 不是 PASS，也不是發布許可。

## 1. Current Production Risk

PR CI 已通過，GitHub 顯示沒有 git 衝突。這兩件事都不代表正式 schema 已跟上程式。

| 事實 | 影響 |
|------|------|
| Draft PR 的 CI 成功 | 只跑測試、lint 與前端 build。不部署。 |
| 合併到 `main` 且 CI 成功 | `deploy-prod.yml` 會在正式機 `D:\EEARS` 執行 `git reset --hard origin/main`，再跑 `scripts/ops/deploy.ps1`。 |
| `deploy.ps1` | 建置前端、同步 `reservation-backend/build`、`pm2 restart eears-backend`、探測 `/api/events`。不跑 migration，不改 `.env`。 |
| 正式 SequelizeMeta 與 schema | 尚未由授權人員查過。狀態維持 UNKNOWN。 |
| 正式後台列表曾出現「資料庫查詢失敗」 | 這是線上症狀。本機曾用缺少 `status` 的表重現類似錯誤。它不是 `SHOW CREATE TABLE` 或 `SequelizeMeta` 證據，不能把正式庫判成 FAIL，也不能當成已修復。 |

因此現在不能合併。合併就是發布。新程式會查 `status`、`priority` 與 `student_feedback_events`。欄位或資料表若不存在，後台列表與更新會失敗，部署流程卻不會自動補 migration。

正式程式位置是正式機的 `D:\EEARS`。PM2 程序名稱是 `eears-backend`，聽 `127.0.0.1:3000`。IIS 把流量轉到這個位址。靜態檔在 `reservation-backend/build`。本機開發電腦不是正式主機。

產品沒有維護模式，也沒有只關閉學生回報的開關。`pm2 restart` 會讓整個 API 與 SPA 短暫停機。`pm2 stop eears-backend` 會停掉整站，包含預約與問卷，不是只停回報。

`npm run post-deploy-check` 只打活動、黑名單、問卷與預約。它不打學生回報 API，不能代替本文件的資料庫閘門。

`server.js` 只在 `ENABLE_DB_SYNC` 正好是 `true` 時呼叫 `sequelize.sync()`。正式環境必須維持不是 `true`。sync 不能代替 migration。

## 2. Migration Dependencies

Sequelize 以檔名排序，並把完整檔名寫進 `SequelizeMeta`。下面是這個 Head 上、從學生回報第一支 migration 起的實際順序。`db:migrate` 會套用 `SequelizeMeta` 裡還沒有的每一支，不會只跑學生回報那四支。

| 順序 | 檔名 | 在 `main` | 作用 |
|------|------|-----------|------|
| 1 | `20261108150000-create-student-feedback.js` | 已在 | 建立 `student_feedback` |
| 2 | `20261108150100-grant-student-feedback-permission.js` | 已在 | 為已有權限列的角色補 `can_view_student_feedback` |
| 3 | `20261110123000-create-leader-public-profiles.js` | 已在 | 與學生回報無關。若正式庫尚未記錄，migrate 仍會跑到 |
| 4 | `20261110131500-repair-campus-private-use-qi.js` | 已在 | 既有姓名修復。同上 |
| 5 | `20261110143000-repair-more-campus-private-use-names.js` | 已在 | 既有姓名修復。同上 |
| 6 | `20261110160000-drop-cancellation-code-from-email-overrides.js` | 已在 | 與學生回報無關。同一時分的另一個檔名 |
| 7 | `20261110160000-student-feedback-cases.js` | 已在 | 案件欄位與 `student_feedback_messages` |
| 8 | `20261110160100-grant-student-feedback-manage-permission.js` | 已在 | 為已有權限列的角色補 `can_manage_student_feedback` |
| 9 | `20261112161000-student-feedback-events.js` | 只在 PR | 新建 `student_feedback_events` |
| 10 | `20261112173000-student-feedback-priority.js` | 只在 PR | 可空 `priority` 與索引 |

同一時分的兩支 `20261110160000` 都會執行。字母序是先 `drop-cancellation-code-from-email-overrides`，再 `student-feedback-cases`。這不是 schema 衝突。正式庫若缺其中一筆 `SequelizeMeta`，不能手動插紀錄來跳過。

學生回報四支的依賴：

1. `teachers` 必須已存在。`teachers.id` 在 `20241201000006-create-teachers.js` 是 signed `INTEGER`。回報外鍵也是 signed `INTEGER`。
2. `20261108150000` 建立案件表。沒有這張表，後面的案件欄位、事件與優先級都不能加。
3. `20261110160000-student-feedback-cases.js` 依賴案件表與 `teachers`。既有列會得到 `status='open'`、`replyRequested=true`。這是欄位預設，不是把內文改寫。`assignedTeacherId` 與 `closedAt` 可空。
4. `20261112161000` 只建事件表，不改既有案件列。依賴 `student_feedback` 與 `teachers`。
5. `20261112173000` 只加可空 `priority`，沒有預設，不把舊案件改成 P2。依賴案件表已存在。

兩支 grant 不建表。角色在 `role_permissions` 完全沒有列時，不會插入。已有列的指定角色才補那一個權限鍵。它們的 `down` 會刪掉該權限鍵的所有列，包含後來人工加的，不能當一般回滾。

這些 migration 都沒有 `IF NOT EXISTS`。表或欄位已經在、但 `SequelizeMeta` 沒有檔名時，重跑 `up` 會失敗。MySQL 的 DDL 可能在 `SequelizeMeta` 寫入前就提交。中途失敗要當成可能已部分套用，先做唯讀比對，不要立刻重跑。

`reservation-backend/package.json` 沒有 `db:migrate` script，也沒有把 `sequelize-cli` 列為 dependency。既有部署檢查表寫的是在 `reservation-backend` 使用 `npx sequelize-cli db:migrate`。本文件不執行該指令。授權人員若要跑，必須在正式機、`NODE_ENV=production`，讓 `config/database.js` 使用 `production` 區段。未設 `NODE_ENV` 時會落到 `development` 區段。不要印出帳號、密碼、主機或資料庫名稱。

### Expected Schema

`student_feedback` 在四支都成功之後：

| 欄位 | 型別 | 空值 | 預設 |
|------|------|------|------|
| id | INTEGER，主鍵，自動遞增 | 否 | |
| studentId | VARCHAR(20) | 否 | |
| studentName | VARCHAR(100) | 否 | |
| email | VARCHAR(100) | 否 | |
| emailVerified | TINYINT(1) | 否 | 0 / false |
| kind | VARCHAR(20) | 否 | |
| category | VARCHAR(32) | 否 | |
| message | TEXT | 否 | |
| emailStatus | VARCHAR(20) | 否 | pending |
| createdAt / updatedAt | DATETIME | 否 | |
| status | VARCHAR(20) | 否 | open |
| replyRequested | TINYINT(1) | 否 | 1 / true |
| assignedTeacherId | INTEGER | 可 | |
| closedAt | DATETIME | 可 | |
| priority | VARCHAR(8) | 可 | 無 |

索引：`idx_student_feedback_student_created`、`idx_student_feedback_created`、`idx_student_feedback_kind_created`、`idx_student_feedback_status_created`、`idx_student_feedback_assignee`、`idx_student_feedback_priority`（`priority, id`）。外鍵 `fk_student_feedback_assignee` 指向 `teachers.id`，刪除老師時設為 NULL。

`student_feedback_messages`：`feedbackId` 必填，刪除案件時 cascade。`teacherId` 可空，刪除老師時設為 NULL。索引 `idx_student_feedback_messages_case`、`idx_student_feedback_messages_student`。

`student_feedback_events`：`id`、`feedbackId`、`eventType`、`visibility`（預設 staff）、`actorType`、`beforeValue`、`afterValue`、`createdAt` 不可空。`actorTeacherId`、`actorStudentId`、`requestId` 可空。沒有 `updatedAt`。索引 `idx_student_feedback_events_timeline`（`feedbackId, createdAt, id`）。案件外鍵 cascade，老師外鍵刪除時設為 NULL。

隔離 MySQL 曾通過這些物件的測試。那不是正式庫證據。

## 3. Read-only Verification Checklist

由已授權的人在正式機執行。本機沒有經確認的正式庫唯讀身分，所以這裡只列出待執行語句。不要把結果裡的學生姓名、學號、信箱、內文或留言貼回文件。只回報有沒有表、欄位、索引、外鍵，以及 `SequelizeMeta` 有哪些檔名。筆數可以回報，列內容不行。

先確認沒有 Deploy job 在跑，而且 `ENABLE_DB_SYNC` 不是 `true`。不要印出 `.env`。

### SequelizeMeta

```sql
SELECT name
FROM SequelizeMeta
WHERE name IN (
  '20261108150000-create-student-feedback.js',
  '20261108150100-grant-student-feedback-permission.js',
  '20261110123000-create-leader-public-profiles.js',
  '20261110131500-repair-campus-private-use-qi.js',
  '20261110143000-repair-more-campus-private-use-names.js',
  '20261110160000-drop-cancellation-code-from-email-overrides.js',
  '20261110160000-student-feedback-cases.js',
  '20261110160100-grant-student-feedback-manage-permission.js',
  '20261112161000-student-feedback-events.js',
  '20261112173000-student-feedback-priority.js'
)
ORDER BY name;
```

另外列出比 `20261108150000-create-student-feedback.js` 新、但不在上面清單裡的檔名，避免正式庫有本分支沒有的 migration：

```sql
SELECT name
FROM SequelizeMeta
WHERE name >= '20261108150000'
ORDER BY name;
```

### Schema

```sql
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'teachers',
    'student_feedback',
    'student_feedback_messages',
    'student_feedback_events'
  )
ORDER BY TABLE_NAME;
```

```sql
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'student_feedback',
    'student_feedback_messages',
    'student_feedback_events'
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

```sql
SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'student_feedback',
    'student_feedback_messages',
    'student_feedback_events'
  )
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
```

```sql
SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'student_feedback',
    'student_feedback_messages',
    'student_feedback_events'
  )
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION;
```

`teachers.id` 只核對型別，不查老師姓名或信箱：

```sql
SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'teachers'
  AND COLUMN_NAME = 'id';
```

影響範圍只用筆數：

```sql
SELECT 'student_feedback' AS table_name, COUNT(*) AS row_count FROM student_feedback
UNION ALL
SELECT 'student_feedback_messages', COUNT(*) FROM student_feedback_messages
UNION ALL
SELECT 'student_feedback_events', COUNT(*) FROM student_feedback_events;
```

某一張表不存在時，不要改去查該表的筆數。先依決策樹停止。

### Missing Migration Decision Tree

1. 沒有授權的正式庫連線：停止。全部維持 UNKNOWN。不要合併。
2. 檔名與實際表、欄位、索引、外鍵一致，且四支學生回報檔名都在 `SequelizeMeta`：資料庫現況可交給授權人員判 PASS。仍要有備份與發布授權，才能進部署。
3. `SequelizeMeta` 缺檔名，實際物件也缺同一段：列出所有尚未記錄的檔名，包含領袖頁、姓名修復與取消碼。逐支取得授權後才可 `db:migrate`。不要只挑四支學生回報，也不要手動插入 `SequelizeMeta`。
4. 物件已在，檔名不在：Migration Metadata Mismatch。不要重跑 `up`，不要手補 `SequelizeMeta`。先停，由授權人員對照實際 schema。
5. 檔名已在，物件卻缺：同樣是 mismatch。這些 `up` 不是可重複執行的。不要假設再跑一次會補上。
6. 案件表與 `status`、留言表都在，只缺事件表或 `priority`：這兩支是增量。事件表不改舊列。`priority` 可空且不回填。仍要先備份，並確認沒有其他未記錄的檔名。
7. 案件表在，但沒有 `status` 或留言表：目前已上線的程式就可能查不到 `status`。`20261110160000-student-feedback-cases.js` 會給既有列預設值。套用前要備份，並確認同一時分的取消碼 migration 是否也未記錄。
8. 連 `student_feedback` 都沒有：從 `20261108150000` 起整段都未套用。`db:migrate` 會一併跑到中間的非回報 migration。沒有逐支授權就停止。
9. 任何一條出現部分套用：停止。不要接 `down` 來清現場。

`scripts/ops/production-preflight-readonly.ps1` 不查 `SequelizeMeta` 或 `information_schema`。它不能代替上面的 SQL。該腳本此前也沒有在這次檢查中執行。

## 4. Backup Preconditions

| 項目 | 要求 | 目前 |
|------|------|------|
| 遷移前新備份 | 授權人員在正式機做一次邏輯備份，時間在 migration 之前 | UNKNOWN |
| 排程備份 | `scripts/backup-db.bat` 寫到 `D:\EEARS_backup\local` | 正式機是否有近期檔，UNKNOWN |
| 舊備份腳本 | `reservation-backend` 的 `npm run backup` | 不能拿它代替遷移前新備份，除非授權人員確認它就是當下可用的完整備份 |
| 還原演練 | 檔案存在不等於還原過 | `RESTORE_VERIFIED` 維持 UNKNOWN |
| 還原責任 | 指定一位負責人，書面接受這次有 schema 變更時的還原方式 | 尚未指定 |

以前沒有 schema 變更的發版，曾允許書面接受「還原未演練」。這次有 schema 變更，不能沿用那個例外。沒有遷移前備份，Database Gate 不能 PASS。還沒有還原演練時，Production Approved 也不能 PASS；最多只能在負責人書面接受風險後，另案討論是否放行，本文件不放行。

不要把 `.mysql-data/`、`eears_2026-09-18_18-29.sql.gz` 或開發機備份當成正式庫備份。不要把備份內容貼進文件、log 或 PR。

`siteStats.json` 由 deploy workflow 另存。它不是資料庫備份。

## 5. Safe Migration Strategy

只有第 3 節的唯讀結果證明缺件，而且授權清單寫明每一個檔名時，才可以在正式機遷移。順序就是第 2 節的檔名順序。不要先部署新程式再補表。

可接受的增量：

- 事件表是新表。舊程式不讀它。
- `priority` 可空、無預設。舊程式不讀它。既有案件保持未設定。
- 這兩項可以在目前 `main` 的程式仍在跑時套用。套用當下 `student_feedback` 可能被短暫鎖住。沒有只暫停回報寫入的開關。若要避免寫入撞上 `ALTER`，只能接受短暫鎖，或由授權人員 `pm2 stop` 整站。後者會停掉預約與問卷。

需要單獨說明的變更：

- `20261110160000-student-feedback-cases.js` 會給既有列 `status='open'` 與 `replyRequested=true`。這會改既有列的新欄位，不改原本的內文。
- 兩支 grant 會新增權限列。不刪既有權限。
- 中間的領袖頁、姓名修復、取消碼 migration 若也未記錄，必須先個別審查。學生回報授權不能順便批准它們。

遷移時：

- 正式機、`NODE_ENV=production`。
- 工作目錄 `D:\EEARS\reservation-backend`。
- 使用既有 runbook 的 `npx sequelize-cli db:migrate`。不要改用 `sequelize.sync()`。
- 跑完後重做第 3 節的唯讀查詢。檔名與物件一致才算這一步完成。
- 不要執行任何 `down`。

## 6. Application Deployment Sequence

### Pre-Deployment

1. PR 維持 Draft。確認 GitHub Actions 沒有 queued 或 in-progress 的 Deploy。
2. 授權人員完成第 3 節，並把缺的檔名寫成清單。
3. 確認遷移前備份可用，負責人接受還原責任。
4. 確認 `ENABLE_DB_SYNC` 不是 `true`。不印出秘密。
5. 記下退回用的程式：目前 `main` 是 `e066a07373228aeb3151077f58cf62cf44fbf017`。
6. 評估停機：部署本身會 `pm2 restart`，全站短暫停。沒有回報專用維護頁。
7. 取得書面授權。授權要分開寫「可執行哪些 migration」與「可合併 PR」。只有前者時，不得合併。

### Database Migration

依第 5 節。完成後再進入程式部署。若唯讀結果顯示 schema 已經一致，這一步改為「不執行 migration」，並把證據留給 Database Gate。

### Application Deployment

Schema 驗證通過、備份與授權都齊全之後，才把 Draft PR 標成可審查並合併。合併進 `main` 會再跑 CI，CI 成功就會部署。不要另外手動部署，除非 runner 離線且另有授權。手動時仍用 `scripts/ops/deploy.bat`，不要只覆蓋幾個檔案。

不要用 `-FrontendOnly`。後端路由與服務也要換。

### Post-Deployment

見第 8 節。失敗時走第 7 節的應用程式回滾，不跑 `down`。

## 7. Rollback Strategy

### Application Rollback

優先做法：保留 `student_feedback_events` 與 `priority`，只把程式退回 `e066a073`。

`e066a073` 不讀事件表，也不讀 `priority`。多出來的表與可空欄位可以留著。已寫入的事件與優先級會保留，之後重新部署仍看得到。

退回步驟只在已授權的失敗窗口使用：

1. 確認沒有 queued、in-progress 或待重跑的 Deploy。只停止新的 push 不夠，進行中的 job 仍會 `reset --hard origin/main`。
2. 若 `main` 已經指到失敗的新 commit，下一次 CI 成功會再次蓋掉舊版。協調者要先讓 `main` 不再前進。不要為了這件事臨時改 workflow。
3. 保留 `reservation-backend\data\siteStats.json`。
4. 程式對齊 `e066a073` 後跑完整 `scripts\ops\deploy.bat`。`robocopy /MIR` 會刪掉新 build 多出的檔。
5. 確認只有一個 `eears-backend`，再做縮小版健康檢查：首頁、活動列表、後台登入。學生回報只做讀取。

這個程序沒有在正式機演練過。狀態是 `ROLLBACK_NOT_VERIFIED`。Git 可以指回舊 commit，不代表資料庫會回到遷移前。

### Database Rollback

一般回滾不執行 migration `down`。

| migration | `down` 會刪什麼 | 可否當一般回滾 |
|-----------|-----------------|----------------|
| `20261112173000` | `priority` 索引與欄位 | 否。已設定的優先級會消失。留欄位即可 |
| `20261112161000` | 整個事件表 | 否。已寫入的稽核會消失。留表即可 |
| `20261110160100` / `20261108150100` | 該權限鍵的全部分列 | 否。會刪到後來人工授予的權限 |
| `20261110160000-student-feedback-cases.js` | 留言表，以及 `status`、`replyRequested`、`assignedTeacherId`、`closedAt` | 否。會刪對話。目前程式也還需要 `status` |
| `20261108150000` | 整張 `student_feedback` | 否。這不是回滾策略 |

正式庫一旦寫入案件、留言、事件或優先級，就保留這些資料。應用程式退回舊版時，舊版忽略它不認識的表與可空欄位。

只有在備份還原已經授權、而且要回到遷移前的整庫狀態時，才使用還原備份。還原會影響窗口內其他模組寫入的資料，不是只影響學生回報。本文件不授權還原。

### Forward Fix

程式缺陷優先用新的修正前進，而不是 `down`。schema 缺件則在授權後補齊 migration，不手動改欄、不手補 `SequelizeMeta`。部分套用時先停，用唯讀結果決定下一步。

## 8. Post-Deployment Verification

使用已授權的職員測試帳號做讀取。不要為了驗收去改真實學生案件，不要改優先級、指派、結案，也不要寄信。沒有專用測試案件時，只確認授權範圍內的讀取結果，不新建案件。

| 項目 | 通過條件 |
|------|----------|
| 健康檢查 | `post-deploy-check` 通過。這只證明活動、黑名單、問卷與預約探測沒有失敗 |
| 後台列表 | `/admin/student-feedback` 不再出現「資料庫查詢失敗」 |
| Summary API | 已登入且有 view 權限時回統計，而不是 500 |
| Events API | 打開既有案件時，時間軸請求成功。沒有案件就不要為了測試去建立 |
| 優先級 | 畫面上未設定的舊案件不是被填成 P2。不要在正式案件上改優先級 |
| 權限隔離 | 沒有 view 的帳號不能開列表。沒有 manage 的帳號不能送出變更。學生只看到自己的案件。這次不新增內部備註來測試 |
| 日誌 | 重啟後沒有連續的資料庫查詢失敗。log 沒有 token、密碼或學生個資 |
| 既有功能 | 首頁與一筆既有預約路徑沒有 5xx。問卷 Gate 行為維持原樣 |
| PM2 | 仍然只有一個 `eears-backend` |

驗收記錄只寫通過或失敗與 HTTP 狀態。不寫學號、姓名、信箱或內文。

## 9. Release Gate

| Gate | 驗證條件 | 所需證據 | 負責 | 狀態 | 阻擋 |
|------|----------|----------|------|------|------|
| Engineering | PR Head 是 `7195ab0`，CI 的 backend 與 frontend 都成功，產品程式停在 `2ada344` | Actions run `43209208488` | 工程 | PASS | 此項 PASS 不允許合併或部署 |
| Database | 四支學生回報檔名與實際 schema 一致，且沒有未說明的部分套用 | 授權人員的唯讀查詢結果，不含列內容 | 資料庫授權人員 | UNKNOWN | 沒有正式庫證據。阻擋合併 |
| Security | 內部備註只有 manage 可讀；新案通知只有案件編號與後台連結；view 個資政策已有書面決定；正式 SMTP 已用測試信驗證 | 既有測試只證明程式行為。政策與正式 SMTP 仍缺 | 業務負責人與維運 | UNKNOWN | view 個資未決定，正式 SMTP 未驗證。阻擋 Production Ready |
| Deployment | 有維護窗口、指定退回 commit、Actions 沒有進行中的 Deploy、書面同意合併 | 授權紀錄。目前沒有 | 部署協調者 | UNKNOWN | 合併會觸發正式部署。未授權前阻擋 |
| Post-Deployment Validation | 第 8 節各項有讀取證據 | 部署後紀錄 | 部署協調者 | UNKNOWN | 尚未部署，不能先判通過 |
| Backup | 遷移前備份存在，負責人接受還原責任 | 備份時間與負責人姓名，不附檔案內容 | 維運 | UNKNOWN | 沒有新備份就阻擋 migration |
| Rollback | 應用程式退回路徑已指定，且不靠 `down` 刪表 | 退回 commit `e066a073`。演練仍未做 | 部署協調者 | UNKNOWN | `ROLLBACK_NOT_VERIFIED`。阻擋 Production Approved |
| Production Approved | 上面每一項都是 PASS，而且有明確的合併授權 | 尚未齊 | 發布負責人 | UNKNOWN | 本文件不是上線許可 |

Production Ready：NO。Database Ready：NO。Merge Ready：NO。PR Ready 只表示 Draft PR 已可審查。

## 10. Required Human Approvals

以下都還沒有取得。本文件不代替其中任何一項。

| 授權 | 內容 | 沒有它會怎樣 |
|------|------|----------------|
| 唯讀查詢 | 在正式庫執行第 3 節，只回報結構與檔名 | Database Gate 維持 UNKNOWN |
| 備份 | 遷移前新備份，並指定還原負責人 | 不得遷移 |
| Migration | 書面列出每一個將執行的檔名，包含非學生回報的未記錄檔 | 不得執行 `db:migrate` |
| 個資政策 | 決定 view 是否繼續看到全部案件的姓名、學號、信箱與內文 | Production Ready 維持 NO。不要在未決定時縮小權限 |
| 正式 SMTP | 用非真實學生內容做一次通知驗證，或書面延後並接受風險 | 不把 mock 測試寫成正式信箱已驗證 |
| 合併與部署 | 在 schema 驗證通過之後，另一次授權把 PR 合併進 `main` | 不得合併。合併會部署 |
| 失敗窗口 | 若要退回程式，授權協調者處理 `main` 與 Deploy job | 沒有這項時，不要在失敗後手動改正式目錄 |

下一步是把第 3 節交給有正式庫唯讀授權的人。在結果回來之前，維持 Draft，不合併、不部署、不遷移。

## Phase 2B.9 交接

正式人員改用這三份檔，不在開發筆電上執行：

- `docs/issue-reporting/sql/production_student_feedback_readonly_check.sql`
- `docs/issue-reporting/ISSUE_REPORTING_PRODUCTION_SCHEMA_HANDOFF.md`
- `docs/issue-reporting/ISSUE_REPORTING_SCHEMA_VERIFICATION_RESULT_TEMPLATE.md`

`db:migrate` 會跑所有尚未寫進 `SequelizeMeta` 的檔名。比對時要包含沒有時間戳、排序在 `20261112173000` 之後的舊式 migration。本階段沒有把 Database Ready 或 Production Migration Status 改成 PASS。
