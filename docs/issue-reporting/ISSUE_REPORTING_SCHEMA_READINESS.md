# 學生回報 Schema Readiness

- 日期：2026-11-12
- Production Migration Status：Not Verified（UNKNOWN）。Phase 2A 與 Phase 2B 都沒有改這項。

## Phase 2B 優先級欄位

預期新增在 `student_feedback`：

| 欄位 | 型別 | 空值 | 預設 |
|------|------|------|------|
| priority | STRING(8) | 可 | 無。不回填既有案件 |

索引 `idx_student_feedback_priority` 是 `priority, id`。沒有 ENUM，也沒有把舊列改成 P2。Migration 是 `20261112173000-student-feedback-priority.js`，必須在 `20261108150000` 建立 `student_feedback` 之後。`down` 只刪這個索引與欄位，不刪案件。

隔離庫 `127.0.0.1:3316` 的 `eears_fb_it_phase2b` 已套用這支 migration，欄位可空且沒有預設，5 項整合測試通過。測試結束後已關閉該 MySQL 並刪除暫存 datadir。這不是正式庫。
- Phase 1.7 沒有連線正式資料庫，沒有讀寫 `SequelizeMeta`，也沒有對正式庫執行 migration。
- 隔離測試庫的結果不能用來推定正式環境。UNKNOWN 不是 PASS。

## Phase 1.7 正式庫唯讀驗證

- 驗證日期：2026-11-12
- 驗證環境：本機 `LAPTOP-IVA4HK36`，IPv4 含 `192.168.50.252` 與 `127.0.0.1`。這不是正式網站所在主機。
- 存取決定：沒有經確認的正式庫唯讀身分。沒有讀 `.env`，沒有取出資料庫帳密，沒有開 MySQL 連線。
- `scripts/ops/production-preflight-readonly.ps1` 只檢查本機服務與環境變數是否有值，不查 `SequelizeMeta` 或 `INFORMATION_SCHEMA`。Runbook 寫明該腳本尚未在正式主機執行。這次沒有跑它。
- 執行的唯讀查詢類型：無。沒有 `SHOW CREATE TABLE`，沒有 `INFORMATION_SCHEMA`，沒有 `SequelizeMeta`。
- 沒有查詢或顯示學生個資、工單正文或留言。

### SequelizeMeta

預期檔名與順序：

| 順序 | Migration 檔名 | SequelizeMeta | 前置依賴 | 結果 |
|------|----------------|---------------|----------|------|
| 1 | `20261108150000-create-student-feedback.js` | UNKNOWN | `teachers` 已存在 | UNKNOWN |
| 2 | `20261110160000-student-feedback-cases.js` | UNKNOWN | 上一支已建立 `student_feedback`，且 `teachers.id` 可被外鍵引用 | UNKNOWN |
| 3 | `20261112161000-student-feedback-events.js` | UNKNOWN | `student_feedback` 與 `teachers` 都已存在 | UNKNOWN |

沒有新增或修改 `SequelizeMeta`。缺紀錄時的處理仍是：不要手動補寫。

### Schema 比對

| 檢查 | student_feedback | student_feedback_messages | student_feedback_events | teachers |
|------|------------------|---------------------------|-------------------------|----------|
| 表格存在 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 欄位、型別、Nullable、Default | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Primary Key | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Foreign Key | UNKNOWN | UNKNOWN | UNKNOWN | NOT APPLICABLE（本階段只確認它是被參考端） |
| Index | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 與 Sequelize Model 一致 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 會否讓 API 查詢失敗 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

程式與 migration 檔的靜態對照：三個 Model 的欄位、空值與預設值和對應 migration 一致。`Teacher.id` 在 Model 是 `INTEGER`。這只證明原始碼彼此相符，不是正式庫 PASS。

正式庫差異：無法列出。沒有 FAIL，也沒有 Migration Metadata Mismatch 的證據。兩者都是 UNKNOWN。

先前正式網站後台列表出現過「資料庫查詢失敗」。本機曾用缺少 `status` 的表重現 `Unknown column 'StudentFeedback.status'`。那不能當成正式 `SequelizeMeta` 或 `SHOW CREATE TABLE` 的證據，這次仍不判 FAIL。

### 若日後確認缺失時的修復方向

這次沒有執行修復。若正式機唯讀檢查發現缺表或缺欄：

- 缺 `student_feedback`：先套用 `20261108150000`，再依序套用後兩支。列表、詳情、summary、事件 API 都會失敗。
- 只有基底表、沒有 `status` 或 `student_feedback_messages`：後台列表與 summary 會選到不存在的欄位。套用 `20261110160000`。既有案件列會留著，新欄位有預設值。
- 案件欄位已在、沒有 `student_feedback_events`：狀態與指派更新會在寫事件時失敗。套用 `20261112161000`。它只建新表。
- 表已存在但 `SequelizeMeta` 沒有檔名：記為 Migration Metadata Mismatch，不要直接插入紀錄，也不要重跑會再建表的 `up`。
- 套用前先有可還原備份。`20261110160000` 的 `down` 會刪留言表與四個案件欄位；`20261108150000` 的 `down` 會刪整張案件表。回滾前不要執行這兩支 `down`。

### Database Release Gate

| 項目 | 狀態 |
|------|------|
| Database Ready | 否。正式庫 Not Verified |
| Production Ready | 否 |

## Migration Dependency

順序必須是：

1. `teachers` 已存在。`teachers.id` 是 signed `INTEGER`。
2. `20261108150000-create-student-feedback.js` 建立 `student_feedback`。
3. `20261110160000-student-feedback-cases.js` 加上案件欄位與 `student_feedback_messages`。
4. `20261112161000-student-feedback-events.js` 建立 `student_feedback_events`。

事件表的外鍵指向 `student_feedback.id` 與 `teachers.id`。前置表不存在時，這支 migration 不能套用。

權限 grant `20261108150100`、`20261110160100` 只補已有 `role_permissions` 列的角色，不建立資料表。

## Expected Schema

`student_feedback` 在 `20261110160000` 之後：

| 欄位 | 型別 | 空值 |
|------|------|------|
| id | INTEGER，主鍵 | 否 |
| studentId | STRING(20) | 否 |
| studentName | STRING(100) | 否 |
| email | STRING(100) | 否 |
| emailVerified | BOOLEAN，預設 false | 否 |
| kind | STRING(20) | 否 |
| category | STRING(32) | 否 |
| message | TEXT | 否 |
| emailStatus | STRING(20)，預設 pending | 否 |
| status | STRING(20)，預設 open | 否 |
| replyRequested | BOOLEAN，預設 true | 否 |
| assignedTeacherId | INTEGER | 可 |
| closedAt | DATE | 可 |
| createdAt / updatedAt | DATE | 否 |

索引：`idx_student_feedback_student_created`、`idx_student_feedback_created`、`idx_student_feedback_kind_created`、`idx_student_feedback_status_created`、`idx_student_feedback_assignee`。外鍵 `fk_student_feedback_assignee` 指向 `teachers.id`，刪除老師時設為 NULL。

`student_feedback_messages`：`feedbackId` 必填，外鍵 cascade；`teacherId` 可空，刪除老師時設為 NULL。索引含案件與學生。

`student_feedback_events`：

| 欄位 | 空值 |
|------|------|
| id、feedbackId、eventType、visibility、actorType、beforeValue、afterValue、createdAt | 否 |
| actorTeacherId、actorStudentId、requestId | 可 |

索引 `idx_student_feedback_events_timeline` 是 `feedbackId, createdAt, id`。外鍵 `fk_student_feedback_events_case` cascade，`fk_student_feedback_events_teacher` 刪除老師時設為 NULL。

Model：`StudentFeedback`、`StudentFeedbackMessage`、`StudentFeedbackEvent` 的欄位與上表一致。`models/index.js` 有 assignee、messages、events 關聯。

## Verified Schema

驗證層級：隔離測試庫。不是正式環境。

- 位置：`127.0.0.1:3316`
- 資料庫：`eears_fb_it_phase16`
- 建立方式：空的 MySQL 8.0.41，只含 `teachers`（由測試用 `Teacher.sync()` 建立）與上述三支 migration 的 `up`
- 沒有使用 `.mysql-data/`、正式庫或 `eears_2026-09-18_18-29.sql.gz`
- 測試結束後已關閉該 MySQL 並刪除暫存 datadir

`tests/studentFeedbackMysql.integration.test.js` 在這個庫上通過 4 項：

- `information_schema` 的事件欄位、兩個外鍵，以及時間軸索引與預期一致
- 狀態與指派寫入正確的 before／after；相同值不再寫事件
- 不存在的 `feedbackId` 被外鍵拒絕
- 更新中途失敗會 rollback；事件外鍵失敗時案件狀態不變且沒有事件
- 第一個交易持有 `SELECT ... FOR UPDATE` 時，第二個 `FOR UPDATE` 會等待；提交後讀到的是新狀態，不是鎖定前的舊狀態

差異：這座隔離庫與預期 schema 沒有發現差異。正式庫差異是 **Not Verified**。

## Evidence

- 測試指令在 `EEARS_FEEDBACK_IT=1`、host `127.0.0.1`、port `3316`、資料庫名稱 `eears_fb_it_phase16` 時才會連線。其他目標會直接拒絕。
- 結果：1 suite、4 tests 通過，0 失敗。
- 正式庫的 `SHOW CREATE TABLE`、`SequelizeMeta`、外鍵與索引都沒有查。

若日後發現正式庫有欄位但 `SequelizeMeta` 沒有對應檔名，不要手動補紀錄。先核對實際 schema，再決定是否由正式機的 migration 流程處理。

## Deployment Preconditions

- 正式機先確認 `teachers` 與 `20261108150000` 已存在。
- 再套用 `20261110160000`，最後才是 `20261112161000`。
- 部署腳本不會自動 migrate。
- 不要開 `ENABLE_DB_SYNC`。
- 這份文件的隔離測試通過，不等於正式庫已準備好。

## Phase 2B.9

- 本機已準備正式唯讀 SQL 與操作手冊。見 `ISSUE_REPORTING_PRODUCTION_SCHEMA_HANDOFF.md`。
- 沒有連正式庫，沒有讀正式 `.env`，沒有改 `SequelizeMeta`。
- Production Migration Status 維持 UNKNOWN。
- 開發筆電的路徑也是 `D:\EEARS`。正式結果必須來自電腦名稱不是 `LAPTOP-IVA4HK36` 的伺服器。

## Rollback Considerations

- `20261112161000` 的 `down` 只刪 `student_feedback_events`，不刪案件與留言。
- `20261110160000` 的 `down` 會刪留言表，並拿掉狀態、回覆要求、承辦與結案時間。已有案件對話時不能直接 `down`。
- `20261108150000` 的 `down` 會刪整張 `student_feedback`。
- 回滾應用程式時，若事件表已存在而程式退回不讀它，可以留表。若程式還會查 `status`，就不能先拿掉 `20261110160000` 的欄位。
