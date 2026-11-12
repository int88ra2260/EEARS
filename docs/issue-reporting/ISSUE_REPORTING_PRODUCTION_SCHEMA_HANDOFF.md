# 學生回報正式 Schema 交接手冊

- 日期：2026-11-12
- 階段：Phase 2B.9
- 本機：`LAPTOP-IVA4HK36`
- PR：Draft #7，`feature/student-feedback-management`
- 本機 HEAD：`7195ab051b2418a08de4d1e0eeb638bc4050e387`
- 正式庫狀態：**Production Verification Required — UNKNOWN**

這份手冊把三種證據分開。

| 證據 | 這次有沒有 | 可以證明什麼 |
|------|------------|----------------|
| 本機程式、Model、Migration 檔 | 有 | 預期 schema 與檔名順序 |
| 隔離或本機 MySQL | 只可拿來檢查 SQL 語法與輸出欄位 | 不能證明正式庫 |
| 正式伺服器上的唯讀查詢 | 沒有 | 沒有查到之前，Database Ready 維持 UNKNOWN |

本機開發電腦的專案路徑也是 `D:\EEARS`。路徑相同不代表這台電腦是正式伺服器。正式檢查必須看電腦名稱不是 `LAPTOP-IVA4HK36`。

## 1. 本機可以做的事

- 盤點 `reservation-backend/migrations` 與學生回報 Model。
- 寫唯讀 SQL、決策矩陣與回填範本。
- 在拋棄式本機 MySQL 確認 SQL 是唯讀、語法可執行、結果欄位符合預期。
- 把正式查詢結果帶回來之後，在本機做檔名與欄位比對。

本機不可以連正式 MySQL、讀正式 `.env`、登入正式機、跑正式 migration、改 `SequelizeMeta`、合併 PR 或部署。

## 2. 必須由正式授權人員做的事

- 在正式伺服器上確認電腦名稱。
- 用正式庫執行 `docs/issue-reporting/sql/production_student_feedback_readonly_check.sql`。
- 匯出正式機目前的 `reservation-backend\migrations\*.js` 檔名。不要為了對清單而 `git checkout` feature branch，也不要 `reset`。
- 依第 6 節保存不含個資的結果。
- 把結果交回本機比對。比對完成前，不得執行 `db:migrate`。

`scripts/ops/production-preflight-readonly.ps1` 不查 `SequelizeMeta` 或資料表結構，不能代替這支 SQL。

## 3. 如何執行唯讀 SQL

1. 確認這台機器不是 `LAPTOP-IVA4HK36`。SQL 第 1 段會印 `@@hostname`。若是開發筆電，停止。
2. 確認沒有進行中的 Deploy，而且沒有人正在跑 `deploy.ps1`。
3. 使用已經被授權的正式庫帳號。不要把帳號、密碼、`.env` 貼進結果檔。
4. 工作階段的目前資料庫必須是正式庫。SQL 使用 `DATABASE()`，不要在語句裡寫死其他 schema。
5. 在正式機執行，建議：

```bat
cd /d D:\EEARS
mysql --host=127.0.0.1 --protocol=TCP --default-character-set=utf8mb4 -u 正式帳號 -p 正式資料庫名稱 < docs\issue-reporting\sql\production_student_feedback_readonly_check.sql
```

不要把密碼放在命令列。若第 2 段顯示 `SequelizeMeta` 是 `ABSENT`，不要執行第 4 段，也不要建立那張表。若某個回報資料表是 `ABSENT`，跳過該表的 `SHOW CREATE TABLE`。

6. 另存正式機檔名清單。這不改資料庫：

```powershell
Get-ChildItem -LiteralPath D:\EEARS\reservation-backend\migrations\*.js |
  ForEach-Object { $_.Name } |
  Sort-Object |
  Set-Content -Encoding utf8 D:\EEARS_admin\student-feedback-migration-files.txt
```

`D:\EEARS_admin` 只是建議的管理目錄。不要把這個清單放進網站目錄或 git。

## 4. 如何保存不含敏感資訊的結果

可以保留：

- hostname、port、資料庫名稱是否為正式庫、MySQL 版本
- `SequelizeMeta.name`
- 資料表、欄位、索引、外鍵的名稱與型別
- `ABSENT` / `PRESENT` / `RECORDED`
- `information_schema.TABLES.TABLE_ROWS` 這種近似筆數

不可以保留或傳回：

- 密碼、`.env`、連線字串
- `student_feedback`、`student_feedback_messages`、`student_feedback_events`、`teachers` 的資料列
- 學生姓名、學號、信箱、工單內文、留言、事件 JSON 裡的內容

`SHOW CREATE TABLE` 只應出現欄位定義。`teachers` 的定義會出現密碼欄位的結構，不會出現密碼值。若結果裡出現一筆真實內文或密碼值，停止傳送，刪除該檔，並改看是不是有人加了 `SELECT *`。

結果檔放在正式機的管理目錄。不要 commit，不要貼上 PR。

## 5. 如何交回本機比對

正式人員帶回來三份文字：

1. SQL 輸出。
2. 正式機 `migrations\*.js` 檔名。
3. 填好的 `ISSUE_REPORTING_SCHEMA_VERIFICATION_RESULT_TEMPLATE.md`。範本裡的判定先維持 UNKNOWN。

本機比對三個清單：

| 清單 | 來源 |
|------|------|
| A | 本文件第 10 節，PR Head `7195ab0` 的 177 個檔名 |
| B | 正式機目錄的檔名 |
| C | `SequelizeMeta.name` |

| 差異 | 意義 | 動作 |
|------|------|------|
| A 有、B 沒有 | 正式機程式還沒有 PR 裡的檔，通常是兩支新 migration | 不要在正式機目錄直接補檔。這不是 migration 授權 |
| B 有、C 沒有 | 若現在執行 `db:migrate`，這些檔會跑 | 停止。逐檔授權前不得遷移 |
| C 有、A 沒有 | 正式帳本有這個分支不認識的檔名 | 停止。先查是不是正式機比較新 |
| A 有、C 沒有，且 B 也有 | 以目前正式機程式執行就會跑到 | 停止，列入待授權清單 |
| 三邊一致，且第 8 節欄位也一致 | 才可以把結果送回工程比對 | 仍不自動改成 Database Ready PASS |

`db:migrate` 使用檔名排序，不會只跑學生回報。沒有時間戳的 `add-*.js` 與 `fix-*.js`、`remove_q19_q20_from_english_table_survey.js` 排在 `20261112173000` 後面。它們看起來像舊檔，不代表 `SequelizeMeta` 已經有紀錄。缺紀錄就是 pending。

## 6. Schema Mismatch 時停止

下列任一項成立就停止，回報 UNKNOWN，不要修：

- 檔名在 `SequelizeMeta`，表或欄位卻不在。
- 表或欄位已在，`SequelizeMeta` 沒有對應檔名。
- `status`、`replyRequested`、`priority` 的空值或預設與第 7 節不同。
- 預期索引或外鍵缺漏，或刪除規則不同。
- `teachers.id` 不是 signed integer。
- 回報表上有 Model 沒有的欄位。
- `student_feedback_events` 出現 `updatedAt`。Model 設了 `updatedAt: false`。
- 查詢結果含資料列或個資。
- 結果是在 `LAPTOP-IVA4HK36` 上跑出來的。

停止時不要 `INSERT` 進 `SequelizeMeta`，不要重跑 `up`，不要執行 `down`，不要 `sequelize.sync()`。

## 7. 禁止直接執行 Migration 的狀況

- 正式查詢還沒做，或結果仍是 UNKNOWN。
- 三邊清單有任何未解釋的差異。
- pending 清單含學生回報以外的檔，而且沒有另案授權。同一時分的取消碼、領袖頁、姓名修復都算。
- 物件和 `SequelizeMeta` 不一致，也就是部分套用或手改過的可能。
- 沒有遷移前備份，或還沒指定還原負責人。
- 有 Deploy 正在跑。
- `ENABLE_DB_SYNC` 是 `true`，或無法確認它不是 `true`。
- 人還在開發筆電上。
- 想用 `down` 把現場改到跟檔案一致。

學生回報相關檔與夾在中間、可能一起被 migrate 的檔：

| 順序 | 檔名 | 這次 PR 才新增 | 作用 |
|------|------|----------------|------|
| 1 | `20261108150000-create-student-feedback.js` | 否 | 建立 `student_feedback` |
| 2 | `20261108150100-grant-student-feedback-permission.js` | 否 | 補 view 權限列，不建表 |
| 3 | `20261110123000-create-leader-public-profiles.js` | 否 | 非回報。缺帳本就會一起跑 |
| 4 | `20261110131500-repair-campus-private-use-qi.js` | 否 | 非回報 |
| 5 | `20261110143000-repair-more-campus-private-use-names.js` | 否 | 非回報 |
| 6 | `20261110160000-drop-cancellation-code-from-email-overrides.js` | 否 | 非回報。字母序在案件檔之前 |
| 7 | `20261110160000-student-feedback-cases.js` | 否 | `status`、`replyRequested`、留言表。既有列得到預設值 |
| 8 | `20261110160100-grant-student-feedback-manage-permission.js` | 否 | 補 manage 權限列，不建表 |
| 9 | `20261112161000-student-feedback-events.js` | 是 | 只建事件表 |
| 10 | `20261112173000-student-feedback-priority.js` | 是 | 可空 `priority`，不回填 |

`20261110160000` 有兩個檔。Sequelize 存完整檔名，兩個都會跑。

## 8. 預期 Schema

來源是 Model，不是正式庫。`StudentFeedback`、`StudentFeedbackMessage`、`StudentFeedbackEvent` 與四支 `up` 一致。`models/index.js` 的關聯是 assignee、messages、events。

`student_feedback`

| 欄位 | 預期 | 空值 | 預設 |
|------|------|------|------|
| id | int，主鍵，自動遞增 | 否 | |
| studentId | varchar(20) | 否 | |
| studentName | varchar(100) | 否 | |
| email | varchar(100) | 否 | |
| emailVerified | tinyint(1) | 否 | 0 |
| kind | varchar(20) | 否 | |
| category | varchar(32) | 否 | |
| message | text | 否 | |
| emailStatus | varchar(20) | 否 | pending |
| createdAt / updatedAt | datetime | 否 | |
| status | varchar(20) | 否 | open |
| replyRequested | tinyint(1) | 否 | 1 |
| assignedTeacherId | int | 可 | |
| closedAt | datetime | 可 | |
| priority | varchar(8) | 可 | 無 |

索引：`PRIMARY`、`idx_student_feedback_student_created`、`idx_student_feedback_created`、`idx_student_feedback_kind_created`、`idx_student_feedback_status_created`、`idx_student_feedback_assignee`、`idx_student_feedback_priority`（`priority, id`）。

外鍵 `fk_student_feedback_assignee` 指向 `teachers.id`，更新 CASCADE，刪除 SET NULL。

`student_feedback_messages` 有 `id`、`feedbackId`、`authorType`、`visibility`、`body`、`teacherId`、`studentId`、`emailStatus`、`createdAt`、`updatedAt`。`feedbackId` 不可空。`teacherId`、`studentId`、`emailStatus` 可空。索引 `idx_student_feedback_messages_case`、`idx_student_feedback_messages_student`。案件外鍵 cascade。老師外鍵刪除時 SET NULL。

`student_feedback_events` 沒有 `updatedAt`。`visibility` 預設 `staff`。`beforeValue` 與 `afterValue` 是不可空 JSON。`actorTeacherId`、`actorStudentId`、`requestId` 可空。索引 `idx_student_feedback_events_timeline`（`feedbackId, createdAt, id`）。案件外鍵 cascade。老師外鍵刪除時 SET NULL。

`teachers.id` 預期是 signed int、主鍵、自動遞增。這支 SQL 不讀老師資料列。

MySQL 顯示預設值時，`0`、`1`、`pending`、`open`、`staff` 的引號可能和上表不同。交回後再判，不要在正式機把格式差異直接改成 PASS 或動手改欄位。外鍵通常還會多一個同名索引，例如 `fk_student_feedback_messages_teacher`。那不是 Model 以外的新欄位。

## 9. Migration 狀態決策矩陣

| SequelizeMeta | 實際物件 | 判定 | 下一步 |
|---------------|----------|------|--------|
| 四支結構檔都在，欄位、索引、外鍵與第 8 節一致 | 一致 | 可送工程比對 | 仍要三邊檔名清單。其他 pending 檔存在就還不能 migrate |
| 缺檔名，物件也缺 | 尚未套用 | UNKNOWN | 列出全部 pending。沒有逐檔授權就停止 |
| 缺檔名，物件已在 | 可能手改或部分套用 | Mismatch | 不重跑 `up`，不手補帳本 |
| 有檔名，物件缺 | 帳本與結構不一致 | Mismatch | 不重跑。這些 `up` 沒有 `IF NOT EXISTS` |
| 案件與 `status`、留言表都在，只缺事件表或 `priority` | 增量缺件 | UNKNOWN | 這兩支不改舊列、不回填優先級。仍須備份與授權，且不得夾帶其他 pending |
| 有案件表，沒有 `status` 或留言表 | 正式程式可能已經會查失敗 | UNKNOWN | `student-feedback-cases` 會給既有列 `open` 與 `replyRequested=true`。未授權不執行 |
| 沒有 `student_feedback` | 從頭未套用 | UNKNOWN | migrate 會從第一支一路跑到所有未記錄檔，包含非回報與檔名排在最後的舊式檔 |
| 正式帳本有本分支沒有的檔名 | 程式與正式帳本分叉 | Mismatch | 停止 |
| 查詢在開發筆電執行 | 不是正式證據 | 作廢 | 不採信 |

沒有任何一列允許把 Database Ready 改成 PASS。那要等正式結果交回並經過另一次認可。

## 10. PR Head 的 Migration 檔名

以下 177 個檔名來自本機 `7195ab0` 的 `reservation-backend/migrations`，已依檔名排序。這是清單 A，不是正式機目錄，也不是 `SequelizeMeta`。

```text
20241201000001-create-settings.js
20241201000002-create-classes.js
20241201000003-create-class-memberships.js
20241201000004-add-grade-to-class-memberships.js
20241201000005-add-teacher-to-classes.js
20241201000006-create-teachers.js
20241201000007-create-class-teachers.js
20241201000008-create-all-tables.js
20250115000000-add-teacher-level.js
20250120000000-update-success-sequence.js
20250203000001-create-bestep-attendance.js
20250203000002-create-bestep-exam-scores.js
20250203000003-create-bestep-exam-sessions.js
20250203000004-create-bestep-team-rankings.js
20250203000005-add-semester-to-english-test-registrations.js
20250207000100-update-teachers-role-and-security.js
20251110090000-update-grade-length-in-english-table-survey.js
20260129000000-update-english-test-registration-status.js
20260130000000-create-learning-partner-tables.js
20260224000001-create-english-test-tracking-tables.js
20260323000000-add-exemption-review-to-english-test-registrations.js
20260323130000-english-test-reg-unique-student-semester.js
20260326000000-create-announcements-table.js
20260326120000-create-audit-logs-table.js
20260326130000-create-email-logs-table.js
20260326131000-create-system-logs-table.js
20260326150000-create-notifications-table.js
20260401090000-add-teacher-permissions-scopes.js
20260401110000-create-role-permissions.js
20260401110100-create-user-permission-overrides.js
20260401110200-create-user-scopes.js
20260401110300-add-access-version-to-teachers.js
20260401143000-add-traceid-change-reason-to-audit-logs.js
20260402160000-ensure-event-violations-fk-references-events.js
20260410120000-create-survey-product-module-tables.js
20260410180000-announcements-product-module.js
20260413120000-add-semester-to-survey-response.js
20260413183000-upgrade-survey-product-subsystem.js
20260413210000-add-survey-repair-and-mapping-tables.js
20260417110000-refactor-english-test-long-term-tracking.js
20260420140000-dedupe-et-exam-attempts-with-backup.js
20260420180000-create-learning-journey-core-tables.js
20260420190000-expand-learning-journey-migration-governance.js
20260421120000-et-best-skills-nullable-legacy-columns.js
20260422090000-create-et-attempt-import-histories.js
20260427090000-create-learning-journey-course-tables.js
20260427115000-create-job-runs.js
20260427180000-create-learning-journey-import-histories.js
20260429115500-expand-et-examtype-enum-itp-cambridge.js
20260430161000-fix-et-exam-attempt-unique-key.js
20260504100000-add-office-staff-role-staff-level.js
20260508120000-create-event-waitlist-entries.js
20260508143000-add-promoted-reservation-fk-to-waitlist.js
20260508182000-expand-bestep-attendance-examtype-enum.js
20260511120000-expand-et-examtype-enum-toefl-ibt-legacy-2026.js
20260511140000-expand-et-examtype-enum-gept-levels.js
20260512120000-align-survey-responses-schema-with-survey-module-model.js
20260518120000-create-learning-journey-operation-runs.js
20260518143000-add-soft-archive-to-learning-journey-operation-runs.js
20260601120000-add-can-view-analytics-to-teacher-role-permissions.js
20260601120000-add-import-batch-id-to-bestep-tables.js
20260603120000-fix-survey-responses-studentid-unique.js
20260605120000-merge-legacy-event-reservation-tables.js
20260615120000-create-english-learning-passport-tables.js
20260615120000-create-lj-analytics-tables.js
20260615140000-expand-lj-import-types-and-rollback.js
20260615143000-dedupe-lj-student-events-null-skill.js
20260617170000-create-lva-model-run-tables.js
20260618120000-create-import-rollback-manifests.js
20260618180000-create-site-content-entries.js
20260618190000-add-site-content-staff-fields.js
20260622120000-create-resource-skill-profiles.js
20260622140000-create-learning-analytics-config-tables.js
20260622150000-add-lj-analytic-exam-session-columns.js
20260622150000-create-learning-analytics-lva-config.js
20260622170000-create-weekly-reports-table.js
20260623100000-weekly-reports-blocks-and-media.js
20260624100000-create-weekly-interaction-events.js
20260706180000-resync-teacher-office-staff-role-permissions.js
20260707162000-resync-deputy-manager-role-permissions.js
20260707170000-resync-deputy-manager-learning-partner-permission.js
20260707171500-resync-deputy-manager-system-settings-permission.js
20260707180000-resync-event-lead-role-permissions.js
20260713130000-create-et-grouping-tables.js
20260713131000-resync-et-grouping-role-permissions.js
20260713140000-add-event-group-capacity-fields.js
20260713143000-resync-event-lead-governance-permissions.js
20260713150000-add-ability-group-slots-to-plan.js
20260713150000-resync-event-lead-view-only-accounts.js
20260713160000-create-et-phase-b-tables.js
20260713160000-replace-caps-with-gse.js
20260713160000-resync-event-lead-leader-account-mgmt.js
20260713161000-resync-et-phase-b-role-permissions.js
20260713170000-create-et-leader-preferences.js
20260713180000-add-et-leader-role.js
20260713181000-resync-et-leader-role-permissions.js
20260713192000-resync-bestep-lead-governance-permissions.js
20260713194000-resync-bestep-lead-no-account-mgmt.js
20260713200000-add-et-plan-grouping-layout.js
20260714095000-resync-executive-nav-permissions.js
20260714102000-resync-et-manager-nav-permissions.js
20260714113000-resync-jt-manager-nav-permissions.js
20260714143000-resync-regular-teacher-nav-permissions.js
20260714160000-create-english-test-email-verifications.js
20260717093000-expand-activity-participation-type-ewl.js
20260721163000-resync-event-lead-elp-rules-permission.js
20260728180000-create-public-page-content.js
20260731120000-create-english-test-form-schema.js
20260803140000-create-course-guide-content.js
20260803160000-create-email-template-overrides.js
20260804143000-create-media-assets.js
20260804170000-create-english-test-student-idcard-roster.js
20260828120000-create-learning-trace-events.js
20260828130000-expand-learning-trace-events.js
20260828140000-add-micro-learning-lj-event-type.js
20260902180000-resync-office-staff-system-settings-permission.js
20260903120000-expire-waiting-waitlist-entries.js
20260904120000-add-worker-level.js
20260904120000-create-elp-email-verifications.js
20260904130000-add-teacher-is-demo.js
20260904170000-add-notes-to-events.js
20260907120000-drop-english-test-studentId-only-unique.js
20260910140000-create-learning-analytics-kpi-policies.js
20260911190000-elp-event-checkin-passport-points.js
20260915140000-create-event-types-and-migrate-codes.js
20260916160000-deactivate-international-forum-event-type.js
20260918170000-create-et-leader-attendance-tables.js
20260918180000-create-et-leader-pay-profiles.js
20260922120000-create-class-credit-allocations.js
20260922170000-email-template-attachments-json.js
20260923110000-create-class-credit-adjustments.js
20260923170000-class-credit-adjustments-nullable-class.js
20260923180000-create-english-test-manual-mail.js
20260924120000-create-english-test-mail-bins.js
20261001170000-create-speaking-diagnostic-tables.js
20261002183000-resync-class-credit-staff-permission.js
20261002194000-add-reservation-exclude-from-class-credit.js
20261002195500-add-elp-rule-bonus-points.js
20261004120000-create-speaking-adaptive-sessions.js
20261006100000-extend-speaking-tasks-esap-fields.js
20261006193000-create-trip-count-tables.js
20261015120000-resync-passport-ops-review-only.js
20261016020000-add-et-leader-pay-release.js
20261016030000-add-et-leader-marking-extension.js
20261016223000-create-learning-analytics-tracking-cohorts.js
20261019200000-replace-et-tasks-with-shared-indicators.js
20261021180000-create-student-accounts.js
20261021190000-create-speaking-check-sets.js
20261021223000-add-speaking-check-recordings-and-ratings.js
20261023100000-create-student-account-email-verifications.js
20261023120000-create-student-account-reviews.js
20261023140000-create-student-password-resets.js
20261023140000-other-event-open-rule-and-visibility.js
20261030143000-add-student-account-campus-profile.js
20261031010000-survey-retake-once-per-semester.js
20261031150000-clear-student-local-passwords.js
20261031170000-add-student-email-verified-at.js
20261108150000-create-student-feedback.js
20261108150100-grant-student-feedback-permission.js
20261110123000-create-leader-public-profiles.js
20261110131500-repair-campus-private-use-qi.js
20261110143000-repair-more-campus-private-use-names.js
20261110160000-drop-cancellation-code-from-email-overrides.js
20261110160000-student-feedback-cases.js
20261110160100-grant-student-feedback-manage-permission.js
20261112161000-student-feedback-events.js
20261112173000-student-feedback-priority.js
add-auto-check-completed-to-events.js
add-checkin-and-violation-features.js
add-database-indexes.js
add-indexes-to-english-test-registrations.js
add-no-excuse-absence-violation-type.js
add-preorder-no-show-violation-type.js
add-unique-constraint-reservations.js
add-violation-status-to-reservations.js
fix-event-violations-fk-to-events.js
remove_q19_q20_from_english_table_survey.js
```

同一時分、檔名不同、兩邊都要保留的組合還有：`20260601120000`、`20260615120000`、`20260622150000`、`20260713150000`、`20260713160000`、`20260904120000`、`20261023140000`、`20261110160000`。

## 11. Release Gate

| Gate | Status |
|------|--------|
| Engineering Ready | PASS（本機與 PR CI） |
| Database Ready | UNKNOWN |
| Security Ready | PARTIAL / UNKNOWN |
| Merge Ready | NO |
| Production Ready | NO |
| Production Migration Status | UNKNOWN |

正式查詢結果回來之前，不得把 UNKNOWN 改成 PASS。
